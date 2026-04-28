from datetime import date, datetime, timedelta

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from academics.models import Course, Department, Timetable
from coordinators.models import Coordinator
from hods.models import HOD
from instructors.models import Instructor
from students.models import Student

from .models import AttendanceUpdateRequest, FacultyAttendance, StudentAttendance
from .serializers import AttendanceUpdateRequestSerializer


def _current_role(user):
    if hasattr(user, 'get_current_role'):
        return user.get_current_role()
    return getattr(user, 'active_role', None) or getattr(user, 'role', None)


def _has_role(user, role):
    if hasattr(user, 'has_role'):
        return user.has_role(role)
    return getattr(user, 'role', None) == role


def _is_admin_user(user):
    return bool(user.is_superuser or getattr(user, 'role', None) == 'admin' or _has_role(user, 'admin'))


def _is_principal_user(user):
    return bool(hasattr(user, 'principal_profile') or _has_role(user, 'principal'))


def _is_hod_user(user):
    return bool(hasattr(user, 'hod_profile') or _has_role(user, 'hod'))


def _is_coordinator_user(user):
    return bool(hasattr(user, 'coordinator_profile') or _has_role(user, 'coordinator'))


def _get_department_for_user(user):
    hod = _get_hod_for_user(user)
    if hod and hod.department:
        return hod.department
    coordinator = _get_coordinator_for_user(user)
    if coordinator and coordinator.department:
        return coordinator.department
    return None

def _get_instructor_for_user(user):
    if hasattr(user, 'instructor_profile'):
        return user.instructor_profile
    return Instructor.objects.filter(user=user).first()


def _get_coordinator_for_user(user):
    if hasattr(user, 'coordinator_profile'):
        return user.coordinator_profile
    return Coordinator.objects.filter(user=user).first()


def _get_hod_for_user(user):
    if hasattr(user, 'hod_profile'):
        return user.hod_profile
    return HOD.objects.filter(user=user).first()


def _get_student_for_user(user):
    student = Student.objects.filter(user=user).first()
    if student:
        return student
    return Student.objects.filter(email=user.email).first()


def _parse_date(value, default=None):
    if not value:
        return default or date.today()
    if isinstance(value, date):
        return value
    return datetime.strptime(str(value), '%Y-%m-%d').date()


def _get_period_bounds(period_days):
    end_date = date.today()
    start_date = end_date - timedelta(days=max(period_days, 1))
    previous_start = start_date - timedelta(days=max(period_days, 1))
    previous_end = start_date
    return start_date, end_date, previous_start, previous_end


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def instructor_classes(request):
    user = request.user
    if not (_current_role(user) == 'instructor' or _is_admin_user(user) or hasattr(user, 'instructor_profile')):
        return Response({'error': 'Only active instructor role can access classes'}, status=status.HTTP_403_FORBIDDEN)

    instructor = _get_instructor_for_user(user)
    if not instructor:
        return Response({'error': 'Instructor profile not found'}, status=status.HTTP_404_NOT_FOUND)

    attendance_date = _parse_date(request.GET.get('date'), default=date.today())
    current_day = attendance_date.strftime('%A').lower()
    now = timezone.localtime()

    timetables = Timetable.objects.filter(
        instructor=instructor,
        day=current_day,
        approval_status='approved'
    ).select_related('course__semester__department').order_by('start_time')

    today_classes = []
    for tt in timetables:
        semester = tt.course.semester
        students = Student.objects.filter(semester=semester).order_by('name')
        existing = StudentAttendance.objects.filter(timetable=tt, date=attendance_date).select_related('student')
        existing_map = {a.student_id: a for a in existing}

        approved_update = AttendanceUpdateRequest.objects.filter(
            requested_by=user,
            timetable=tt,
            attendance_date=attendance_date,
            status='approved'
        ).exists()

        student_payload = []
        for s in students:
            record = existing_map.get(s.student_id)
            student_payload.append({
                'student_id': s.student_id,
                'name': s.name,
                'email': s.email,
                'current_status': record.status if record else 'Present',
                'can_edit': bool(not existing.exists() or approved_update)
            })

        end_dt = now.replace(hour=tt.end_time.hour, minute=tt.end_time.minute, second=0, microsecond=0)
        mins_left = int((end_dt - now).total_seconds() // 60)

        today_classes.append({
            'timetable_id': tt.timetable_id,
            'course': {'name': tt.course.name, 'code': tt.course.code},
            'department': tt.course.semester.department.name if tt.course.semester and tt.course.semester.department else 'N/A',
            'semester': tt.course.semester.name if tt.course.semester else 'N/A',
            'section': tt.course.semester.name if tt.course.semester else 'N/A',
            'room': tt.room or 'TBA',
            'time_slot': f"{tt.start_time.strftime('%H:%M')} - {tt.end_time.strftime('%H:%M')}",
            'day': tt.day,
            'students': student_payload,
            'attendance_marked': existing.exists(),
            'is_submitted': existing.exists() and not approved_update,
            'time_remaining': mins_left
        })

    return Response({
        'today_classes': today_classes,
        'current_time': now.strftime('%H:%M'),
        'current_day': current_day.title(),
        'instructor_name': instructor.name
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_class(request):
    user = request.user
    if not (_current_role(user) == 'instructor' or _is_admin_user(user) or hasattr(user, 'instructor_profile')):
        return Response({'error': 'Only active instructor role can mark attendance'}, status=status.HTTP_403_FORBIDDEN)

    instructor = _get_instructor_for_user(user)
    if not instructor:
        return Response({'error': 'Instructor profile not found'}, status=status.HTTP_404_NOT_FOUND)

    timetable_id = request.data.get('timetable_id')
    attendance_data = request.data.get('attendance_data', [])
    attendance_date = _parse_date(request.data.get('date'), default=date.today())

    if not timetable_id or not isinstance(attendance_data, list) or len(attendance_data) == 0:
        return Response({'error': 'timetable_id and attendance_data are required'}, status=status.HTTP_400_BAD_REQUEST)

    timetable = get_object_or_404(Timetable, timetable_id=timetable_id, instructor=instructor, approval_status='approved')
    valid_students = set(Student.objects.filter(semester=timetable.course.semester).values_list('student_id', flat=True))

    existing_records = StudentAttendance.objects.filter(timetable=timetable, date=attendance_date)
    approved_update = AttendanceUpdateRequest.objects.filter(
        requested_by=user,
        timetable=timetable,
        attendance_date=attendance_date,
        status='approved'
    ).order_by('-created_at').first()

    if existing_records.exists() and not approved_update:
        return Response(
            {'error': 'Attendance already submitted for this class/date. Request admin approval for update.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    marked_students = []
    for item in attendance_data:
        student_id = str(item.get('student_id'))
        mark_status = item.get('status', 'Present')
        if student_id not in valid_students:
            return Response({'error': f'Student {student_id} is not assigned to this section'}, status=status.HTTP_400_BAD_REQUEST)

        student = get_object_or_404(Student, student_id=student_id)
        record, created = StudentAttendance.objects.update_or_create(
            student=student,
            timetable=timetable,
            date=attendance_date,
            defaults={
                'course': timetable.course,
                'instructor': instructor,
                'status': mark_status,
                'is_locked': True
            }
        )
        marked_students.append({
            'student_id': student.student_id,
            'student_name': student.name,
            'status': record.status,
            'created': created
        })

    FacultyAttendance.objects.update_or_create(
        instructor=instructor,
        date=attendance_date,
        defaults={'status': 'Present', 'auto_marked': True, 'is_locked': True}
    )

    if approved_update:
        approved_update.status = 'used'
        approved_update.reviewed_at = timezone.now()
        approved_update.save(update_fields=['status', 'reviewed_at', 'updated_at'])

    return Response({
        'message': 'Attendance submitted successfully',
        'course': timetable.course.name,
        'section': timetable.course.semester.name if timetable.course.semester else 'N/A',
        'date': attendance_date,
        'total_marked': len(marked_students),
        'updated_after_approval': bool(approved_update)
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_attendance_update(request):
    user = request.user
    if not (_current_role(user) == 'instructor' or _is_admin_user(user) or hasattr(user, 'instructor_profile')):
        return Response({'error': 'Only active instructor role can request attendance updates'}, status=status.HTTP_403_FORBIDDEN)

    instructor = _get_instructor_for_user(user)
    if not instructor:
        return Response({'error': 'Instructor profile not found'}, status=status.HTTP_404_NOT_FOUND)

    timetable_id = request.data.get('timetable_id')
    attendance_date = _parse_date(request.data.get('date'), default=date.today())
    reason = (request.data.get('reason') or '').strip()

    if not timetable_id or not reason:
        return Response({'error': 'timetable_id and reason are required'}, status=status.HTTP_400_BAD_REQUEST)

    timetable = get_object_or_404(Timetable, timetable_id=timetable_id, instructor=instructor, approval_status='approved')
    if not StudentAttendance.objects.filter(timetable=timetable, date=attendance_date).exists():
        return Response({'error': 'No submitted attendance found for this class/date'}, status=status.HTTP_400_BAD_REQUEST)

    existing_pending = AttendanceUpdateRequest.objects.filter(
        requested_by=user,
        timetable=timetable,
        attendance_date=attendance_date,
        status='pending'
    ).exists()
    if existing_pending:
        return Response({'error': 'An update request is already pending for this class/date'}, status=status.HTTP_400_BAD_REQUEST)

    req = AttendanceUpdateRequest.objects.create(
        requested_by=user,
        timetable=timetable,
        attendance_date=attendance_date,
        reason=reason,
        status='pending'
    )
    return Response({'message': 'Update request sent to HOD/Coordinator', 'request_id': req.id}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def instructor_update_requests(request):
    user = request.user
    qs = AttendanceUpdateRequest.objects.filter(requested_by=user).select_related('timetable__course__semester', 'timetable__instructor')
    return Response(AttendanceUpdateRequestSerializer(qs, many=True).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def admin_update_requests(request):
    user = request.user
    is_admin = _is_admin_user(user)
    is_principal = _is_principal_user(user)
    is_hod = _is_hod_user(user)
    is_coordinator = _is_coordinator_user(user)

    if not (is_hod or is_coordinator or is_admin or is_principal):
        return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    # Student attendance update requests are handled by HOD/Coordinator.
    if not (is_hod or is_coordinator):
        return Response({'error': 'Only HOD/Coordinator can manage class attendance update requests'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        status_filter = request.GET.get('status')
        qs = AttendanceUpdateRequest.objects.select_related('requested_by', 'timetable__course__semester', 'timetable__instructor')
        if status_filter:
            qs = qs.filter(status=status_filter)
        department = _get_department_for_user(user)
        if not department:
            return Response({'error': 'Department not found for reviewer'}, status=status.HTTP_400_BAD_REQUEST)
        qs = qs.filter(timetable__course__semester__department=department)
        return Response(AttendanceUpdateRequestSerializer(qs, many=True).data)

    request_id = request.data.get('request_id')
    action = request.data.get('action')
    admin_notes = request.data.get('admin_notes', '')
    if not request_id or action not in ['approve', 'reject']:
        return Response({'error': 'request_id and valid action are required'}, status=status.HTTP_400_BAD_REQUEST)

    req = get_object_or_404(AttendanceUpdateRequest, id=request_id)
    department = _get_department_for_user(user)
    if not department:
        return Response({'error': 'Department not found for reviewer'}, status=status.HTTP_400_BAD_REQUEST)
    if req.timetable.course.semester.department_id != department.department_id:
        return Response({'error': 'Forbidden: You can only manage requests in your department.'}, status=status.HTTP_403_FORBIDDEN)
    req.reviewed_by = user
    req.reviewed_at = timezone.now()
    req.admin_notes = admin_notes
    req.status = 'approved' if action == 'approve' else 'rejected'
    req.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'admin_notes', 'updated_at'])

    return Response({'message': f'Request {req.status} successfully'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_overview(request):
    user = request.user
    if _current_role(user) != 'student' and not _is_admin_user(user):
        return Response({'error': 'Only active student role can access attendance overview'}, status=status.HTTP_403_FORBIDDEN)

    student = _get_student_for_user(user)
    if not student:
        return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

    records = StudentAttendance.objects.filter(student=student).select_related('course').order_by('course__code', '-date')
    by_course = {}
    for rec in records:
        key = rec.course_id
        if key not in by_course:
            by_course[key] = {
                'course_id': rec.course_id,
                'course_code': rec.course.code,
                'course_name': rec.course.name,
                'section': rec.course.semester.name if rec.course.semester else 'N/A',
                'total_classes': 0,
                'present_classes': 0,
                'absent_classes': 0,
                'late_classes': 0,
            }
        by_course[key]['total_classes'] += 1
        if rec.status == 'Present':
            by_course[key]['present_classes'] += 1
        elif rec.status == 'Late':
            by_course[key]['late_classes'] += 1
        else:
            by_course[key]['absent_classes'] += 1

    subject_wise = []
    total_classes = 0
    attended_classes = 0
    for item in by_course.values():
        attended = item['present_classes'] + item['late_classes']
        pct = round((attended / item['total_classes'] * 100), 2) if item['total_classes'] else 0
        item['attendance_percentage'] = pct
        subject_wise.append(item)
        total_classes += item['total_classes']
        attended_classes += attended

    overall = round((attended_classes / total_classes * 100), 2) if total_classes else 0
    return Response({
        'student_id': student.student_id,
        'student_name': student.name,
        'subject_wise_attendance': sorted(subject_wise, key=lambda x: x['course_code']),
        'overall_attendance_percentage': overall,
        'overall': {
            'total_classes': total_classes,
            'attended_classes': attended_classes,
            'missed_classes': max(total_classes - attended_classes, 0)
        }
    })


def _department_student_records(department, start_date, end_date):
    qs = StudentAttendance.objects.filter(date__gte=start_date, date__lte=end_date)
    if department:
        qs = qs.filter(course__semester__department=department)
    return qs.select_related('student', 'course__semester__department', 'instructor')


def _department_faculty_records(department, start_date, end_date):
    qs = FacultyAttendance.objects.filter(date__gte=start_date, date__lte=end_date)
    if department:
        qs = qs.filter(
            Q(instructor__department=department) |
            Q(coordinator__department=department) |
            Q(hod__department=department)
        )
    return qs


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def coordinator_overview(request):
    user = request.user
    if not (_is_coordinator_user(user) or _is_admin_user(user)):
        return Response({'error': 'Only active coordinator role can access this view'}, status=status.HTTP_403_FORBIDDEN)

    coordinator = _get_coordinator_for_user(user)
    if not coordinator or not coordinator.department:
        return Response({'error': 'Coordinator department not found'}, status=status.HTTP_404_NOT_FOUND)

    target_date = _parse_date(request.GET.get('date'), default=date.today())
    records = StudentAttendance.objects.filter(
        course__semester__department=coordinator.department,
        date=target_date
    )
    total_today = records.count()
    present_today = records.filter(status__in=['Present', 'Late']).count()
    absent_today = records.filter(status='Absent').count()
    late_today = records.filter(status='Late').count()

    total_students = Student.objects.filter(semester__department=coordinator.department).count()

    return Response({
        'total_students': total_students,
        'present_today': present_today,
        'absent_today': absent_today,
        'late_today': late_today,
        'attendance_rate': round((present_today / total_today * 100), 2) if total_today else 0,
        'department_name': coordinator.department.name
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def coordinator_courses(request):
    user = request.user
    if not (_is_coordinator_user(user) or _is_admin_user(user)):
        return Response({'error': 'Only active coordinator role can access this view'}, status=status.HTTP_403_FORBIDDEN)

    coordinator = _get_coordinator_for_user(user)
    if not coordinator or not coordinator.department:
        return Response({'error': 'Coordinator department not found'}, status=status.HTTP_404_NOT_FOUND)

    start_date = _parse_date(request.GET.get('start_date'), default=date.today() - timedelta(days=30))
    end_date = _parse_date(request.GET.get('end_date'), default=date.today())
    records = _department_student_records(coordinator.department, start_date, end_date)

    data = {}
    for rec in records:
        key = rec.course_id
        if key not in data:
            data[key] = {
                'course_name': rec.course.name,
                'course_code': rec.course.code,
                'instructor_name': rec.instructor.name if rec.instructor else 'TBA',
                'total_classes': 0,
                'present_count': 0,
                'absent_count': 0,
                'late_count': 0,
            }
        data[key]['total_classes'] += 1
        if rec.status == 'Present':
            data[key]['present_count'] += 1
        elif rec.status == 'Late':
            data[key]['late_count'] += 1
        else:
            data[key]['absent_count'] += 1

    courses = []
    for entry in data.values():
        attended = entry['present_count'] + entry['late_count']
        entry['attendance_percentage'] = round((attended / entry['total_classes'] * 100), 2) if entry['total_classes'] else 0
        courses.append(entry)

    return Response({'courses': sorted(courses, key=lambda x: x['attendance_percentage'])})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def coordinator_faculty(request):
    user = request.user
    if not (_is_coordinator_user(user) or _is_admin_user(user)):
        return Response({'error': 'Only active coordinator role can access this view'}, status=status.HTTP_403_FORBIDDEN)

    coordinator = _get_coordinator_for_user(user)
    if not coordinator or not coordinator.department:
        return Response({'error': 'Coordinator department not found'}, status=status.HTTP_404_NOT_FOUND)

    start_date = _parse_date(request.GET.get('start_date'), default=date.today() - timedelta(days=30))
    end_date = _parse_date(request.GET.get('end_date'), default=date.today())
    records = _department_faculty_records(coordinator.department, start_date, end_date)

    grouped = {}
    for rec in records:
        if rec.instructor:
            key = f"instructor:{rec.instructor_id}"
            name = rec.instructor.name
            f_type = 'Instructor'
        elif rec.coordinator:
            key = f"coordinator:{rec.coordinator_id}"
            name = rec.coordinator.name
            f_type = 'Coordinator'
        else:
            key = f"hod:{rec.hod_id}"
            name = rec.hod.name
            f_type = 'HOD'

        if key not in grouped:
            grouped[key] = {
                'faculty_name': name,
                'faculty_type': f_type,
                'total_days': 0,
                'present_days': 0,
                'absent_days': 0,
                'last_attendance': rec.date
            }
        grouped[key]['total_days'] += 1
        if rec.status == 'Present':
            grouped[key]['present_days'] += 1
        else:
            grouped[key]['absent_days'] += 1
        if rec.date > grouped[key]['last_attendance']:
            grouped[key]['last_attendance'] = rec.date

    result = []
    for row in grouped.values():
        row['attendance_percentage'] = round((row['present_days'] / row['total_days'] * 100), 2) if row['total_days'] else 0
        row['last_attendance'] = row['last_attendance'].strftime('%Y-%m-%d')
        result.append(row)

    return Response({'faculty': sorted(result, key=lambda x: x['attendance_percentage'])})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def hod_stats(request):
    user = request.user
    if not (_is_hod_user(user) or _is_admin_user(user)):
        return Response({'error': 'Only active HOD role can access this view'}, status=status.HTTP_403_FORBIDDEN)

    hod = _get_hod_for_user(user)
    if not hod or not hod.department:
        return Response({'error': 'HOD department not found'}, status=status.HTTP_404_NOT_FOUND)

    period = int(request.GET.get('period', 30))
    start_date, end_date, prev_start, prev_end = _get_period_bounds(period)

    current_records = _department_student_records(hod.department, start_date, end_date)
    previous_records = _department_student_records(hod.department, prev_start, prev_end)

    current_total = current_records.count()
    current_present = current_records.filter(status__in=['Present', 'Late']).count()
    current_rate = round((current_present / current_total * 100), 2) if current_total else 0

    previous_total = previous_records.count()
    previous_present = previous_records.filter(status__in=['Present', 'Late']).count()
    previous_rate = round((previous_present / previous_total * 100), 2) if previous_total else 0

    today_records = _department_student_records(hod.department, date.today(), date.today())
    total_faculty = (
        Instructor.objects.filter(department=hod.department).count() +
        Coordinator.objects.filter(department=hod.department).count() +
        HOD.objects.filter(department=hod.department).count()
    )

    return Response({
        'department_name': hod.department.name,
        'total_students': Student.objects.filter(semester__department=hod.department).count(),
        'total_faculty': total_faculty,
        'average_attendance': current_rate,
        'courses_count': Course.objects.filter(semester__department=hod.department).count(),
        'today_present': today_records.filter(status__in=['Present', 'Late']).count(),
        'today_absent': today_records.filter(status='Absent').count(),
        'trend_percentage': round(current_rate - previous_rate, 2)
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def hod_courses(request):
    user = request.user
    if not (_is_hod_user(user) or _is_admin_user(user)):
        return Response({'error': 'Only active HOD role can access this view'}, status=status.HTTP_403_FORBIDDEN)

    hod = _get_hod_for_user(user)
    if not hod or not hod.department:
        return Response({'error': 'HOD department not found'}, status=status.HTTP_404_NOT_FOUND)

    period = int(request.GET.get('period', 30))
    start_date = date.today() - timedelta(days=max(period, 1))
    end_date = date.today()
    records = _department_student_records(hod.department, start_date, end_date)

    grouped = {}
    for rec in records:
        key = rec.course_id
        if key not in grouped:
            grouped[key] = {
                'course_name': rec.course.name,
                'course_code': rec.course.code,
                'instructor_name': rec.instructor.name if rec.instructor else 'TBA',
                'semester': rec.course.semester.name if rec.course.semester else 'N/A',
                'attendance_rate': 0,
                'total_classes': 0,
                'present_count': 0,
                'absent_count': 0,
                'trend': 'stable',
                'risk_level': 'low'
            }
        grouped[key]['total_classes'] += 1
        if rec.status in ['Present', 'Late']:
            grouped[key]['present_count'] += 1
        else:
            grouped[key]['absent_count'] += 1

    courses = []
    for row in grouped.values():
        rate = round((row['present_count'] / row['total_classes'] * 100), 2) if row['total_classes'] else 0
        row['attendance_rate'] = rate
        if rate < 60:
            row['risk_level'] = 'high'
            row['trend'] = 'down'
        elif rate < 75:
            row['risk_level'] = 'medium'
            row['trend'] = 'stable'
        else:
            row['risk_level'] = 'low'
            row['trend'] = 'up'
        courses.append(row)

    return Response({'courses': sorted(courses, key=lambda x: x['attendance_rate'])})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def hod_requests(request):
    user = request.user
    if not (_is_hod_user(user) or _is_admin_user(user)):
        return Response({'error': 'Only active HOD role can access this view'}, status=status.HTTP_403_FORBIDDEN)

    hod = _get_hod_for_user(user)
    if not hod or not hod.department:
        return Response({'error': 'HOD department not found'}, status=status.HTTP_404_NOT_FOUND)

    reqs = AttendanceUpdateRequest.objects.filter(
        timetable__course__semester__department=hod.department
    ).select_related('requested_by', 'timetable__course').order_by('-created_at')

    payload = []
    for req in reqs:
        payload.append({
            'id': req.id,
            'student_name': 'Class Attendance',
            'course_name': req.timetable.course.name,
            'current_status': 'Locked',
            'proposed_status': 'Unlock for edit',
            'reason': req.reason,
            'requested_by': req.requested_by.name or req.requested_by.username,
            'requested_at': req.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'status': req.status
        })

    return Response({'requests': payload})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def principal_overview(request):
    user = request.user
    if not (_is_principal_user(user) or _is_admin_user(user)):
        return Response({'error': 'Only principal/admin can access this view'}, status=status.HTTP_403_FORBIDDEN)

    period = int(request.GET.get('period', 30))
    start_date, end_date, prev_start, prev_end = _get_period_bounds(period)
    current_records = _department_student_records(None, start_date, end_date)
    previous_records = _department_student_records(None, prev_start, prev_end)

    current_total = current_records.count()
    current_present = current_records.filter(status__in=['Present', 'Late']).count()
    current_rate = round((current_present / current_total * 100), 2) if current_total else 0

    previous_total = previous_records.count()
    previous_present = previous_records.filter(status__in=['Present', 'Late']).count()
    previous_rate = round((previous_present / previous_total * 100), 2) if previous_total else 0

    today_records = _department_student_records(None, date.today(), date.today())

    return Response({
        'total_students': Student.objects.count(),
        'total_faculty': Instructor.objects.count() + Coordinator.objects.count() + HOD.objects.count(),
        'total_departments': Department.objects.count(),
        'overall_attendance_rate': current_rate,
        'today_present': today_records.filter(status__in=['Present', 'Late']).count(),
        'today_absent': today_records.filter(status='Absent').count(),
        'trend_percentage': round(current_rate - previous_rate, 2)
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def principal_departments(request):
    user = request.user
    if not (_is_principal_user(user) or _is_admin_user(user)):
        return Response({'error': 'Only principal/admin can access this view'}, status=status.HTTP_403_FORBIDDEN)

    period = int(request.GET.get('period', 30))
    start_date = date.today() - timedelta(days=max(period, 1))
    end_date = date.today()

    departments_payload = []
    for dept in Department.objects.all().order_by('name'):
        records = _department_student_records(dept, start_date, end_date)
        total = records.count()
        present = records.filter(status__in=['Present', 'Late']).count()
        rate = round((present / total * 100), 2) if total else 0
        if rate < 60:
            risk = 'high'
            trend = 'down'
        elif rate < 75:
            risk = 'medium'
            trend = 'stable'
        else:
            risk = 'low'
            trend = 'up'

        departments_payload.append({
            'department_name': dept.name,
            'department_code': dept.code,
            'student_count': Student.objects.filter(semester__department=dept).count(),
            'faculty_count': Instructor.objects.filter(department=dept).count() + Coordinator.objects.filter(department=dept).count() + HOD.objects.filter(department=dept).count(),
            'attendance_rate': rate,
            'courses_count': Course.objects.filter(semester__department=dept).count(),
            'trend': trend,
            'risk_level': risk
        })

    return Response({'departments': departments_payload})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def principal_performers(request):
    user = request.user
    if not (_is_principal_user(user) or _is_admin_user(user)):
        return Response({'error': 'Only principal/admin can access this view'}, status=status.HTTP_403_FORBIDDEN)

    period = int(request.GET.get('period', 30))
    start_date = date.today() - timedelta(days=max(period, 1))
    end_date = date.today()
    records = _department_student_records(None, start_date, end_date)

    dept_scores = []
    for dept in Department.objects.all():
        dept_records = records.filter(course__semester__department=dept)
        total = dept_records.count()
        present = dept_records.filter(status__in=['Present', 'Late']).count()
        rate = round((present / total * 100), 2) if total else 0
        dept_scores.append({'name': dept.name, 'attendance_rate': rate})
    dept_scores = sorted(dept_scores, key=lambda x: x['attendance_rate'], reverse=True)
    ranked_departments = [{'name': d['name'], 'attendance_rate': d['attendance_rate'], 'rank': i + 1} for i, d in enumerate(dept_scores[:5])]

    course_scores = []
    for course in Course.objects.select_related('semester__department'):
        course_records = records.filter(course=course)
        total = course_records.count()
        present = course_records.filter(status__in=['Present', 'Late']).count()
        rate = round((present / total * 100), 2) if total else 0
        instructor_name = course_records.first().instructor.name if course_records.exists() and course_records.first().instructor else 'TBA'
        course_scores.append({'name': course.name, 'code': course.code, 'attendance_rate': rate, 'instructor': instructor_name})
    top_courses = sorted(course_scores, key=lambda x: x['attendance_rate'], reverse=True)[:5]

    faculty_scores = []
    faculty_records = _department_faculty_records(None, start_date, end_date)
    by_faculty = {}
    for rec in faculty_records:
        if rec.instructor:
            key = f"instructor:{rec.instructor_id}"
            name = rec.instructor.name
            dept = rec.instructor.department.name if rec.instructor.department else 'N/A'
        elif rec.coordinator:
            key = f"coordinator:{rec.coordinator_id}"
            name = rec.coordinator.name
            dept = rec.coordinator.department.name if rec.coordinator.department else 'N/A'
        else:
            key = f"hod:{rec.hod_id}"
            name = rec.hod.name
            dept = rec.hod.department.name if rec.hod.department else 'N/A'
        if key not in by_faculty:
            by_faculty[key] = {'name': name, 'department': dept, 'total': 0, 'present': 0}
        by_faculty[key]['total'] += 1
        if rec.status == 'Present':
            by_faculty[key]['present'] += 1
    for row in by_faculty.values():
        rate = round((row['present'] / row['total'] * 100), 2) if row['total'] else 0
        faculty_scores.append({'name': row['name'], 'department': row['department'], 'attendance_rate': rate})
    top_faculty = sorted(faculty_scores, key=lambda x: x['attendance_rate'], reverse=True)[:5]

    return Response({
        'departments': ranked_departments,
        'courses': top_courses,
        'faculty': top_faculty
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def principal_insights(request):
    user = request.user
    if not (_is_principal_user(user) or _is_admin_user(user)):
        return Response({'error': 'Only principal/admin can access this view'}, status=status.HTTP_403_FORBIDDEN)

    period = int(request.GET.get('period', 30))
    start_date = date.today() - timedelta(days=max(period, 1))
    end_date = date.today()

    semester_rows = []
    semester_records = _department_student_records(None, start_date, end_date).select_related('course__semester__department')
    semester_map = {}
    for rec in semester_records:
        semester = rec.course.semester if rec.course else None
        if not semester:
            continue
        key = semester.id
        if key not in semester_map:
            semester_map[key] = {
                'semester_id': semester.id,
                'semester_name': semester.name,
                'department_name': semester.department.name if semester.department else 'N/A',
                'total_records': 0,
                'present_count': 0,
                'absent_count': 0
            }
        semester_map[key]['total_records'] += 1
        if rec.status in ['Present', 'Late']:
            semester_map[key]['present_count'] += 1
        elif rec.status == 'Absent':
            semester_map[key]['absent_count'] += 1

    for row in semester_map.values():
        rate = round((row['present_count'] / row['total_records'] * 100), 2) if row['total_records'] else 0
        row['attendance_rate'] = rate
        semester_rows.append(row)

    lowest_semesters = sorted(semester_rows, key=lambda x: x['attendance_rate'])[:8]

    faculty_records = FacultyAttendance.objects.filter(date__gte=start_date, date__lte=end_date).select_related(
        'instructor__department', 'coordinator__department', 'hod__department'
    )
    faculty_map = {}
    for rec in faculty_records:
        if rec.instructor:
            key = f"instructor:{rec.instructor_id}"
            name = rec.instructor.name
            role = 'Instructor'
            dept = rec.instructor.department.name if rec.instructor.department else 'N/A'
        elif rec.coordinator:
            key = f"coordinator:{rec.coordinator_id}"
            name = rec.coordinator.name
            role = 'Coordinator'
            dept = rec.coordinator.department.name if rec.coordinator.department else 'N/A'
        else:
            key = f"hod:{rec.hod_id}"
            name = rec.hod.name
            role = 'HOD'
            dept = rec.hod.department.name if rec.hod.department else 'N/A'

        if key not in faculty_map:
            faculty_map[key] = {
                'name': name,
                'role': role,
                'department': dept,
                'total_days': 0,
                'present_days': 0,
                'absent_days': 0
            }
        faculty_map[key]['total_days'] += 1
        if rec.status in ['Present', 'Late']:
            faculty_map[key]['present_days'] += 1
        elif rec.status == 'Absent':
            faculty_map[key]['absent_days'] += 1

    faculty_rows = []
    for row in faculty_map.values():
        rate = round((row['present_days'] / row['total_days'] * 100), 2) if row['total_days'] else 0
        row['attendance_rate'] = rate
        faculty_rows.append(row)

    lowest_faculty = sorted(faculty_rows, key=lambda x: x['attendance_rate'])[:10]

    return Response({
        'period_days': period,
        'lowest_semesters': lowest_semesters,
        'lowest_faculty': lowest_faculty
    })
