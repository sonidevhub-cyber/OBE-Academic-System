from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from core.models import Course
from .models import CurriculumVersion, CurriculumVersionCourse
from .serializers import CurriculumVersionSerializer, CurriculumVersionCourseSerializer
from .services import activate_curriculum_version, clone_curriculum_for_batch, sync_courses_from_program
from core.responses import api_response




class CurriculumVersionViewSet(viewsets.ModelViewSet):
    queryset = CurriculumVersion.objects.filter(is_active=True)
    serializer_class = CurriculumVersionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        
        # Global Rule: Coordinator sirf apne program ka data access kar sakta hai
        if user.role.lower() == 'coordinator':
            queryset = queryset.filter(program__in=user.programs.all())
        
        # Filters
        program_id = self.request.query_params.get('program')
        batch_id = self.request.query_params.get('batch')
        status_filter = self.request.query_params.get('status')
        
        if program_id:
            queryset = queryset.filter(program_id=program_id)
        if batch_id:
            queryset = queryset.filter(batch_id=batch_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
            
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action == 'retrieve':
            context['view_type'] = 'detail'
        return context

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return api_response(
            data=serializer.data,
            message="Version details fetched successfully",
            status_code=status.HTTP_200_OK
        )

    def perform_create(self, serializer):
        # Auto-generate version_no logic
        program = serializer.validated_data.get('program')
        existing_count = CurriculumVersion.objects.filter(program=program).count()
        version = serializer.save(
            created_by=self.request.user,
            version_no=f"v{existing_count + 1}.0"
        )
        # Option A: Auto-Sync Program Courses
        sync_courses_from_program(version)

    def perform_update(self, serializer):
        instance = self.get_object()
        if not instance.is_editable():
            raise api_response(message="Only draft versions can be edited", status_code=status.HTTP_400_BAD_REQUEST)
        serializer.save()

    @action(detail=True, methods=['post'])
    def sync_courses(self, request, pk=None):
        version = self.get_object()
        if not version.is_editable():
            return api_response(message="Cannot sync courses to a finalized version", status_code=status.HTTP_400_BAD_REQUEST)
        try:
            sync_courses_from_program(version)
            return api_response(
                data=CurriculumVersionSerializer(version, context={'view_type': 'detail'}).data,
                message="Courses synced from program successfully",
                status_code=status.HTTP_200_OK
            )
        except Exception as e:
            return api_response(message=str(e), status_code=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def finalize(self, request, pk=None):
        version = self.get_object()
        
        # Role check: Coordinators and HODs can finalize
        user_role = request.user.role.lower()
        if user_role not in ['coordinator', 'hod']:
            return api_response(message="Only Coordinators and HODs can finalize curriculum versions", status_code=status.HTTP_403_FORBIDDEN)
            
        try:
            activated_version = activate_curriculum_version(version, request.user)
            return api_response(
                data=CurriculumVersionSerializer(activated_version).data,
                message="Curriculum version finalized successfully",
                status_code=status.HTTP_200_OK
            )
        except Exception as e:
            return api_response(
                message=str(e),
                status_code=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def master(self, request):
        program_id = request.query_params.get('program_id')
        queryset = self.get_queryset().filter(batch__isnull=True)
        if program_id:
            queryset = queryset.filter(program_id=program_id)
            
        serializer = self.get_serializer(queryset, many=True)
        return api_response(
            data=serializer.data,
            message="Master curricula fetched successfully",
            status_code=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'], url_path='add-course')
    def add_course(self, request, pk=None):
        from core.models import Course
        version = self.get_object()
        
        if not version.is_editable():
            return api_response(message="Cannot add courses to a finalized version", status_code=status.HTTP_400_BAD_REQUEST)
            
        course_id = request.data.get('course_id')
        semester = request.data.get('semester')

        if not course_id or not semester:
            return api_response(
                message="Course ID and semester are required.",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return api_response(
                message="Course not found.",
                status_code=status.HTTP_404_NOT_FOUND
            )

        if CurriculumVersionCourse.objects.filter(version=version, course_id=course_id).exists():
            return api_response(
                message="This course is already in this curriculum version.",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        CurriculumVersionCourse.objects.create(
            version=version,
            course=course,
            semester=semester
        )

        serializer = self.get_serializer(version)
        return api_response(
            data=serializer.data,
            message="Course added successfully.",
            status_code=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def clone(self, request, pk=None):
        source_version = self.get_object()
        target_batch_id = request.data.get('target_batch_id')
        if not target_batch_id:
            return api_response(message="target_batch_id is required", status_code=status.HTTP_400_BAD_REQUEST)
        
        from core.models.batch import Batch
        try:
            target_batch = Batch.objects.get(pk=target_batch_id)
            new_version = clone_curriculum_for_batch(source_version, target_batch, request.user)
            return api_response(
                data=CurriculumVersionSerializer(new_version).data,
                message="Curriculum cloned successfully",
                status_code=status.HTTP_201_CREATED
            )
        except Exception as e:
            return api_response(message=str(e), status_code=status.HTTP_400_BAD_REQUEST)

class CurriculumVersionCourseViewSet(viewsets.ModelViewSet):
    queryset = CurriculumVersionCourse.objects.all()
    serializer_class = CurriculumVersionCourseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        version_id = self.kwargs.get('version_pk')
        return super().get_queryset().filter(version_id=version_id)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        version_id = self.kwargs.get('version_pk')
        context['version'] = CurriculumVersion.objects.get(pk=version_id)
        return context

    def perform_create(self, serializer):
        version_id = self.kwargs.get('version_pk')
        version = CurriculumVersion.objects.get(pk=version_id)
        serializer.save(version=version)

    def create(self, request, *args, **kwargs):
        # Allow course to be None
        if 'course' not in request.data or not request.data['course']:
            request.data['course'] = None

        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return api_response(
                data=serializer.data,
                message="Course added successfully.",
                status_code=status.HTTP_201_CREATED,
            )

        # DRF default would return 400, but we want the exact field errors
        return api_response(
            message="Validation failed.",
            data={
                "errors": serializer.errors,
                "request_data": request.data,
                "version_pk": self.kwargs.get('version_pk'),
                "version_status": (
                    CurriculumVersion.objects.filter(pk=self.kwargs.get('version_pk')).values_list('status', flat=True).first()
                ),
            },
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    def destroy(self, request, *args, **kwargs):
        # NO hard deletes anywhere — is_active=False
        instance = self.get_object()
        if not instance.version.is_editable():
            return api_response(message="Cannot delete courses from non-draft version", status_code=status.HTTP_400_BAD_REQUEST)
        instance.is_active = False
        instance.save()
        return api_response(message="Course removed (soft deleted)", status_code=status.HTTP_204_NO_CONTENT)