from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.views import APIView
from .models import TeacherAllocation
from .serializers import TeacherAllocationSerializer, BulkAllocationSerializer
from .services import allocate_teacher, cancel_allocation
from curriculum.models import CurriculumVersion
from core.responses import api_response
from django.db import transaction
from django.core.exceptions import ValidationError

from core.models import Course, Semester, Batch
from obe.models import CLO
# from assessments.models import Assessment, StudentQuestionMark, CQI
from django.db.models import Sum, F

class IsCoordinator(permissions.BasePermission):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        
        user_role = (getattr(request.user, 'role', '') or '').lower()
        secondary_role = (getattr(request.user, 'secondary_role', '') or '').lower()
        active_role = (getattr(request.user, 'active_role', '') or '').lower()
        
        # SAC (Super Admin) and HOD/Coordinator are allowed
        return (
            user_role in ['sac', 'coordinator', 'hod'] or 
            secondary_role in ['coordinator', 'hod'] or
            active_role in ['coordinator', 'hod']
        )

class TeacherAllocationViewSet(viewsets.ModelViewSet):
    queryset = TeacherAllocation.objects.filter(is_active=True)
    serializer_class = TeacherAllocationSerializer
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsCoordinator()]

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        
        # Global Rule: Coordinator aur HOD sirf apne programs ka data access kar sakte hain
        if user.role.lower() in ['coordinator', 'hod']:
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
                    batch=serializer.validated_data['batch'],
                    allocated_by=request.user,
                    semester_no=serializer.validated_data['semester_no']
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

    @action(detail=False, methods=['post'], url_path='bulk-allocate')
    def bulk_allocate(self, request):
        print("=== BULK ALLOCATE RECEIVED ===")
        print("Request Data:", request.data)
        
        serializer = BulkAllocationSerializer(data=request.data)
        if serializer.is_valid():
            version_id = serializer.validated_data['curriculum_version']
            batch_id = serializer.validated_data['batch']
            allocations_data = serializer.validated_data['allocations']
            print("Validated data:", {
                "version_id": version_id,
                "batch_id": batch_id,
                "allocations": allocations_data
            })
            
            try:
                version = CurriculumVersion.objects.get(pk=version_id)
                print("Got curriculum version:", version.id, version.version_no, version.program.name)
                
                from core.models.batch import Batch
                batch = Batch.objects.get(pk=batch_id)
                print("Got batch:", batch.id, batch.name)
                
                # Auto-sync if version is empty (Option A support)
                if not version.version_courses.exists():
                    print("Version has no courses, syncing from program")
                    from curriculum.services import sync_courses_from_program
                    sync_courses_from_program(version)
                
                created_allocations = []
                new_course_ids = []
                
                with transaction.atomic():
                    # First, collect all course IDs from new allocations
                    for data in allocations_data:
                        course_id = data.get('course')
                        teacher_id = data.get('teacher')
                        if course_id and teacher_id:
                            new_course_ids.append(str(course_id))
                    
                    # Now, mark existing active allocations for courses NOT in new list as inactive
                    existing_active = TeacherAllocation.objects.filter(
                        curriculum_version=version,
                        batch=batch,
                        is_active=True,
                        status='active'
                    )
                    
                    for alloc in existing_active:
                        if str(alloc.course.id) not in new_course_ids:
                            print("Marking old allocation as inactive:", alloc.course.name, alloc.id)
                            alloc.status = 'changed'
                            alloc.is_active = False
                            alloc.save()
                    
                    # Now process new allocations
                    for data in allocations_data:
                        from core.models.course import Course
                        from django.contrib.auth import get_user_model
                        from curriculum.models import CurriculumVersionCourse
                        User = get_user_model()
                        
                        course_id = data.get('course')
                        teacher_id = data.get('teacher')
                        print("Processing allocation:", {
                            "course_id": course_id,
                            "teacher_id": teacher_id
                        })
                        
                        if not course_id or not teacher_id:
                            print("Skipping invalid allocation (no course or teacher)")
                            continue
                            
                        try:
                            # Django's .get() handles both UUID objects and UUID strings automatically
                            course = Course.objects.get(pk=course_id)
                            print("Found course:", course.id, course.code, course.name)
                        except (Course.DoesNotExist, ValueError):
                            print("Course not found")
                            raise ValidationError(f"Course with ID {course_id} not found or invalid")
                            
                        try:
                            # teacher_id might be a UUID string or integer string
                            teacher = User.objects.get(pk=teacher_id)
                            print("Found teacher:", teacher.id, teacher.full_name, teacher.role)
                        except (User.DoesNotExist, ValueError):
                            print("Teacher not found")
                            raise ValidationError(f"Instructor with ID {teacher_id} not found or invalid")
                        
                        # Double check if course is in version, if not, add it (flexible allocation)
                        if not version.version_courses.filter(course=course).exists():
                            print("Course not in version, adding it")
                            CurriculumVersionCourse.objects.create(
                                version=version,
                                course=course,
                                semester_no=course.semester.number if hasattr(course, 'semester') else 1
                            )
                        
                        # Use update_or_create logic or ensure previous ones are handled
                        # Here we use our updated allocate_teacher which handles existing ones
                        print("Calling allocate_teacher")
                        allocation = allocate_teacher(
                            curriculum_version=version,
                            course=course,
                            teacher=teacher,
                            batch=batch,
                            allocated_by=request.user,
                            semester_no=course.semester.number if hasattr(course, 'semester') else 1
                        )
                        print("Created allocation:", allocation.id)
                        created_allocations.append(TeacherAllocationSerializer(allocation).data)
                
                print("Created allocations:", created_allocations)
                return api_response(
                    data=created_allocations,
                    message=f"Successfully allocated {len(created_allocations)} teachers",
                    status_code=status.HTTP_201_CREATED
                )
            except CurriculumVersion.DoesNotExist:
                print("Curriculum version not found")
                return api_response(message="Curriculum version not found", status_code=status.HTTP_404_NOT_FOUND)
            except Batch.DoesNotExist:
                print("Batch not found")
                return api_response(message="Batch not found", status_code=status.HTTP_404_NOT_FOUND)
            except ValidationError as e:
                print("Validation error:", e)
                return api_response(message=str(e.detail if hasattr(e, 'detail') else e), status_code=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                import traceback
                print("Exception:", str(e))
                print(traceback.format_exc())
                return api_response(message=f"An internal error occurred: {str(e)}", status_code=status.HTTP_400_BAD_REQUEST)
        else:
            print("Serializer errors:", serializer.errors)
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
