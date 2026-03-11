from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q, Count, Avg, F
from datetime import date, datetime, timedelta
from .models import (
    StudentAttendance, FacultyAttendance, AttendanceEditRequest,
    AttendanceSettings, AttendanceAlert, BulkAttendanceSession
)
from .serializers import StudentAttendanceSerializer, FacultyAttendanceSerializer
from .permissions import IsInstructorOrAdmin, IsFacultyOrAdmin, CanViewAttendanceReports
from academics.models import Timetable, Course
from students.models import Student

@api_view(['POST'])
@permission_classes([IsInstructorOrAdmin])
def bulk_mark_attendance(request):
    """Enhanced bulk attendance marking with validation"""
    user = request.user
    
    if not hasattr(user, 'instructor_profile'):
        return Response({'error': 'Only instructors can mark attendance'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    instructor = user.instructor_profile
    timetable_id = request.data.get('timetable_id')
    attendance_data = request.data.get('attendance_data', [])
    attendance_date = request.data.get('date', str(date.today()))
    notes = request.data.get('notes', '')
    
    try:
        timetable = get_object_or_404(Timetable, timetable_id=timetable_id, instructor=instructor)
        settings = AttendanceSettings.get_settings()
        
        # Validate date
        attendance_date_obj = datetime.strptime(attendance_date, '%Y-%m-%d').date()
        if not settings.allow_future_attendance and attendance_date_obj > date.today():
            return Response({'error': 'Future attendance marking not allowed'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Check if attendance already exists and is locked
        existing_session = BulkAttendanceSession.objects.filter(
            instructor=instructor,
            timetable=timetable,
            date=attendance_date_obj,
            is_completed=True
        ).first()
        
        if existing_session:
            return Response({'error': 'Attendance already marked for this class'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Create bulk session
        bulk_session = BulkAttendanceSession.objects.create(
            instructor=instructor,
            timetable=timetable,
            date=attendance_date_obj,
            total_students=len(attendance_data),
            marked_students=0,
            notes=notes
        )
        
        marked_students = []
        alerts_generated = []
        
        for student_data in attendance_data:
            student_id = student_data.get('student_id')
            attendance_status = student_data.get('status', 'Present')
            student_notes = student_data.get('notes', '')
            
            student = get_object_or_404(Student, student_id=student_id)
            
            # Create attendance record
            attendance, created = StudentAttendance.objects.update_or_create(
                student=student,
                timetable=timetable,
                date=attendance_date_obj,
                defaults={
                    'course': timetable.course,
                    'instructor': instructor,
                    'status': attendance_status,
                    'notes': student_notes,
                    'is_locked': True
                }
            )
            
            marked_students.append({
                'student_id': student.student_id,
                'student_name': student.name,
                'status': attendance_status,
                'created': created
            })
            
            # Check for low attendance and generate alerts
            attendance_percentage = attendance.attendance_percentage
            if attendance_percentage < settings.minimum_attendance_percentage:
                alert_type = 'critical_attendance' if attendance_percentage < 50 else 'low_attendance'
                
                alert, alert_created = AttendanceAlert.objects.get_or_create(
                    student=student,
                    course=timetable.course,
                    alert_type=alert_type,
                    is_resolved=False,
                    defaults={
                        'attendance_percentage': attendance_percentage,
                        'message': f'Student attendance is {attendance_percentage:.1f}% in {timetable.course.name}'
                    }
                )
                
                if alert_created:
                    alerts_generated.append({
                        'student_name': student.name,
                        'alert_type': alert_type,
                        'percentage': attendance_percentage
                    })
        
        # Update bulk session
        bulk_session.marked_students = len(marked_students)
        bulk_session.session_end = timezone.now()
        bulk_session.is_completed = True
        bulk_session.save()
        
        # Auto-mark instructor attendance
        faculty_attendance, created = FacultyAttendance.objects.update_or_create(
            instructor=instructor,
            date=attendance_date_obj,
            defaults={
                'status': 'Present',
                'auto_marked': True,
                'is_locked': True
            }
        )
        
        return Response({
            'message': 'Bulk attendance marked successfully',
            'session_id': bulk_session.id,
            'marked_students': marked_students,
            'alerts_generated': alerts_generated,
            'total_marked': len(marked_students),
            'instructor_auto_marked': created
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([CanViewAttendanceReports])
def get_attendance_analytics(request):
    """Advanced attendance analytics dashboard"""
    user = request.user
    date_from = request.GET.get('date_from', str(date.today() - timedelta(days=30)))
    date_to = request.GET.get('date_to', str(date.today()))
    
    # Determine user's access level
    department = None
    if hasattr(user, 'coordinator_profile'):
        department = user.coordinator_profile.department
    elif hasattr(user, 'hod_profile'):
        department = user.hod_profile.department
    elif not (user.is_superuser or user.role == 'admin' or hasattr(user, 'principal_profile')):
        return Response({'error': 'Unauthorized access'}, status=403)
    
    # Base filters
    filters = {'date__gte': date_from, 'date__lte': date_to}
    
    if department:
        student_attendance = StudentAttendance.objects.filter(
            course__semester__department=department, **filters
        )
        faculty_attendance = FacultyAttendance.objects.filter(
            Q(instructor__department=department) |
            Q(coordinator__department=department) |
            Q(hod__department=department),
            **filters
        )
    else:
        student_attendance = StudentAttendance.objects.filter(**filters)
        faculty_attendance = FacultyAttendance.objects.filter(**filters)
    
    # Calculate key metrics
    total_classes = student_attendance.count()
    present_count = student_attendance.filter(status='Present').count()
    absent_count = student_attendance.filter(status='Absent').count()
    late_count = student_attendance.filter(status='Late').count()
    
    # Course-wise analytics
    course_analytics = {}
    for attendance in student_attendance.select_related('course'):
        course_key = f"{attendance.course.code}"
        if course_key not in course_analytics:
            course_analytics[course_key] = {
                'course_name': attendance.course.name,
                'total': 0, 'present': 0, 'absent': 0, 'late': 0
            }
        
        course_analytics[course_key]['total'] += 1
        course_analytics[course_key][attendance.status.lower()] += 1
    
    # Calculate percentages
    for course in course_analytics.values():
        total = course['total']
        course['attendance_rate'] = (course['present'] / total * 100) if total > 0 else 0
    
    # Weekly trends
    weekly_trends = {}
    for attendance in student_attendance:
        week_start = attendance.date - timedelta(days=attendance.date.weekday())
        week_key = week_start.strftime('%Y-%m-%d')
        
        if week_key not in weekly_trends:
            weekly_trends[week_key] = {'total': 0, 'present': 0, 'absent': 0, 'late': 0}
        
        weekly_trends[week_key]['total'] += 1
        weekly_trends[week_key][attendance.status.lower()] += 1
    
    # Low attendance students
    settings = AttendanceSettings.get_settings()
    low_attendance_students = []
    
    for student in Student.objects.filter(is_active=True):
        if department and student.semester.department != department:
            continue
            
        student_records = student_attendance.filter(student=student)
        if student_records.exists():
            total = student_records.count()
            present = student_records.filter(status__in=['Present', 'Late']).count()
            percentage = (present / total * 100) if total > 0 else 0
            
            if percentage < settings.minimum_attendance_percentage:
                low_attendance_students.append({
                    'student_id': student.student_id,
                    'student_name': student.name,
                    'attendance_percentage': percentage,
                    'total_classes': total,
                    'present_classes': present
                })
    
    # Faculty performance
    faculty_performance = {}
    for attendance in faculty_attendance:
        faculty_name = attendance.get_faculty_name()
        if faculty_name not in faculty_performance:
            faculty_performance[faculty_name] = {
                'total': 0, 'present': 0, 'auto_marked': 0, 'self_marked': 0
            }
        
        faculty_performance[faculty_name]['total'] += 1
        if attendance.status == 'Present':
            faculty_performance[faculty_name]['present'] += 1
        if attendance.auto_marked:
            faculty_performance[faculty_name]['auto_marked'] += 1
        if attendance.self_marked:
            faculty_performance[faculty_name]['self_marked'] += 1
    
    return Response({
        'overview': {
            'total_classes': total_classes,
            'present_count': present_count,
            'absent_count': absent_count,
            'late_count': late_count,
            'overall_attendance_rate': (present_count / total_classes * 100) if total_classes > 0 else 0
        },
        'course_analytics': course_analytics,
        'weekly_trends': weekly_trends,
        'low_attendance_students': low_attendance_students,
        'faculty_performance': faculty_performance,
        'settings': {
            'minimum_attendance_percentage': settings.minimum_attendance_percentage,
            'late_threshold_minutes': settings.late_arrival_threshold_minutes
        },
        'date_range': {'from': date_from, 'to': date_to}
    })

@api_view(['GET'])
@permission_classes([CanViewAttendanceReports])
def get_attendance_alerts(request):
    """Get attendance alerts for low attendance students"""
    user = request.user
    
    # Determine user's access level
    department = None
    if hasattr(user, 'coordinator_profile'):
        department = user.coordinator_profile.department
    elif hasattr(user, 'hod_profile'):
        department = user.hod_profile.department
    elif not (user.is_superuser or user.role == 'admin' or hasattr(user, 'principal_profile')):
        return Response({'error': 'Unauthorized access'}, status=403)
    
    # Get alerts
    alerts_query = AttendanceAlert.objects.select_related('student', 'course')
    
    if department:
        alerts_query = alerts_query.filter(course__semester__department=department)
    
    # Filter by status
    show_resolved = request.GET.get('show_resolved', 'false').lower() == 'true'
    if not show_resolved:
        alerts_query = alerts_query.filter(is_resolved=False)
    
    alerts = alerts_query.order_by('-created_at')
    
    alerts_data = []
    for alert in alerts:
        alerts_data.append({
            'id': alert.id,
            'student_id': alert.student.student_id,
            'student_name': alert.student.name,
            'course_code': alert.course.code,
            'course_name': alert.course.name,
            'alert_type': alert.alert_type,
            'attendance_percentage': alert.attendance_percentage,
            'message': alert.message,
            'is_resolved': alert.is_resolved,
            'created_at': alert.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'resolved_at': alert.resolved_at.strftime('%Y-%m-%d %H:%M:%S') if alert.resolved_at else None
        })
    
    return Response({
        'alerts': alerts_data,
        'total_alerts': len(alerts_data),
        'unresolved_count': alerts_query.filter(is_resolved=False).count()
    })

@api_view(['POST'])
@permission_classes([CanViewAttendanceReports])
def resolve_attendance_alert(request, alert_id):
    """Resolve an attendance alert"""
    user = request.user
    
    try:
        alert = get_object_or_404(AttendanceAlert, id=alert_id)
        
        # Check permissions
        department = None
        if hasattr(user, 'coordinator_profile'):
            department = user.coordinator_profile.department
        elif hasattr(user, 'hod_profile'):
            department = user.hod_profile.department
        elif not (user.is_superuser or user.role == 'admin' or hasattr(user, 'principal_profile')):
            return Response({'error': 'Unauthorized access'}, status=403)
        
        if department and alert.course.semester.department != department:
            return Response({'error': 'Unauthorized access to this alert'}, status=403)
        
        alert.is_resolved = True
        alert.resolved_at = timezone.now()
        alert.save()
        
        return Response({
            'message': 'Alert resolved successfully',
            'alert_id': alert_id
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def attendance_settings(request):
    """Get or update attendance settings"""
    user = request.user
    
    if not (user.is_superuser or user.role == 'admin'):
        return Response({'error': 'Only admins can manage attendance settings'}, 
                       status=403)
    
    settings = AttendanceSettings.get_settings()
    
    if request.method == 'GET':
        return Response({
            'minimum_attendance_percentage': settings.minimum_attendance_percentage,
            'late_arrival_threshold_minutes': settings.late_arrival_threshold_minutes,
            'auto_lock_attendance_hours': settings.auto_lock_attendance_hours,
            'allow_future_attendance': settings.allow_future_attendance,
            'require_location_verification': settings.require_location_verification
        })
    
    elif request.method == 'POST':
        # Update settings
        settings.minimum_attendance_percentage = request.data.get(
            'minimum_attendance_percentage', settings.minimum_attendance_percentage
        )
        settings.late_arrival_threshold_minutes = request.data.get(
            'late_arrival_threshold_minutes', settings.late_arrival_threshold_minutes
        )
        settings.auto_lock_attendance_hours = request.data.get(
            'auto_lock_attendance_hours', settings.auto_lock_attendance_hours
        )
        settings.allow_future_attendance = request.data.get(
            'allow_future_attendance', settings.allow_future_attendance
        )
        settings.require_location_verification = request.data.get(
            'require_location_verification', settings.require_location_verification
        )
        
        settings.save()
        
        return Response({
            'message': 'Settings updated successfully',
            'settings': {
                'minimum_attendance_percentage': settings.minimum_attendance_percentage,
                'late_arrival_threshold_minutes': settings.late_arrival_threshold_minutes,
                'auto_lock_attendance_hours': settings.auto_lock_attendance_hours,
                'allow_future_attendance': settings.allow_future_attendance,
                'require_location_verification': settings.require_location_verification
            }
        })

@api_view(['GET'])
@permission_classes([IsInstructorOrAdmin])
def get_bulk_attendance_sessions(request):
    """Get instructor's bulk attendance sessions"""
    user = request.user
    
    if not hasattr(user, 'instructor_profile'):
        return Response({'error': 'Only instructors can access this'}, status=403)
    
    instructor = user.instructor_profile
    sessions = BulkAttendanceSession.objects.filter(
        instructor=instructor
    ).select_related('timetable', 'timetable__course').order_by('-session_start')
    
    sessions_data = []
    for session in sessions:
        sessions_data.append({
            'id': session.id,
            'course_name': session.timetable.course.name,
            'course_code': session.timetable.course.code,
            'date': session.date.strftime('%Y-%m-%d'),
            'total_students': session.total_students,
            'marked_students': session.marked_students,
            'is_completed': session.is_completed,
            'session_start': session.session_start.strftime('%Y-%m-%d %H:%M:%S'),
            'session_end': session.session_end.strftime('%Y-%m-%d %H:%M:%S') if session.session_end else None,
            'notes': session.notes
        })
    
    return Response({
        'sessions': sessions_data,
        'total_sessions': len(sessions_data)
    })