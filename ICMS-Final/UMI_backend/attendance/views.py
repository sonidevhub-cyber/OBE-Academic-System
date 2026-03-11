from rest_framework import status, viewsets, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .permissions import IsInstructorOrAdmin, IsFacultyOrAdmin, IsAdminOrReadOnly, CanViewAttendanceReports
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q, Count, Avg
from datetime import date, datetime, timedelta
from .models import StudentAttendance, FacultyAttendance, AttendanceEditRequest
from .serializers import StudentAttendanceSerializer, FacultyAttendanceSerializer, AttendanceEditRequestSerializer
from academics.models import Timetable, Course, Department
from students.models import Student
from instructors.models import Instructor
from coordinators.models import Coordinator
from hods.models import HOD

class AttendanceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'instructor_profile'):
            return StudentAttendance.objects.filter(instructor=user.instructor_profile)
        elif hasattr(user, 'coordinator_profile'):
            return StudentAttendance.objects.filter(
                course__semester__department=user.coordinator_profile.department
            )
        elif hasattr(user, 'hod_profile'):
            return StudentAttendance.objects.filter(
                course__semester__department=user.hod_profile.department
            )
        elif user.is_superuser or user.role == 'admin' or hasattr(user, 'principal_profile'):
            return StudentAttendance.objects.all()
        return StudentAttendance.objects.none()
    
    def get_serializer_class(self):
        return StudentAttendanceSerializer

@api_view(['POST'])
@permission_classes([IsInstructorOrAdmin])
def mark_class_attendance(request):
    """Instructor marks attendance for assigned class"""
    user = request.user
    
    if not hasattr(user, 'instructor_profile'):
        return Response({'error': 'Only instructors can mark attendance'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    instructor = user.instructor_profile
    timetable_id = request.data.get('timetable_id')
    attendance_data = request.data.get('attendance_data', [])
    attendance_date = request.data.get('date', str(date.today()))
    
    try:
        timetable = get_object_or_404(Timetable, timetable_id=timetable_id, instructor=instructor)
        
        # Check if attendance already marked and locked
        existing_attendance = StudentAttendance.objects.filter(
            timetable=timetable, 
            date=attendance_date
        ).first()
        
        if existing_attendance and existing_attendance.is_locked:
            return Response({'error': 'Attendance already locked for this class'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        marked_students = []
        
        for student_data in attendance_data:
            student_id = student_data.get('student_id')
            attendance_status = student_data.get('status', 'Present')
            
            student = get_object_or_404(Student, student_id=student_id)
            
            # Create or update attendance
            attendance, created = StudentAttendance.objects.update_or_create(
                student=student,
                timetable=timetable,
                date=attendance_date,
                defaults={
                    'course': timetable.course,
                    'instructor': instructor,
                    'status': attendance_status,
                    'is_locked': True  # Lock after marking
                }
            )
            marked_students.append({
                'student_name': student.name,
                'status': attendance_status,
                'created': created
            })
        
        # Auto-mark instructor attendance when marking student attendance
        faculty_attendance, created = FacultyAttendance.objects.update_or_create(
            instructor=instructor,
            date=attendance_date,
            defaults={
                'status': 'Present',
                'auto_marked': True,
                'is_locked': True
            }
        )
        
        return Response({
            'message': 'Attendance marked successfully',
            'marked_students': marked_students,
            'instructor_auto_marked': created,
            'total_marked': len(marked_students)
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsInstructorOrAdmin])
def get_instructor_classes(request):
    """Get instructor's assigned classes from timetable"""
    user = request.user
    
    if not hasattr(user, 'instructor_profile'):
        return Response({'error': 'Only instructors can access this'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    instructor = user.instructor_profile
    today = date.today()
    current_day = today.strftime('%A').lower()
    
    # Get today's classes
    today_classes = Timetable.objects.filter(
        instructor=instructor,
        day=current_day,
        approval_status='approved'
    ).select_related('course', 'course__semester')
    
    # Get all classes
    all_classes = Timetable.objects.filter(
        instructor=instructor,
        approval_status='approved'
    ).select_related('course', 'course__semester')
    
    today_data = []
    for timetable in today_classes:
        # Check if attendance already marked
        attendance_marked = StudentAttendance.objects.filter(
            timetable=timetable,
            date=today
        ).exists()
        
        # Get students in this class
        students = Student.objects.filter(
            semester=timetable.course.semester,
            is_active=True
        )
        
        today_data.append({
            'timetable_id': timetable.timetable_id,
            'course_name': timetable.course.name,
            'course_code': timetable.course.code,
            'semester': timetable.course.semester.name,
            'start_time': timetable.start_time,
            'end_time': timetable.end_time,
            'room': timetable.room,
            'attendance_marked': attendance_marked,
            'student_count': students.count(),
            'students': [{'student_id': s.student_id, 'name': s.name} for s in students]
        })
    
    all_data = []
    for timetable in all_classes:
        students = Student.objects.filter(
            semester=timetable.course.semester,
            is_active=True
        )
        
        all_data.append({
            'timetable_id': timetable.timetable_id,
            'course_name': timetable.course.name,
            'course_code': timetable.course.code,
            'semester': timetable.course.semester.name,
            'day': timetable.day,
            'start_time': timetable.start_time,
            'end_time': timetable.end_time,
            'room': timetable.room,
            'student_count': students.count()
        })
    
    return Response({
        'today_classes': today_data,
        'all_classes': all_data,
        'instructor_name': instructor.name
    })

@api_view(['POST'])
@permission_classes([IsFacultyOrAdmin])
def mark_self_attendance(request):
    """Faculty members mark their own attendance"""
    user = request.user
    attendance_date = request.data.get('date', str(date.today()))
    attendance_status = request.data.get('status', 'Present')
    
    faculty_type = None
    faculty_obj = None
    
    if hasattr(user, 'instructor_profile'):
        faculty_type = 'instructor'
        faculty_obj = user.instructor_profile
    elif hasattr(user, 'coordinator_profile'):
        faculty_type = 'coordinator'
        faculty_obj = user.coordinator_profile
    elif hasattr(user, 'hod_profile'):
        faculty_type = 'hod'
        faculty_obj = user.hod_profile
    else:
        return Response({'error': 'Only faculty members can mark self attendance'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        # Check if already marked and locked
        existing_attendance = FacultyAttendance.objects.filter(
            **{faculty_type: faculty_obj},
            date=attendance_date
        ).first()
        
        if existing_attendance and existing_attendance.is_locked and existing_attendance.auto_marked:
            return Response({'error': 'Attendance already auto-marked and locked'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Create or update attendance
        attendance, created = FacultyAttendance.objects.update_or_create(
            **{faculty_type: faculty_obj},
            date=attendance_date,
            defaults={
                'status': attendance_status,
                'self_marked': True,
                'is_locked': True
            }
        )
        
        return Response({
            'message': 'Self attendance marked successfully',
            'faculty_name': faculty_obj.name,
            'status': attendance_status,
            'date': attendance_date,
            'created': created
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([CanViewAttendanceReports])
def get_attendance_reports(request):
    """Get attendance reports based on user role"""
    user = request.user
    department_filter = request.GET.get('department')
    date_from = request.GET.get('date_from')
    date_to = request.GET.get('date_to')
    
    # Base filters
    filters = {}
    if date_from:
        filters['date__gte'] = date_from
    if date_to:
        filters['date__lte'] = date_to
    
    if hasattr(user, 'coordinator_profile'):
        # Coordinator sees own department
        department = user.coordinator_profile.department
        
        student_attendance = StudentAttendance.objects.filter(
            course__semester__department=department,
            **filters
        ).select_related('student', 'course', 'instructor')
        
        faculty_attendance = FacultyAttendance.objects.filter(
            Q(instructor__department=department) |
            Q(coordinator__department=department) |
            Q(hod__department=department),
            **filters
        )
        
    elif hasattr(user, 'hod_profile'):
        # HOD sees own department
        department = user.hod_profile.department
        
        student_attendance = StudentAttendance.objects.filter(
            course__semester__department=department,
            **filters
        ).select_related('student', 'course', 'instructor')
        
        faculty_attendance = FacultyAttendance.objects.filter(
            Q(instructor__department=department) |
            Q(coordinator__department=department) |
            Q(hod__department=department),
            **filters
        )
        
    elif user.is_superuser or user.role == 'admin' or hasattr(user, 'principal_profile'):
        # Principal/Admin sees all departments
        student_filters = filters.copy()
        faculty_filters = filters.copy()
        
        if department_filter:
            student_filters['course__semester__department_id'] = department_filter
            faculty_attendance = FacultyAttendance.objects.filter(
                Q(instructor__department_id=department_filter) |
                Q(coordinator__department_id=department_filter) |
                Q(hod__department_id=department_filter),
                **filters
            )
        else:
            faculty_attendance = FacultyAttendance.objects.filter(**filters)
        
        student_attendance = StudentAttendance.objects.filter(**student_filters).select_related('student', 'course', 'instructor')
        
    else:
        return Response({'error': 'Unauthorized access'}, status=status.HTTP_403_FORBIDDEN)
    
    # Serialize data
    student_data = StudentAttendanceSerializer(student_attendance, many=True).data
    faculty_data = FacultyAttendanceSerializer(faculty_attendance, many=True).data
    
    # Calculate statistics
    total_students = student_attendance.count()
    present_students = student_attendance.filter(status='Present').count()
    absent_students = student_attendance.filter(status='Absent').count()
    
    total_faculty = faculty_attendance.count()
    present_faculty = faculty_attendance.filter(status='Present').count()
    absent_faculty = faculty_attendance.filter(status='Absent').count()
    
    return Response({
        'student_attendance': student_data,
        'faculty_attendance': faculty_data,
        'statistics': {
            'students': {
                'total': total_students,
                'present': present_students,
                'absent': absent_students,
                'percentage': (present_students / total_students * 100) if total_students > 0 else 0
            },
            'faculty': {
                'total': total_faculty,
                'present': present_faculty,
                'absent': absent_faculty,
                'percentage': (present_faculty / total_faculty * 100) if total_faculty > 0 else 0
            }
        }
    })

@api_view(['POST'])
@permission_classes([IsFacultyOrAdmin])
def request_attendance_edit(request):
    """Faculty request to edit attendance"""
    user = request.user
    request_type = request.data.get('request_type')  # 'student' or 'faculty'
    attendance_id = request.data.get('attendance_id')
    reason = request.data.get('reason')
    proposed_status = request.data.get('proposed_status')
    
    if not all([request_type, attendance_id, reason, proposed_status]):
        return Response({'error': 'Missing required fields'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    try:
        edit_request_data = {
            'request_type': request_type,
            'requested_by': user,
            'reason': reason,
            'proposed_status': proposed_status
        }
        
        if request_type == 'student':
            attendance = get_object_or_404(StudentAttendance, pk=attendance_id)
            edit_request_data['student_attendance'] = attendance
        else:
            attendance = get_object_or_404(FacultyAttendance, pk=attendance_id)
            edit_request_data['faculty_attendance'] = attendance
        
        edit_request = AttendanceEditRequest.objects.create(**edit_request_data)
        
        return Response({
            'message': 'Edit request submitted successfully',
            'request_id': edit_request.id
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'POST'])
@permission_classes([IsAdminOrReadOnly])
def manage_edit_requests(request):
    """Admin manages attendance edit requests"""
    user = request.user
    
    if not (user.is_superuser or user.role == 'admin'):
        return Response({'error': 'Only admins can manage edit requests'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    if request.method == 'GET':
        # Get pending requests
        requests = AttendanceEditRequest.objects.filter(status='pending')
        serializer = AttendanceEditRequestSerializer(requests, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        # Approve/Reject request
        request_id = request.data.get('request_id')
        action = request.data.get('action')  # 'approve' or 'reject'
        admin_notes = request.data.get('admin_notes', '')
        
        try:
            edit_request = get_object_or_404(AttendanceEditRequest, pk=request_id)
            
            if action == 'approve':
                edit_request.status = 'approved'
                edit_request.reviewed_by = user
                edit_request.reviewed_at = timezone.now()
                edit_request.admin_notes = admin_notes
                
                # Update the actual attendance record
                if edit_request.request_type == 'student':
                    attendance = edit_request.student_attendance
                else:
                    attendance = edit_request.faculty_attendance
                
                attendance.status = edit_request.proposed_status
                attendance.is_locked = False  # Unlock for edit
                attendance.save()
                attendance.is_locked = True  # Lock again after edit
                attendance.save()
                
            elif action == 'reject':
                edit_request.status = 'rejected'
                edit_request.reviewed_by = user
                edit_request.reviewed_at = timezone.now()
                edit_request.admin_notes = admin_notes
            
            edit_request.save()
            
            return Response({
                'message': f'Request {action}d successfully',
                'request_id': request_id
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsFacultyOrAdmin])
def get_faculty_attendance_summary(request):
    """Get faculty's own attendance summary"""
    user = request.user
    
    faculty_type = None
    faculty_obj = None
    
    if hasattr(user, 'instructor_profile'):
        faculty_type = 'instructor'
        faculty_obj = user.instructor_profile
    elif hasattr(user, 'coordinator_profile'):
        faculty_type = 'coordinator'
        faculty_obj = user.coordinator_profile
    elif hasattr(user, 'hod_profile'):
        faculty_type = 'hod'
        faculty_obj = user.hod_profile
    else:
        return Response({'error': 'Only faculty members can access this'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    # Get attendance records
    attendance_records = FacultyAttendance.objects.filter(
        **{faculty_type: faculty_obj}
    ).order_by('-date')
    
    # Calculate statistics
    total_days = attendance_records.count()
    present_days = attendance_records.filter(status='Present').count()
    absent_days = attendance_records.filter(status='Absent').count()
    auto_marked = attendance_records.filter(auto_marked=True).count()
    self_marked = attendance_records.filter(self_marked=True).count()
    
    serializer = FacultyAttendanceSerializer(attendance_records, many=True)
    
    return Response({
        'attendance_records': serializer.data,
        'statistics': {
            'total_days': total_days,
            'present_days': present_days,
            'absent_days': absent_days,
            'auto_marked': auto_marked,
            'self_marked': self_marked,
            'attendance_percentage': (present_days / total_days * 100) if total_days > 0 else 0
        },
        'faculty_name': faculty_obj.name,
        'faculty_type': faculty_type.title()
    })

@api_view(['GET'])
@permission_classes([CanViewAttendanceReports])
def get_department_attendance_summary(request):
    """Get department-wise attendance summary for coordinators/HODs"""
    user = request.user
    date_from = request.GET.get('date_from', str(date.today() - timedelta(days=30)))
    date_to = request.GET.get('date_to', str(date.today()))
    
    department = None
    if hasattr(user, 'coordinator_profile'):
        department = user.coordinator_profile.department
    elif hasattr(user, 'hod_profile'):
        department = user.hod_profile.department
    else:
        return Response({'error': 'Only coordinators and HODs can access this'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    # Get student attendance for department
    student_attendance = StudentAttendance.objects.filter(
        course__semester__department=department,
        date__gte=date_from,
        date__lte=date_to
    ).select_related('student', 'course')
    
    # Get faculty attendance for department
    faculty_attendance = FacultyAttendance.objects.filter(
        Q(instructor__department=department) |
        Q(coordinator__department=department) |
        Q(hod__department=department),
        date__gte=date_from,
        date__lte=date_to
    )
    
    # Calculate course-wise statistics
    course_stats = {}
    for attendance in student_attendance:
        course_key = f"{attendance.course.code} - {attendance.course.name}"
        if course_key not in course_stats:
            course_stats[course_key] = {
                'total': 0,
                'present': 0,
                'absent': 0,
                'late': 0
            }
        
        course_stats[course_key]['total'] += 1
        course_stats[course_key][attendance.status.lower()] += 1
    
    # Calculate faculty statistics
    faculty_stats = {
        'total_records': faculty_attendance.count(),
        'present': faculty_attendance.filter(status='Present').count(),
        'absent': faculty_attendance.filter(status='Absent').count(),
        'late': faculty_attendance.filter(status='Late').count(),
        'auto_marked': faculty_attendance.filter(auto_marked=True).count(),
        'self_marked': faculty_attendance.filter(self_marked=True).count()
    }
    
    return Response({
        'department': {
            'name': department.name,
            'code': department.code
        },
        'date_range': {
            'from': date_from,
            'to': date_to
        },
        'course_statistics': course_stats,
        'faculty_statistics': faculty_stats,
        'total_student_records': student_attendance.count(),
        'student_present': student_attendance.filter(status='Present').count(),
        'student_absent': student_attendance.filter(status='Absent').count()
    })