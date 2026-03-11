from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count, Avg, F, Case, When, IntegerField
from django.utils import timezone
from datetime import date, datetime, timedelta
from .models import StudentAttendance, FacultyAttendance
from .permissions import CanViewAttendanceReports
from academics.models import Course, Department, Semester
from students.models import Student
from instructors.models import Instructor
from coordinators.models import Coordinator
from hods.models import HOD

@api_view(['GET'])
@permission_classes([CanViewAttendanceReports])
def get_department_attendance_reports(request):
    """Enhanced department-wise attendance reports for coordinators and HODs"""
    user = request.user
    
    # Get parameters
    date_from = request.GET.get('date_from', str(date.today() - timedelta(days=30)))
    date_to = request.GET.get('date_to', str(date.today()))
    report_type = request.GET.get('report_type', 'summary')  # summary, detailed, analytics
    
    # Determine user's department
    department = None
    user_role = None
    
    if hasattr(user, 'coordinator_profile'):
        department = user.coordinator_profile.department
        user_role = 'coordinator'
    elif hasattr(user, 'hod_profile'):
        department = user.hod_profile.department
        user_role = 'hod'
    elif user.is_superuser or user.role == 'admin' or hasattr(user, 'principal_profile'):
        # Principal/Admin can view all departments
        department_id = request.GET.get('department_id')
        if department_id:
            try:
                department = Department.objects.get(id=department_id)
            except Department.DoesNotExist:
                return Response({'error': 'Department not found'}, status=404)
        user_role = 'admin'
    else:
        return Response({'error': 'Unauthorized access'}, status=403)
    
    # Base filters
    filters = {
        'date__gte': date_from,
        'date__lte': date_to
    }
    
    if department:
        # Get student attendance for the department
        student_attendance = StudentAttendance.objects.filter(
            course__semester__department=department,
            **filters
        ).select_related('student', 'course', 'instructor')
        
        # Get faculty attendance for the department
        faculty_attendance = FacultyAttendance.objects.filter(
            Q(instructor__department=department) |
            Q(coordinator__department=department) |
            Q(hod__department=department),
            **filters
        )
    else:
        # Admin view - all departments
        student_attendance = StudentAttendance.objects.filter(**filters).select_related('student', 'course', 'instructor')
        faculty_attendance = FacultyAttendance.objects.filter(**filters)
    
    if report_type == 'summary':
        return _get_summary_report(student_attendance, faculty_attendance, department, date_from, date_to, user_role)
    elif report_type == 'detailed':
        return _get_detailed_report(student_attendance, faculty_attendance, department, date_from, date_to, user_role)
    elif report_type == 'analytics':
        return _get_analytics_report(student_attendance, faculty_attendance, department, date_from, date_to, user_role)
    else:
        return Response({'error': 'Invalid report type'}, status=400)

def _get_summary_report(student_attendance, faculty_attendance, department, date_from, date_to, user_role):
    """Generate summary attendance report"""
    
    # Student statistics
    total_student_records = student_attendance.count()
    present_students = student_attendance.filter(status='Present').count()
    absent_students = student_attendance.filter(status='Absent').count()
    late_students = student_attendance.filter(status='Late').count()
    
    # Faculty statistics
    total_faculty_records = faculty_attendance.count()
    present_faculty = faculty_attendance.filter(status='Present').count()
    absent_faculty = faculty_attendance.filter(status='Absent').count()
    late_faculty = faculty_attendance.filter(status='Late').count()
    
    # Course-wise breakdown
    course_stats = {}
    for attendance in student_attendance:
        course_key = f"{attendance.course.code} - {attendance.course.name}"
        if course_key not in course_stats:
            course_stats[course_key] = {
                'total': 0,
                'present': 0,
                'absent': 0,
                'late': 0,
                'attendance_rate': 0
            }
        
        course_stats[course_key]['total'] += 1
        course_stats[course_key][attendance.status.lower()] += 1
    
    # Calculate attendance rates for courses
    for course_key in course_stats:
        total = course_stats[course_key]['total']
        present = course_stats[course_key]['present']
        course_stats[course_key]['attendance_rate'] = (present / total * 100) if total > 0 else 0
    
    # Faculty type breakdown
    faculty_type_stats = {
        'instructors': {'total': 0, 'present': 0, 'absent': 0, 'late': 0},
        'coordinators': {'total': 0, 'present': 0, 'absent': 0, 'late': 0},
        'hods': {'total': 0, 'present': 0, 'absent': 0, 'late': 0}
    }
    
    for attendance in faculty_attendance:
        if attendance.instructor:
            faculty_type_stats['instructors']['total'] += 1
            faculty_type_stats['instructors'][attendance.status.lower()] += 1
        elif attendance.coordinator:
            faculty_type_stats['coordinators']['total'] += 1
            faculty_type_stats['coordinators'][attendance.status.lower()] += 1
        elif attendance.hod:
            faculty_type_stats['hods']['total'] += 1
            faculty_type_stats['hods'][attendance.status.lower()] += 1
    
    return Response({
        'report_type': 'summary',
        'department': {
            'id': department.id if department else None,
            'name': department.name if department else 'All Departments',
            'code': department.code if department else 'ALL'
        },
        'date_range': {
            'from': date_from,
            'to': date_to
        },
        'user_role': user_role,
        'student_statistics': {
            'total_records': total_student_records,
            'present': present_students,
            'absent': absent_students,
            'late': late_students,
            'attendance_rate': (present_students / total_student_records * 100) if total_student_records > 0 else 0
        },
        'faculty_statistics': {
            'total_records': total_faculty_records,
            'present': present_faculty,
            'absent': absent_faculty,
            'late': late_faculty,
            'attendance_rate': (present_faculty / total_faculty_records * 100) if total_faculty_records > 0 else 0
        },
        'course_breakdown': course_stats,
        'faculty_type_breakdown': faculty_type_stats
    })

def _get_detailed_report(student_attendance, faculty_attendance, department, date_from, date_to, user_role):
    """Generate detailed attendance report with individual records"""
    
    # Student detailed records
    student_records = []
    for attendance in student_attendance.order_by('-date', 'student__name'):
        student_records.append({
            'student_id': attendance.student.student_id,
            'student_name': attendance.student.name,
            'course_code': attendance.course.code,
            'course_name': attendance.course.name,
            'instructor_name': attendance.instructor.name,
            'date': attendance.date.strftime('%Y-%m-%d'),
            'status': attendance.status,
            'marked_at': attendance.marked_at.strftime('%Y-%m-%d %H:%M:%S') if attendance.marked_at else None,
            'is_locked': attendance.is_locked
        })
    
    # Faculty detailed records
    faculty_records = []
    for attendance in faculty_attendance.order_by('-date'):
        faculty_records.append({
            'faculty_name': attendance.get_faculty_name(),
            'faculty_type': attendance.get_faculty_type(),
            'department': attendance.get_department().name if attendance.get_department() else None,
            'date': attendance.date.strftime('%Y-%m-%d'),
            'status': attendance.status,
            'auto_marked': attendance.auto_marked,
            'self_marked': attendance.self_marked,
            'marked_at': attendance.marked_at.strftime('%Y-%m-%d %H:%M:%S') if attendance.marked_at else None,
            'is_locked': attendance.is_locked
        })
    
    return Response({
        'report_type': 'detailed',
        'department': {
            'id': department.id if department else None,
            'name': department.name if department else 'All Departments',
            'code': department.code if department else 'ALL'
        },
        'date_range': {
            'from': date_from,
            'to': date_to
        },
        'user_role': user_role,
        'student_records': student_records,
        'faculty_records': faculty_records,
        'total_student_records': len(student_records),
        'total_faculty_records': len(faculty_records)
    })

def _get_analytics_report(student_attendance, faculty_attendance, department, date_from, date_to, user_role):
    """Generate analytics report with trends and insights"""
    
    # Daily attendance trends
    daily_trends = {}
    
    # Student daily trends
    for attendance in student_attendance:
        date_str = attendance.date.strftime('%Y-%m-%d')
        if date_str not in daily_trends:
            daily_trends[date_str] = {
                'date': date_str,
                'students': {'total': 0, 'present': 0, 'absent': 0, 'late': 0},
                'faculty': {'total': 0, 'present': 0, 'absent': 0, 'late': 0}
            }
        
        daily_trends[date_str]['students']['total'] += 1
        daily_trends[date_str]['students'][attendance.status.lower()] += 1
    
    # Faculty daily trends
    for attendance in faculty_attendance:
        date_str = attendance.date.strftime('%Y-%m-%d')
        if date_str not in daily_trends:
            daily_trends[date_str] = {
                'date': date_str,
                'students': {'total': 0, 'present': 0, 'absent': 0, 'late': 0},
                'faculty': {'total': 0, 'present': 0, 'absent': 0, 'late': 0}
            }
        
        daily_trends[date_str]['faculty']['total'] += 1
        daily_trends[date_str]['faculty'][attendance.status.lower()] += 1
    
    # Calculate daily attendance rates
    for date_str in daily_trends:
        student_total = daily_trends[date_str]['students']['total']
        student_present = daily_trends[date_str]['students']['present']
        faculty_total = daily_trends[date_str]['faculty']['total']
        faculty_present = daily_trends[date_str]['faculty']['present']
        
        daily_trends[date_str]['students']['attendance_rate'] = (student_present / student_total * 100) if student_total > 0 else 0
        daily_trends[date_str]['faculty']['attendance_rate'] = (faculty_present / faculty_total * 100) if faculty_total > 0 else 0
    
    # Top performing courses
    course_performance = {}
    for attendance in student_attendance:
        course_key = f"{attendance.course.code} - {attendance.course.name}"
        if course_key not in course_performance:
            course_performance[course_key] = {'total': 0, 'present': 0}
        
        course_performance[course_key]['total'] += 1
        if attendance.status == 'Present':
            course_performance[course_key]['present'] += 1
    
    # Calculate course attendance rates and sort
    for course_key in course_performance:
        total = course_performance[course_key]['total']
        present = course_performance[course_key]['present']
        course_performance[course_key]['attendance_rate'] = (present / total * 100) if total > 0 else 0
    
    top_courses = sorted(course_performance.items(), key=lambda x: x[1]['attendance_rate'], reverse=True)[:5]
    low_courses = sorted(course_performance.items(), key=lambda x: x[1]['attendance_rate'])[:5]
    
    # Faculty performance insights
    faculty_performance = {}
    for attendance in faculty_attendance:
        faculty_name = attendance.get_faculty_name()
        if faculty_name not in faculty_performance:
            faculty_performance[faculty_name] = {
                'total': 0,
                'present': 0,
                'auto_marked': 0,
                'self_marked': 0,
                'type': attendance.get_faculty_type()
            }
        
        faculty_performance[faculty_name]['total'] += 1
        if attendance.status == 'Present':
            faculty_performance[faculty_name]['present'] += 1
        if attendance.auto_marked:
            faculty_performance[faculty_name]['auto_marked'] += 1
        if attendance.self_marked:
            faculty_performance[faculty_name]['self_marked'] += 1
    
    # Calculate faculty attendance rates
    for faculty_name in faculty_performance:
        total = faculty_performance[faculty_name]['total']
        present = faculty_performance[faculty_name]['present']
        faculty_performance[faculty_name]['attendance_rate'] = (present / total * 100) if total > 0 else 0
    
    return Response({
        'report_type': 'analytics',
        'department': {
            'id': department.id if department else None,
            'name': department.name if department else 'All Departments',
            'code': department.code if department else 'ALL'
        },
        'date_range': {
            'from': date_from,
            'to': date_to
        },
        'user_role': user_role,
        'daily_trends': sorted(daily_trends.values(), key=lambda x: x['date']),
        'course_performance': {
            'top_performing': [{'course': k, **v} for k, v in top_courses],
            'low_performing': [{'course': k, **v} for k, v in low_courses]
        },
        'faculty_performance': faculty_performance,
        'insights': {
            'total_days_analyzed': len(daily_trends),
            'avg_student_attendance': sum(d['students']['attendance_rate'] for d in daily_trends.values()) / len(daily_trends) if daily_trends else 0,
            'avg_faculty_attendance': sum(d['faculty']['attendance_rate'] for d in daily_trends.values()) / len(daily_trends) if daily_trends else 0,
            'most_active_day': max(daily_trends.items(), key=lambda x: x[1]['students']['total'] + x[1]['faculty']['total'])[0] if daily_trends else None,
            'least_active_day': min(daily_trends.items(), key=lambda x: x[1]['students']['total'] + x[1]['faculty']['total'])[0] if daily_trends else None
        }
    })

@api_view(['GET'])
@permission_classes([CanViewAttendanceReports])
def get_student_attendance_details(request):
    """Get detailed attendance for specific students"""
    user = request.user
    student_id = request.GET.get('student_id')
    course_id = request.GET.get('course_id')
    date_from = request.GET.get('date_from', str(date.today() - timedelta(days=30)))
    date_to = request.GET.get('date_to', str(date.today()))
    
    # Check permissions
    department = None
    if hasattr(user, 'coordinator_profile'):
        department = user.coordinator_profile.department
    elif hasattr(user, 'hod_profile'):
        department = user.hod_profile.department
    elif not (user.is_superuser or user.role == 'admin' or hasattr(user, 'principal_profile')):
        return Response({'error': 'Unauthorized access'}, status=403)
    
    # Build filters
    filters = {
        'date__gte': date_from,
        'date__lte': date_to
    }
    
    if student_id:
        filters['student__student_id'] = student_id
    if course_id:
        filters['course_id'] = course_id
    if department:
        filters['course__semester__department'] = department
    
    # Get attendance records
    attendance_records = StudentAttendance.objects.filter(**filters).select_related(
        'student', 'course', 'instructor'
    ).order_by('-date')
    
    # Format response
    records = []
    for record in attendance_records:
        records.append({
            'id': record.id,
            'student_id': record.student.student_id,
            'student_name': record.student.name,
            'course_code': record.course.code,
            'course_name': record.course.name,
            'instructor_name': record.instructor.name,
            'date': record.date.strftime('%Y-%m-%d'),
            'status': record.status,
            'marked_at': record.marked_at.strftime('%Y-%m-%d %H:%M:%S') if record.marked_at else None,
            'is_locked': record.is_locked
        })
    
    return Response({
        'records': records,
        'total_records': len(records),
        'filters_applied': {
            'student_id': student_id,
            'course_id': course_id,
            'date_from': date_from,
            'date_to': date_to,
            'department': department.name if department else None
        }
    })

@api_view(['GET'])
@permission_classes([CanViewAttendanceReports])
def get_faculty_attendance_details(request):
    """Get detailed attendance for specific faculty"""
    user = request.user
    faculty_type = request.GET.get('faculty_type')  # instructor, coordinator, hod
    faculty_id = request.GET.get('faculty_id')
    date_from = request.GET.get('date_from', str(date.today() - timedelta(days=30)))
    date_to = request.GET.get('date_to', str(date.today()))
    
    # Check permissions
    department = None
    if hasattr(user, 'coordinator_profile'):
        department = user.coordinator_profile.department
    elif hasattr(user, 'hod_profile'):
        department = user.hod_profile.department
    elif not (user.is_superuser or user.role == 'admin' or hasattr(user, 'principal_profile')):
        return Response({'error': 'Unauthorized access'}, status=403)
    
    # Build filters
    filters = {
        'date__gte': date_from,
        'date__lte': date_to
    }
    
    if faculty_type and faculty_id:
        if faculty_type == 'instructor':
            filters['instructor_id'] = faculty_id
        elif faculty_type == 'coordinator':
            filters['coordinator_id'] = faculty_id
        elif faculty_type == 'hod':
            filters['hod_id'] = faculty_id
    
    if department:
        filters = {
            **filters,
            **{
                f'{faculty_type}__department': department
            }
        } if faculty_type else filters
    
    # Get attendance records
    attendance_records = FacultyAttendance.objects.filter(**filters).order_by('-date')
    
    # Format response
    records = []
    for record in attendance_records:
        records.append({
            'id': record.id,
            'faculty_name': record.get_faculty_name(),
            'faculty_type': record.get_faculty_type(),
            'department': record.get_department().name if record.get_department() else None,
            'date': record.date.strftime('%Y-%m-%d'),
            'status': record.status,
            'auto_marked': record.auto_marked,
            'self_marked': record.self_marked,
            'marked_at': record.marked_at.strftime('%Y-%m-%d %H:%M:%S') if record.marked_at else None,
            'is_locked': record.is_locked
        })
    
    return Response({
        'records': records,
        'total_records': len(records),
        'filters_applied': {
            'faculty_type': faculty_type,
            'faculty_id': faculty_id,
            'date_from': date_from,
            'date_to': date_to,
            'department': department.name if department else None
        }
    })