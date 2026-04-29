from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import Timetable, Course, Department, Semester
from instructors.models import Instructor
from students.models import Student
from register.models import User
from hods.models import HODRegistrationRequest, HOD
from django.db.models import Count
from django.utils import timezone


def _resolve_hod_department(hod_user):
    """Resolve the department for an authenticated HOD-style user."""
    hod_department = None
    hod_profile = HOD.objects.filter(user=hod_user, is_active=True).first()
    if hod_profile:
        return hod_profile.department

    try:
        hod_instructor = Instructor.objects.get(user=hod_user)
        hod_department = hod_instructor.department
    except Instructor.DoesNotExist:
        try:
            hod_request = HODRegistrationRequest.objects.get(
                employee_id=hod_user.username,
                hod_request_status='account_created'
            )
            hod_department = hod_request.department
        except HODRegistrationRequest.DoesNotExist:
            return None

    return hod_department

class HODDashboardView(APIView):
    """
    HOD Dashboard overview with statistics and recent activity
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get HOD dashboard data"""
        hod_user = request.user

        hod_department = _resolve_hod_department(hod_user)
        if not hod_department:
            return Response({'error': 'HOD profile not found'}, status=status.HTTP_404_NOT_FOUND)

        # Get statistics
        courses = Course.objects.select_related('semester__department').filter(
            semester__department=hod_department
        )
        
        semesters = Semester.objects.select_related('department').filter(
            department=hod_department
        )
        
        instructors = Instructor.objects.select_related('department').filter(
            department=hod_department
        )
        
        timetables = Timetable.objects.select_related('course__semester__department', 'instructor').filter(
            course__semester__department=hod_department
        )

        # Get students count
        from students.models import Student
        students = Student.objects.filter(department=hod_department)

        # Format data for frontend
        department_data = {
            'id': getattr(hod_department, 'id', getattr(hod_department, 'department_id', 1)),
            'name': hod_department.name,
            'code': hod_department.code
        }

        semesters_data = []
        for semester in semesters:
            semesters_data.append({
                'semester_id': semester.semester_id,
                'name': semester.name,
                'semester_code': getattr(semester, 'semester_code', f'{semester.program}-{semester.semester_id}'),
                'program': semester.program,
                'student_count': students.filter(semester=semester).count()
            })

        courses_data = []
        for course in courses:
            courses_data.append({
                'course_id': course.course_id,
                'name': course.name,
                'code': course.code,
                'credits': course.credits,
                'semester_id': course.semester.semester_id if course.semester else None,
                'semester_name': course.semester.name if course.semester else 'N/A'
            })

        instructors_data = []
        for instructor in instructors:
            instructor_courses = timetables.filter(instructor=instructor).values('course').distinct().count()
            instructors_data.append({
                'id': instructor.id,
                'name': instructor.name,
                'employee_id': instructor.employee_id,
                'specialization': instructor.specialization,
                'assigned_courses': instructor_courses
            })

        # Recent activity
        recent_timetables = timetables.order_by('-timetable_id')[:5]
        recent_activity = []
        for tt in recent_timetables:
            recent_activity.append({
                'type': 'timetable',
                'description': f'Class scheduled: {tt.course.name} with {tt.instructor.name if tt.instructor else "TBA"}',
                'time': tt.day,
                'course': tt.course.name
            })

        return Response({
            'department': department_data,
            'semesters': semesters_data,
            'courses': courses_data,
            'instructors': instructors_data,
            'statistics': {
                'total_students': students.count(),
                'total_courses': courses.count(),
                'total_instructors': instructors.count(),
                'total_timetables': timetables.count(),
                'total_semesters': semesters.count()
            },
            'recent_activity': recent_activity,
            'user': {
                'name': hod_user.name if hasattr(hod_user, 'name') else hod_user.username,
                'username': hod_user.username,
                'email': hod_user.email,
                'role': hod_user.role
            }
        }, status=status.HTTP_200_OK)


class HODStudentsView(APIView):
    """
    HOD department student listing used by the dashboard.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        hod_department = _resolve_hod_department(request.user)
        if not hod_department:
            return Response({'error': 'HOD department not found'}, status=status.HTTP_404_NOT_FOUND)

        queryset = Student.objects.select_related('department', 'semester', 'user').filter(
            semester__department=hod_department
        ).order_by('name')

        semester_id = request.GET.get('semester_id')
        if semester_id:
            queryset = queryset.filter(semester__semester_id=semester_id)

        students_data = []
        for student in queryset:
            students_data.append({
                'id': student.id,
                'name': student.name,
                'student_id': student.student_id,
                'email': student.email,
                'semester_name': student.semester.name if student.semester else 'N/A',
                'department_name': student.department.name if student.department else 'N/A',
            })

        return Response({
            'students': students_data,
            'count': len(students_data),
        }, status=status.HTTP_200_OK)


class HODTimetableView(APIView):
    """
    HOD Timetable management view
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get all timetables or form data"""
        # Check if requesting available data for form
        if request.GET.get('action') == 'form_data':
            # Get HOD's department - first try instructor profile, then HOD registration request
            hod_department = None
            hod_user = request.user

        #check HOD registration request
            try:
                    hod_request = HODRegistrationRequest.objects.get(
                        employee_id=hod_user.username,
                        hod_request_status='account_created'
                    )
                    hod_department = hod_request.department
            except HODRegistrationRequest.DoesNotExist:
                    return Response({'error': 'HOD profile not found'}, status=status.HTTP_404_NOT_FOUND)

            # Filter data by HOD's department
            courses = Course.objects.select_related('semester__department').filter(
                semester__department=hod_department
            )
            instructors = Instructor.objects.select_related('department').filter(
                department=hod_department
            )
            semesters = Semester.objects.select_related('department').filter(
                department=hod_department
            )

            courses_data = []
            for course in courses:
                courses_data.append({
                    'course_id': course.course_id,
                    'name': course.name,
                    'code': course.code,
                    'credits': course.credits,
                    'semester': course.semester.name if course.semester else 'N/A',
                    'semester_id': course.semester.semester_id if course.semester else None,
                    'department': course.semester.department.name if course.semester else 'N/A'
                })

            instructors_data = []
            for instructor in instructors:
                instructors_data.append({
                    'id': instructor.id,
                    'name': instructor.name,
                    'employee_id': instructor.employee_id,
                    'department': instructor.department.name if instructor.department else 'N/A'
                })

            semesters_data = []
            for semester in semesters:
                semesters_data.append({
                    'semester_id': semester.semester_id,
                    'name': semester.name,
                    'program': semester.program,
                    'department': semester.department.name if semester.department else 'N/A'
                })

            return Response({
                'courses': courses_data,
                'instructors': instructors_data,
                'semesters': semesters_data,
                'days': [{'value': day[0], 'label': day[1]} for day in Timetable.DAY_CHOICES],
                'time_slots': [
                    {'value': '08:00', 'label': '8:00 AM'},
                    {'value': '09:00', 'label': '9:00 AM'},
                    {'value': '10:00', 'label': '10:00 AM'},
                    {'value': '11:00', 'label': '11:00 AM'},
                    {'value': '12:00', 'label': '12:00 PM'},
                    {'value': '13:00', 'label': '1:00 PM'},
                    {'value': '14:00', 'label': '2:00 PM'},
                    {'value': '15:00', 'label': '3:00 PM'},
                    {'value': '16:00', 'label': '4:00 PM'}
                ]
            })

        # Get HOD's department
        hod_department = None
        hod_user = request.user

        try:
            hod_instructor = Instructor.objects.get(user=hod_user)
            hod_department = hod_instructor.department
        except Instructor.DoesNotExist:
            try:
                hod_request = HODRegistrationRequest.objects.get(
                    employee_id=hod_user.username,
                    hod_request_status='account_created'
                )
                hod_department = hod_request.department
            except HODRegistrationRequest.DoesNotExist:
                return Response({'error': 'HOD profile not found'}, status=status.HTTP_404_NOT_FOUND)

        # Filter timetables by HOD's department
        timetables = Timetable.objects.select_related('course__semester__department', 'instructor').filter(
            course__semester__department=hod_department
        )

        # Check if filtering by semester
        semester_id = request.GET.get('semester_id')
        if semester_id:
            timetables = timetables.filter(course__semester__semester_id=semester_id)

        # Format timetables data
        timetables_data = []
        for timetable in timetables:
            timetables_data.append({
                'timetable_id': timetable.timetable_id,
                'course_name': timetable.course.name,
                'course_code': timetable.course.code,
                'instructor_name': timetable.instructor.name if timetable.instructor else 'TBA',
                'day': timetable.day,
                'start_time': timetable.start_time.strftime('%H:%M'),
                'end_time': timetable.end_time.strftime('%H:%M'),
                'room': timetable.room or 'TBA',
                'semester_name': timetable.course.semester.name if timetable.course.semester else 'N/A'
            })

        return Response({
            'timetables': timetables_data,
            'count': len(timetables_data)
        }, status=status.HTTP_200_OK)

    def post(self, request):
        """Create new timetable entry"""
        hod_user = request.user

        # Get HOD's department
        hod_department = None
        try:
            hod_instructor = Instructor.objects.get(user=hod_user)
            hod_department = hod_instructor.department
        except Instructor.DoesNotExist:
            try:
                hod_request = HODRegistrationRequest.objects.get(
                    employee_id=hod_user.username,
                    hod_request_status='account_created'
                )
                hod_department = hod_request.department
            except HODRegistrationRequest.DoesNotExist:
                return Response({'error': 'HOD profile not found'}, status=status.HTTP_404_NOT_FOUND)

        if not hod_department:
            return Response({'error': 'HOD department not found'}, status=status.HTTP_404_NOT_FOUND)

        # Validate required fields
        required_fields = ['course_id', 'instructor_id', 'day', 'start_time', 'end_time']
        for field in required_fields:
            if not request.data.get(field):
                return Response({'error': f'{field} is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Get course and validate it belongs to HOD's department
            course = Course.objects.get(
                course_id=request.data['course_id'],
                semester__department=hod_department
            )
            
            # Get instructor and validate it belongs to HOD's department
            instructor = Instructor.objects.get(
                id=request.data['instructor_id'],
                department=hod_department
            )

            # Create timetable entry
            timetable = Timetable.objects.create(
                course=course,
                instructor=instructor,
                day=request.data['day'],
                start_time=request.data['start_time'],
                end_time=request.data['end_time'],
                room=request.data.get('room', '')
            )

            return Response({
                'message': 'Timetable entry created successfully',
                'timetable_id': timetable.timetable_id
            }, status=status.HTTP_201_CREATED)

        except Course.DoesNotExist:
            return Response({'error': 'Course not found or not in your department'}, status=status.HTTP_404_NOT_FOUND)
        except Instructor.DoesNotExist:
            return Response({'error': 'Instructor not found or not in your department'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class HODAnalyticsView(APIView):
    """HOD Analytics and Statistics View"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get analytics data for HOD dashboard"""
        hod_user = request.user

        # Get HOD's department
        hod_department = None
        try:
            hod_instructor = Instructor.objects.get(user=hod_user)
            hod_department = hod_instructor.department
        except Instructor.DoesNotExist:
            try:
                hod_request = HODRegistrationRequest.objects.get(
                    employee_id=hod_user.username,
                    hod_request_status='account_created'
                )
                hod_department = hod_request.department
            except HODRegistrationRequest.DoesNotExist:
                return Response({'error': 'HOD profile not found'}, status=status.HTTP_404_NOT_FOUND)

        if not hod_department:
            return Response({'error': 'HOD department not found'}, status=status.HTTP_404_NOT_FOUND)

        # Get department statistics
        from students.models import Student
        from django.db.models import Avg, Count
        
        students = Student.objects.filter(department=hod_department)
        courses = Course.objects.filter(semester__department=hod_department)
        instructors = Instructor.objects.filter(department=hod_department)
        semesters = Semester.objects.filter(department=hod_department)
        timetables = Timetable.objects.filter(course__semester__department=hod_department)

        # Student statistics by semester
        semester_stats = []
        for semester in semesters:
            semester_students = students.filter(semester=semester)
            semester_stats.append({
                'semester_name': semester.name,
                'student_count': semester_students.count(),
                'courses_count': courses.filter(semester=semester).count()
            })

        # Course enrollment statistics
        course_stats = []
        for course in courses[:10]:  # Top 10 courses
            course_students = students.filter(semester=course.semester)
            course_stats.append({
                'course_name': course.name,
                'course_code': course.code,
                'enrolled_students': course_students.count(),
                'credits': course.credits
            })

        # Instructor workload
        instructor_stats = []
        for instructor in instructors:
            instructor_timetables = timetables.filter(instructor=instructor)
            instructor_stats.append({
                'instructor_name': instructor.name,
                'employee_id': instructor.employee_id,
                'assigned_courses': instructor_timetables.values('course').distinct().count(),
                'total_classes': instructor_timetables.count(),
                'specialization': instructor.specialization
            })

        return Response({
            'department': {
                'name': hod_department.name,
                'code': hod_department.code,
                'total_students': students.count(),
                'total_courses': courses.count(),
                'total_instructors': instructors.count(),
                'total_semesters': semesters.count()
            },
            'semester_statistics': semester_stats,
            'course_statistics': course_stats,
            'instructor_statistics': instructor_stats,
            'recent_activity': {
                'new_students_this_month': students.filter(
                    enrollment_date__month=timezone.now().month,
                    enrollment_date__year=timezone.now().year
                ).count() if hasattr(Student, 'enrollment_date') else 0,
                'active_timetables': timetables.count(),
                'department_utilization': round((timetables.count() / max(courses.count(), 1)) * 100, 2)
            }
        }, status=status.HTTP_200_OK)


class HODTimetableDetailView(APIView):
    """HOD Timetable Detail View for CRUD operations"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, timetable_id):
        """Delete timetable entry"""
        try:
            # Get HOD's department
            hod_department = None
            hod_user = request.user

            try:
                hod_instructor = Instructor.objects.get(user=hod_user)
                hod_department = hod_instructor.department
            except Instructor.DoesNotExist:
                try:
                    hod_request = HODRegistrationRequest.objects.get(
                        employee_id=hod_user.username,
                        hod_request_status='account_created'
                    )
                    hod_department = hod_request.department
                except HODRegistrationRequest.DoesNotExist:
                    return Response({'error': 'HOD profile not found'}, status=status.HTTP_404_NOT_FOUND)

            # Get and delete the timetable entry
            timetable = Timetable.objects.select_related('course__semester__department').get(
                timetable_id=timetable_id,
                course__semester__department=hod_department
            )
            timetable.delete()

            return Response({
                'message': 'Timetable entry deleted successfully'
            }, status=status.HTTP_200_OK)

        except Timetable.DoesNotExist:
            return Response({
                'error': 'Timetable entry not found or access denied'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
