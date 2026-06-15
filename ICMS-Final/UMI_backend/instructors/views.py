from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Instructor
from .serializers import InstructorSerializer
from coordinators.models import TeacherAllocation
from core.responses import api_response


class InstructorViewSet(viewsets.ModelViewSet):
    queryset = Instructor.objects.all()
    serializer_class = InstructorSerializer
    permission_classes = [permissions.IsAuthenticated]

    # ✅ PROFILE (same pattern as coordinator)
    @action(detail=False, methods=['get'])
    def profile(self, request):
        from core.serializers.user import UserListSerializer

        user = request.user
        data = UserListSerializer(user, context={'request': request}).data

        try:
            instructor = Instructor.objects.get(user=user)
            serializer = InstructorSerializer(instructor, context={'request': request})
            instructor_data = serializer.data

            # Merge data
            for key, value in instructor_data.items():
                if key not in ['id', 'user']:
                    data[key] = value

        except Instructor.DoesNotExist:
            pass

        return api_response(data=data, message="Instructor profile retrieved successfully")

    # ✅ GET MY COURSES (FIXED & SAFE)
    @action(detail=False, methods=['get'])
    def courses(self, request):
        try:
            allocations = TeacherAllocation.objects.filter(
    teacher=request.user,
    is_active=True
                
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
                    "course_name": getattr(course, 'name', ""),
                    "course_code": getattr(course, 'code', ""),
                    "course_description": getattr(course, 'description', ""),
                    "credits": getattr(course, 'credit_hours', 0),
                     
                    "semester_id": semester.id if semester else None,
                    "semester_name": getattr(semester, 'name', ""),
                    "semester_code": getattr(semester, 'code', ""),

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