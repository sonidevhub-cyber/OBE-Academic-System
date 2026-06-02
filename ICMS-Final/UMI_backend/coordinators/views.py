from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from .models import TeacherAllocation
from .serializers import TeacherAllocationSerializer, BulkAllocationSerializer
from .services import allocate_teacher, cancel_allocation
from curriculum.models import CurriculumVersion
from core.responses import api_response
from django.db import transaction

class IsCoordinator(permissions.BasePermission):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        
        user_role = (getattr(request.user, 'role', '') or '').lower()
        secondary_role = (getattr(request.user, 'secondary_role', '') or '').lower()
        
        return (
            user_role in ['coordinator', 'hod'] or 
            secondary_role in ['coordinator', 'hod']
        )

class TeacherAllocationViewSet(viewsets.ModelViewSet):
    queryset = TeacherAllocation.objects.filter(is_active=True)
    serializer_class = TeacherAllocationSerializer
    permission_classes = [permissions.IsAuthenticated, IsCoordinator]

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        
        # Global Rule: Coordinator sirf apne program ka data access kar sakta hai
        if user.role.lower() == 'coordinator':
            queryset = queryset.filter(curriculum_version__program__in=user.programs.all())
        
        # Filters
        version_id = self.request.query_params.get('version')
        batch_id = self.request.query_params.get('batch')
        teacher_id = self.request.query_params.get('teacher')
        
        if version_id:
            queryset = queryset.filter(curriculum_version_id=version_id)
        if batch_id:
            queryset = queryset.filter(batch_id=batch_id)
        if teacher_id:
            queryset = queryset.filter(teacher_id=teacher_id)
            
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return api_response(data=serializer.data, message="Allocations retrieved successfully")

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return api_response(data=serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            try:
                allocation = allocate_teacher(
                    curriculum_version=serializer.validated_data['curriculum_version'],
                    course=serializer.validated_data['course'],
                    teacher=serializer.validated_data['teacher'],
                    allocated_by=request.user
                )
                return api_response(
                    data=TeacherAllocationSerializer(allocation).data,
                    message="Teacher allocated successfully",
                    status_code=status.HTTP_201_CREATED
                )
            except Exception as e:
                return api_response(message=str(e), status_code=status.HTTP_400_BAD_REQUEST)
        return api_response(data=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def profile(self, request):
        user = request.user
        
        # Base user data
        from core.serializers.user import UserListSerializer
        data = UserListSerializer(user, context={'request': request}).data
        
        # Try to enrich with instructor data if available
        try:
            from instructors.models import Instructor
            from instructors.serializers import InstructorSerializer
            instructor = Instructor.objects.get(user=user)
            instructor_data = InstructorSerializer(instructor, context={'request': request}).data
            
            # Merge instructor data, preferring instructor data for overlapping fields
            # except for role/active_role which should come from the user/session
            for key, value in instructor_data.items():
                if key not in ['id', 'role', 'active_role', 'secondary_role', 'user']:
                    data[key] = value
                    
        except Exception:
            # If no instructor profile, just return base user data
            pass
            
        return api_response(data=data, message="Coordinator profile retrieved successfully")

    @action(detail=False, methods=['post'])
    def bulk(self, request):
        serializer = BulkAllocationSerializer(data=request.data)
        if serializer.is_valid():
            version_id = serializer.validated_data['curriculum_version']
            allocations_data = serializer.validated_data['allocations']
            
            try:
                version = CurriculumVersion.objects.get(pk=version_id)
                
                # Auto-sync if version is empty (Option A support)
                if not version.version_courses.exists():
                    from curriculum.services import sync_courses_from_program
                    sync_courses_from_program(version)
                
                created_allocations = []
                with transaction.atomic():
                    for data in allocations_data:
                        from core.models.course import Course
                        from django.contrib.auth import get_user_model
                        from curriculum.models import CurriculumVersionCourse
                        User = get_user_model()
                        
                        course_id = data.get('course')
                        teacher_id = data.get('teacher')
                        
                        if not course_id or not teacher_id:
                            continue
                            
                        try:
                            # Django's .get() handles both UUID objects and UUID strings automatically
                            course = Course.objects.get(pk=course_id)
                        except (Course.DoesNotExist, ValidationError, ValueError):
                            raise ValidationError(f"Course with ID {course_id} not found or invalid")
                            
                        try:
                            # teacher_id might be a UUID string or integer string
                            teacher = User.objects.get(pk=teacher_id)
                        except (User.DoesNotExist, ValidationError, ValueError):
                            raise ValidationError(f"Instructor with ID {teacher_id} not found or invalid")
                        
                        # Double check if course is in version, if not, add it (flexible allocation)
                        if not version.version_courses.filter(course=course).exists():
                            CurriculumVersionCourse.objects.create(
                                version=version,
                                course=course,
                                semester_no=course.semester.number
                            )
                        
                        allocation = allocate_teacher(
                            curriculum_version=version,
                            course=course,
                            teacher=teacher,
                            allocated_by=request.user
                        )
                        created_allocations.append(TeacherAllocationSerializer(allocation).data)
                
                return api_response(
                    data=created_allocations,
                    message=f"Successfully allocated {len(created_allocations)} teachers",
                    status_code=status.HTTP_201_CREATED
                )
            except ValidationError as e:
                return api_response(message=str(e), status_code=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                import traceback
                print(traceback.format_exc())
                return api_response(message="An internal error occurred while saving allocations", status_code=status.HTTP_400_BAD_REQUEST)
        return api_response(data=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        allocation = self.get_object()
        reason = request.data.get('reason')
        if not reason:
            return api_response(message="Reason is required for cancellation", status_code=status.HTTP_400_BAD_REQUEST)
        
        updated_allocation = cancel_allocation(allocation, request.user, reason)
        return api_response(
            data=TeacherAllocationSerializer(updated_allocation).data,
            message="Allocation cancelled successfully"
        )

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        allocation = self.get_object()
        # Get all allocations for same course+batch+semester
        history = TeacherAllocation.objects.filter(
            course=allocation.course,
            batch=allocation.batch,
            semester_no=allocation.semester_no
        ).order_by('-allocated_at')
        
        serializer = TeacherAllocationSerializer(history, many=True)
        return api_response(data=serializer.data, message="History retrieved successfully")
