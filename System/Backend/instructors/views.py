from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import F
from .models import Instructor
from .serializers import InstructorSerializer
from coordinators.models import TeacherAllocation
from coordinators.serializers import TeacherAllocationSerializer
from core.models import Batch
from obe.models import GACQIRecord
from .models import Instructor
from .serializers import InstructorSerializer
from coordinators.models import TeacherAllocation
from core.responses import api_response
from feedback.models import FeedbackCQI


class InstructorViewSet(viewsets.ModelViewSet):
    queryset = Instructor.objects.all()
    serializer_class = InstructorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        from django.contrib.auth import get_user_model
        from core.permissions import _get_user_department
        User = get_user_model()

        user = request.user
        # All active faculty roles
        qs = Instructor.objects.filter(
            is_active=True,
            user__isnull=False,
            user__is_active=True,
            user__role__in=['instructor', 'hod', 'coordinator'],
        ).select_related('user', 'department')

        # Scope HOD to their department
        is_hod = user.role == 'hod' or getattr(user, 'secondary_role', '') == 'hod'
        is_coord = user.role == 'coordinator' or getattr(user, 'secondary_role', '') == 'coordinator'
        if is_hod:
            dept = _get_user_department(user)
            if dept is not None:
                qs = qs.filter(department=dept)
            else:
                qs = qs.none()
        elif is_coord:
            # Coordinator sees instructors from their programs' department
            program = user.programs.select_related('department').first()
            if program and program.department:
                qs = qs.filter(department=program.department)

        data = [
            {
                'id': inst.id,
                'user': str(inst.user.id),
                'name': inst.name,
                'email': inst.email,
                'designation': inst.designation,
                'employment_type': inst.employment_type,
                'department': inst.department_id,
                'department_name': inst.department.name if inst.department else None,
                'role': inst.user.role,
            }
            for inst in qs
        ]
        return api_response(data=data, message='Instructors retrieved successfully')

    @action(detail=False, methods=['get'], url_path='my-courses')
    def my_courses(self, request):
        """Get courses allocated to the currently logged-in instructor."""
        user = request.user
        
        # Log for debugging - Using 'email' instead of 'username' since CustomUser uses email
        print(f"Fetching courses for user: {user.email}, ID: {user.id}, Role: {getattr(user, 'role', 'N/A')}")
        
        allocations = TeacherAllocation.objects.filter(
            teacher=user,
            is_active=True,
            status='active',
            batch__status='active'
        ).exclude(
            allocated_by__role='SAC'
        ).select_related('course', 'batch', 'curriculum_version')
        
        print(f"Found {allocations.count()} active allocations")
        
        data = []
        for alloc in allocations:
            # Get core semester by number and program
            from core.models import Semester as CoreSemester
            core_semester = CoreSemester.objects.filter(
                number=alloc.semester_no,
                program=alloc.course.program
            ).first()
            
            # For same batch, get last completed semester (any semester < current allocation's semester)
            last_completed_semester = None
            # Find max semester number that has courses with assessment_status='ASSESSMENT_DONE'
            from obe.models import CourseSession
            from assessments.workflows import (
                derive_batch_semester_status,
                get_permitted_actions,
                sync_course_session_workflow_from_assessments,
            )
            completed_semesters = CourseSession.objects.filter(
                batch=alloc.batch,
                is_active=True,
                assessment_status='ASSESSMENT_DONE'
            ).values_list('semester__number', flat=True).distinct()
            
            if completed_semesters:
                # Filter to semesters < current allocation's semester
                eligible_semesters = [s for s in completed_semesters if s < alloc.semester_no]
                if eligible_semesters:
                    last_completed_semester = max(eligible_semesters)
            
            previous_cqi = None
            if last_completed_semester:
                previous_cqi = GACQIRecord.objects.filter(
                    batch=alloc.batch,
                    cqi_level='SEMESTER',
                    semester=last_completed_semester,
                    status__in=['SAVED', 'EXPORTED', 'FULLY_APPROVED', 'PENDING', 'SENT_BACK'],
                    is_active=True
                ).order_by('-created_at').first()
            course_session = CourseSession.objects.filter(
                course=alloc.course,
                batch=alloc.batch,
                semester=core_semester,
                is_active=True,
            ).first()
            course_session = sync_course_session_workflow_from_assessments(course_session)
            semester_status = derive_batch_semester_status(alloc.batch, core_semester) if core_semester else 'ONGOING'
            data.append({
                'id': alloc.id,
                'allocation_id': alloc.id,
                'course_id': alloc.course.id,
                'course_name': alloc.course.name,
                'course_code': alloc.course.code,
                'course_type': alloc.course.course_type,
                'course_description': alloc.course.description if hasattr(alloc.course, 'description') else '',
                'credits': alloc.course.credit_hours,
                'credit_hours': alloc.course.credit_hours,
                'batch_id': alloc.batch.id,
                'batch_name': alloc.batch.name,
                'last_completed_semester': last_completed_semester,
                'semester_no': alloc.semester_no,
                'semester_id': core_semester.id if core_semester else None,
                'course_session_id': course_session.id if course_session else None,
                'internals_locked': bool(course_session and course_session.internals_locked),
                'internal_complete_awaiting_final': bool(course_session and course_session.internal_complete_awaiting_final),
                'final_submitted': bool(course_session and course_session.final_submitted),
                'semester_status': semester_status,
                'permitted_actions': get_permitted_actions(semester_status),
                'semester_name': f"Semester {alloc.semester_no}",
                'program_name': alloc.batch.program.name,
                'program_code': alloc.batch.program.code,
                'coordinator_name': alloc.allocated_by.full_name if alloc.allocated_by else 'N/A',
                'curriculum_version': alloc.curriculum_version.version_no,
                'curriculum_version_id': alloc.curriculum_version.id,
                'status': 'active',
                'has_previous_cqi': previous_cqi is not None,
                'previous_cqi': {
                 'id': str(previous_cqi.id),
                 'semester': last_completed_semester,
                 'root_cause': previous_cqi.root_cause,
                  'remedial_plan': previous_cqi.remedial_plan,
                  } if previous_cqi else None,
            })
            
        return Response({'courses': data, 'results': data}) # Wrapped for different component expectations

    # ✅ PROFILE (same pattern as coordinator)
    @action(detail=False, methods=['get'])
    def profile(self, request):
        from core.serializers.user import UserListSerializer

        user = request.user
        data = UserListSerializer(user, context={'request': request}).data

        try:
            instructor = Instructor.objects.select_related('department').get(user=user)
            serializer = InstructorSerializer(instructor, context={'request': request})
            instructor_data = serializer.data

            # Merge data - skips 'id' and 'user' to avoid conflicts
            for key, value in instructor_data.items():
                if key not in ['id', 'user']:
                    data[key] = value

            # Ensure department_name is always present and correct
            if instructor.department:
                data['department_name'] = instructor.department.name
            else:
                data['department_name'] = None

            # Remove raw department ID so frontend always uses department_name
            if 'department' in data:
                del data['department']

        except Instructor.DoesNotExist:
            pass

        return api_response(data=data, message="Instructor profile retrieved successfully")

    # ✅ GET MY COURSES (FIXED & SAFE)
    @action(detail=False, methods=['get'])
    def courses(self, request):
        try:
            allocations = TeacherAllocation.objects.filter(
    teacher=request.user,
    is_active=True,
    status='active',
    batch__status='active'
).exclude(
                allocated_by__role='SAC'
            ).select_related(
                'course',
                'course__semester',
                'allocated_by',
                'batch',
                'curriculum_version'
            )

            data = []
            for a in allocations:
                course = a.course
                semester = getattr(course, 'semester', None)

                data.append({
                    "allocation_id": a.id,
                    "course_id": course.id if course else None,
                    "batch_id": a.batch.id if hasattr(a, 'batch') and a.batch else None,
                    "batch_name": a.batch.name if hasattr(a, 'batch') and a.batch else "",
                    "course_name": getattr(course, 'name', ""),
                    "course_code": getattr(course, 'code', ""),
                    "course_description": getattr(course, 'description', ""),
                    "credits": getattr(course, 'credit_hours', 0),
                     
                    "semester_id": semester.id if semester else None,
                    "semester_name": getattr(semester, 'name', ""),
                    "semester_code": getattr(semester, 'code', ""),
                    "semester_no": a.semester_no,

                    "program_name": a.batch.program.name if hasattr(a, 'batch') and a.batch and a.batch.program else "",
                    "program_code": a.batch.program.code if hasattr(a, 'batch') and a.batch and a.batch.program else "",

                    # ✅ SAFE USER NAME
                    "coordinator_name": (
    getattr(a.allocated_by, 'name', '') 
    or getattr(a.allocated_by, 'email', '')
),

                    "approved_at": a.allocated_at,
                    "hod_comments": getattr(a, 'hod_comments', ""),
                    "status": a.status
                })

            return api_response(data=data, message="Courses retrieved successfully")

        except Exception as e:
            print("🔥 ERROR courses:", str(e))
            return api_response(message="Error fetching courses", status_code=500)

    # ✅ SUMMARY
    @action(detail=False, methods=['get'])
    def courses_summary(self, request):
        qs = TeacherAllocation.objects.filter(
            teacher=request.user,
            is_active=True
        )

        return api_response(data={
            "total_allocated": qs.count(),
            "active_courses": qs.filter(status='active').count(),
            "pending_approval": qs.filter(status='pending').count(),
            "approved_courses": qs.filter(status='approved').count(),
            "rejected_courses": qs.filter(status='rejected').count(),
        })

    # ✅ COURSE DETAILS
    @action(detail=False, methods=['get'])
    def course_details(self, request):
        course_id = request.GET.get('course_id')

        try:
            allocation = TeacherAllocation.objects.select_related(
                'course',
                'course__semester',
                'allocated_by'
            ).get(id=course_id, teacher=request.user)

            course = allocation.course
            semester = getattr(course, 'semester', None)

            return api_response(data={
                "allocation_id": allocation.id,

                "course": {
                    "course_id": course.id,
                    "name": getattr(course, 'name', ""),
                    "code": getattr(course, 'code', ""),
                    "description": getattr(course, 'description', ""),
                    "credits": getattr(course, 'credit_hours', 0),
                },

                "semester": {
                    "semester_id": semester.id if semester else None,
                    "name": getattr(semester, 'name', ""),
                    "code": getattr(semester, 'code', ""),
                },

               "coordinator": {
    "name": (
        getattr(allocation.allocated_by, 'name', None)
        or getattr(allocation.allocated_by, 'username', None)
        or getattr(allocation.allocated_by, 'email', "")
    ),
    "email": getattr(allocation.allocated_by, 'email', ""),
},

                "students": [],
                "total_students": 0,
                "approved_at": allocation.allocated_at,
                "hod_comments": getattr(allocation, 'hod_comments', "")

            }, message="Course details retrieved successfully")

        except TeacherAllocation.DoesNotExist:
            return api_response(message="Course not found", status_code=404)
