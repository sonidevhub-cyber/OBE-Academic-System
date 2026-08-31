from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError
from uuid import UUID
from core.models import Course
from core.models.batch import Batch

from uuid import UUID

from curriculum.models import (
    CurriculumVersion,
    CurriculumVersionCourse,
    CurriculumCourseHistory,
)

from .serializers import (
    CurriculumVersionSerializer,
    CurriculumVersionCourseSerializer,
)

from .services import (
    activate_curriculum_version,
    sync_courses_from_program,
    branch_version_if_needed,
    validate_semester_editable,
)

from core.responses import api_response


# ============================================================
# CURRICULUM VERSION VIEWSET
# ===========================================================


class CurriculumVersionViewSet(viewsets.ModelViewSet):

    queryset = CurriculumVersion.objects.filter(
        is_active=True
    )

    serializer_class = CurriculumVersionSerializer

    permission_classes = [
        IsAuthenticated
    ]

    # ========================================================
    # QUERYSET
    # ========================================================

    def get_queryset(self):

        user = self.request.user

        queryset = super().get_queryset()

        # ----------------------------------------------------
        # Effective role
        # ----------------------------------------------------

        effective_role = (
            user.active_role or user.role
        )

        effective_role = (
            effective_role.lower()
            if effective_role
            else ''
        )

        # ----------------------------------------------------
        # Coordinator / HOD
        # Only access assigned programs
        # ----------------------------------------------------

        if effective_role in [
            'coordinator',
            'hod'
        ]:

            queryset = queryset.filter(
                program__in=user.programs.all()
            )

        # ----------------------------------------------------
        # Filters
        # ----------------------------------------------------

        program_id = (
            self.request.query_params.get(
                'program'
            )
        )

        batch_id = (
            self.request.query_params.get(
                'batch'
            )
        )

        status_filter = (
            self.request.query_params.get(
                'status'
            )
        )

        # ----------------------------------------------------
        # Program filter
        # ----------------------------------------------------

        if program_id:

            queryset = queryset.filter(
                program_id=program_id
            )

        # ----------------------------------------------------
        # Batch filter
        # ----------------------------------------------------

        if batch_id:

            direct_version_id = (
                Batch.objects
                .filter(
                    pk=batch_id,
                    curriculum_version__isnull=False
                )
                .values_list(
                    'curriculum_version_id',
                    flat=True
                )
                .first()
            )

            if direct_version_id:

                queryset = queryset.filter(
                    pk=direct_version_id
                )

            else:

                queryset = queryset.none()

        # ----------------------------------------------------
        # Status filter
        # ----------------------------------------------------

        if status_filter:

            queryset = queryset.filter(
                status=status_filter
            )

        return queryset

    # ========================================================
    # SERIALIZER CONTEXT
    # ========================================================

    def get_serializer_context(self):

        context = super().get_serializer_context()

        if self.action == 'retrieve':

            context['view_type'] = 'detail'

        batch_id = (
            self.request.query_params.get(
                'batch'
            )
        )

        if batch_id:

            context['batch_id'] = batch_id

        return context

    # ========================================================
    # RETRIEVE
    # ========================================================

    def retrieve(
        self,
        request,
        *args,
        **kwargs
    ):

        instance = self.get_object()

        batch_id = request.query_params.get(
            'batch'
        )

        if batch_id:

            try:

                batch = Batch.objects.get(
                    pk=batch_id
                )

            except Batch.DoesNotExist:

                return api_response(
                    message="Batch not found.",
                    status_code=(
                        status.HTTP_404_NOT_FOUND
                    )
                )

            if batch.curriculum_version_id:

                if (
                    batch.curriculum_version_id
                    != instance.id
                ):

                    try:

                        instance = (
                            CurriculumVersion.objects.get(
                                pk=batch.curriculum_version_id
                            )
                        )

                    except CurriculumVersion.DoesNotExist:

                        return api_response(
                            message=(
                                "Assigned curriculum "
                                "version not found."
                            ),
                            status_code=(
                                status.HTTP_404_NOT_FOUND
                            )
                        )

        serializer = self.get_serializer(
            instance
        )

        return api_response(
            data=serializer.data,
            message=(
                "Version details fetched successfully."
            ),
            status_code=status.HTTP_200_OK
        )

    # ========================================================
    # CREATE NEW VERSION
    # ========================================================

    def perform_create(
        self,
        serializer
    ):

        program = (
            serializer.validated_data.get(
                'program'
            )
        )

        existing_versions = (
            CurriculumVersion.objects.filter(
                program=program
            )
        )

        major_numbers = []

        for version in existing_versions:

            try:

                version_no = (
                    version.version_no
                    .lower()
                    .replace('v', '')
                )

                major = int(
                    version_no.split('.')[0]
                )

                major_numbers.append(
                    major
                )

            except (
                AttributeError,
                IndexError,
                ValueError
            ):

                continue

        next_major = (
            max(
                major_numbers,
                default=0
            ) + 1
        )

        version_no = f"v{next_major}.0"

        curriculum_mode = (
            serializer.validated_data.get(
                'curriculum_mode',
                'progressive'
            )
        )

        serializer.save(
            created_by=self.request.user,
            version_no=version_no,
            status='draft',
            curriculum_mode=curriculum_mode
        )

    # ========================================================
    # UPDATE VERSION METADATA
    # ========================================================

    def perform_update(
        self,
        serializer
    ):

        instance = self.get_object()

        if not instance.is_editable():

            raise ValidationError(
                "Only draft curriculum versions "
                "can be edited."
            )

        serializer.save()

    # ========================================================
    # SYNC COURSES
    # ========================================================

    @action(
        detail=True,
        methods=['post']
    )
    def sync_courses(
        self,
        request,
        pk=None
    ):

        version = self.get_object()

        if not version.is_editable():

            return api_response(
                message=(
                    "Cannot sync courses to a "
                    "finalized version."
                ),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        try:

            sync_courses_from_program(
                version
            )

            serializer = self.get_serializer(
                version
            )

            return api_response(
                data=serializer.data,
                message=(
                    "Courses synced from program "
                    "successfully."
                ),
                status_code=status.HTTP_200_OK
            )

        except ValidationError as e:

            return api_response(
                message=str(e),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        except Exception as e:

            return api_response(
                message=str(e),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

    # ========================================================
    # BRANCH / CLONE VERSION FOR BATCH
    # ========================================================

    @action(
        detail=True,
        methods=['post'],
        url_path='clone'
    )
    def clone(
        self,
        request,
        pk=None
    ):

        version = self.get_object()

        target_batch_id = (
            request.data.get(
                'target_batch_id'
            )
        )

        if not target_batch_id:

            return api_response(
                message=(
                    "target_batch_id is required "
                    "to clone version."
                ),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        try:

            batch = Batch.objects.get(
                pk=target_batch_id
            )

        except Batch.DoesNotExist:

            return api_response(
                message="Target batch not found.",
                status_code=(
                    status.HTTP_404_NOT_FOUND
                )
            )

        # ----------------------------------------------------
        # Batch already assigned
        # ----------------------------------------------------

        if batch.curriculum_version_id:

            return api_response(
                message=(
                    "This batch already has a curriculum "
                    "version assigned. A different "
                    "curriculum version cannot be assigned "
                    "to the same batch."
                ),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        # ----------------------------------------------------
        # Same program
        # ----------------------------------------------------

        if (
            batch.program_id
            != version.program_id
        ):

            return api_response(
                message=(
                    "Target batch program must match "
                    "curriculum version program."
                ),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        try:

            new_version = branch_version_if_needed(
                version=version,
                batch=batch,
                user=request.user
            )

            curriculum_mode = (
                request.data.get(
                    'curriculum_mode'
                )
            )

            current_semester = (
                request.data.get(
                    'current_semester'
                )
            )

            if curriculum_mode:

                curriculum_mode = str(
                    curriculum_mode
                ).lower()

                if curriculum_mode not in [
                    'progressive',
                    'complete'
                ]:

                    return api_response(
                        message=(
                            "curriculum_mode must be "
                            "either 'progressive' or "
                            "'complete'."
                        ),
                        status_code=(
                            status.HTTP_400_BAD_REQUEST
                        )
                    )

                # --------------------------------------------
                # Progressive
                # --------------------------------------------

                if curriculum_mode == 'progressive':

                    if current_semester is None:

                        current_semester = 1

                    try:

                        current_semester = int(
                            current_semester
                        )

                    except (
                        TypeError,
                        ValueError
                    ):

                        return api_response(
                            message=(
                                "current_semester must be "
                                "a valid integer."
                            ),
                            status_code=(
                                status.HTTP_400_BAD_REQUEST
                            )
                        )

                    if (
                        current_semester < 1
                        or
                        current_semester
                        > new_version.program.total_semesters
                    ):

                        return api_response(
                            message=(
                                f"Current semester must be "
                                f"between 1 and "
                                f"{new_version.program.total_semesters}."
                            ),
                            status_code=(
                                status.HTTP_400_BAD_REQUEST
                            )
                        )

                # --------------------------------------------
                # Complete
                # --------------------------------------------

                else:

                    current_semester = None

                new_version.curriculum_mode = (
                    curriculum_mode
                )

                if hasattr(
                    batch,
                    'curriculum_mode'
                ):

                    batch.curriculum_mode = (
                        curriculum_mode
                    )

                if (
                    curriculum_mode == 'progressive'
                    and
                    hasattr(
                        batch,
                        'current_semester'
                    )
                ):

                    batch.current_semester = (
                        current_semester
                    )

                batch.save()

            serializer = self.get_serializer(
                new_version,
                context={
                    'view_type': 'detail',
                    'batch_id': batch.id
                }
            )

            return api_response(
                data=serializer.data,
                message=(
                    "Curriculum version cloned "
                    "successfully."
                ),
                status_code=status.HTTP_201_CREATED
            )

        except ValidationError as e:

            return api_response(
                message=str(e),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        except Exception as e:

            return api_response(
                message=str(e),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

    # ========================================================
    # ASSIGN BATCH TO EXISTING CURRICULUM VERSION
    # ========================================================

    @action(
        detail=True,
        methods=['post'],
        url_path='assign_batch'
    )
    def assign_batch(
        self,
        request,
        pk=None
    ):

        version = self.get_object()

        batch_id = (
            request.data.get('batch_id')
            or
            request.query_params.get('batch_id')
        )

        curriculum_mode = request.data.get(
            'curriculum_mode',
            version.curriculum_mode
        )

        current_semester = request.data.get(
            'current_semester'
        )

        if not batch_id:

            return api_response(
                message="batch_id is required.",
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        try:

            batch = Batch.objects.get(
                pk=batch_id
            )

        except Batch.DoesNotExist:

            return api_response(
                message="Batch not found.",
                status_code=(
                    status.HTTP_404_NOT_FOUND
                )
            )

        if (
            batch.program_id
            != version.program_id
        ):

            return api_response(
                message=(
                    "Batch program must match "
                    "curriculum version program."
                ),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        if (
            batch.curriculum_version_id
            and
            batch.curriculum_version_id != version.id
        ):

            return api_response(
                message=(
                    "This batch is already assigned "
                    "to another curriculum version."
                ),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        curriculum_mode = str(
            curriculum_mode
        ).lower()

        if curriculum_mode not in [
            'progressive',
            'complete'
        ]:

            return api_response(
                message=(
                    "curriculum_mode must be either "
                    "'progressive' or 'complete'."
                ),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        if curriculum_mode == 'progressive':

            if current_semester is None:

                current_semester = getattr(
                    batch,
                    'current_semester',
                    None
                )

            if current_semester is None:

                current_semester = 1

            try:

                current_semester = int(
                    current_semester
                )

            except (
                TypeError,
                ValueError
            ):

                return api_response(
                    message=(
                        "current_semester must be "
                        "a valid integer."
                    ),
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    )
                )

            if (
                current_semester < 1
                or
                current_semester
                > version.program.total_semesters
            ):

                return api_response(
                    message=(
                        f"Current semester must be between "
                        f"1 and "
                        f"{version.program.total_semesters}."
                    ),
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    )
                )

        else:

            current_semester = None

        # ----------------------------------------------------
        # Assign version
        # ----------------------------------------------------

        batch.curriculum_version = version

        update_fields = [
            'curriculum_version'
        ]

        if hasattr(
            batch,
            'curriculum_mode'
        ):

            batch.curriculum_mode = (
                curriculum_mode
            )

            update_fields.append(
                'curriculum_mode'
            )

        if (
            curriculum_mode == 'progressive'
            and
            hasattr(
                batch,
                'current_semester'
            )
        ):

            batch.current_semester = (
                current_semester
            )

            update_fields.append(
                'current_semester'
            )

        batch.save(
            update_fields=update_fields
        )

        # ----------------------------------------------------
        # Update version mode
        # ----------------------------------------------------

        version.curriculum_mode = (
            curriculum_mode
        )

        version.curriculum_mode = curriculum_mode

        version.save(
            update_fields=[
                'curriculum_mode'
                
            ]
        )

        serializer = self.get_serializer(
            version,
            context={
                'view_type': 'detail',
                'batch_id': batch.id
            }
        )

        return api_response(
            data=serializer.data,
            message=(
                "Batch assigned to curriculum "
                "version successfully."
            ),
            status_code=status.HTTP_200_OK
        )

    # ========================================================
    # FINALIZE VERSION
    # ========================================================

    @action(
        detail=True,
        methods=['post']
    )
    def finalize(
        self,
        request,
        pk=None
    ):

        version = self.get_object()

        user = request.user

        effective_role = (
            user.active_role or user.role
        )

        effective_role = (
            effective_role.lower()
            if effective_role
            else ''
        )

        if effective_role not in [
            'coordinator',
            'hod'
        ]:

            return api_response(
                message=(
                    "Only Coordinators and HODs "
                    "can finalize curriculum versions."
                ),
                status_code=(
                    status.HTTP_403_FORBIDDEN
                )
            )

        if version.status == 'finalized':

            return api_response(
                message=(
                    "This curriculum version is "
                    "already finalized."
                ),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        try:

            activated_version = (
                activate_curriculum_version(
                    version,
                    request.user
                )
            )

            serializer = self.get_serializer(
                activated_version
            )

            return api_response(
                data=serializer.data,
                message=(
                    "Curriculum version finalized "
                    "successfully."
                ),
                status_code=status.HTTP_200_OK
            )

        except ValidationError as e:

            return api_response(
                message=str(e),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        except Exception as e:

            return api_response(
                message=str(e),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

    # ========================================================
    # MASTER FINALIZED CURRICULUMS
    # ========================================================

    @action(
        detail=False,
        methods=['get']
    )
    def master(
        self,
        request
    ):

        program_id = (
            request.query_params.get(
                'program_id'
            )
        )

        queryset = (
            self.get_queryset()
            .filter(
                status='finalized'
            )
        )

        if program_id:

            queryset = queryset.filter(
                program_id=program_id
            )

        serializer = self.get_serializer(
            queryset,
            many=True
        )

        return api_response(
            data=serializer.data,
            message=(
                "Master curricula fetched "
                "successfully."
            ),
            status_code=status.HTTP_200_OK
        )

    # ========================================================
    # CURRICULUM VERSION HISTORY
    # ========================================================

    @action(
        detail=False,
        methods=['get'],
        url_path='history'
    )
    def history(
        self,
        request
    ):

        program_id = (
            request.query_params.get(
                'program_id'
            )
        )

        queryset = (
            CurriculumVersion.objects.all()
        )

        user = request.user

        effective_role = (
            user.active_role or user.role
        )

        effective_role = (
            effective_role.lower()
            if effective_role
            else ''
        )

        if effective_role in [
            'coordinator',
            'hod'
        ]:

            queryset = queryset.filter(
                program__in=user.programs.all()
            )

        if program_id:

            try:

                UUID(
                    str(program_id)
                )

            except (
                ValueError,
                AttributeError
            ):

                return api_response(
                    message="Invalid program UUID.",
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    )
                )

            queryset = queryset.filter(
                program_id=program_id
            )

        queryset = queryset.order_by(
            '-created_at'
        )

        serializer = self.get_serializer(
            queryset,
            many=True
        )

        return api_response(
            data=serializer.data,
            message=(
                "Curriculum version history "
                "fetched successfully."
            ),
            status_code=status.HTTP_200_OK
        )

    # ========================================================
    # ADD COURSE DIRECTLY TO VERSION
    # ========================================================

    @action(
        detail=True,
        methods=['post'],
        url_path='add-course'
    )
    def add_course(
        self,
        request,
        pk=None
    ):

        version = self.get_object()

        batch_id = request.data.get(
            'batch_id'
        )

        course_id = request.data.get(
            'course_id'
        )

        semester = request.data.get(
            'semester'
        )

        if not course_id or semester is None:

            return api_response(
                message=(
                    "Course ID and semester "
                    "are required."
                ),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        if not version.is_editable():

            return api_response(
                message=(
                    "Cannot add course to a finalized "
                    "or archived curriculum version."
                ),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        # ----------------------------------------------------
        # Semester
        # ----------------------------------------------------

        try:

            semester_no = int(
                semester
            )

        except (
            TypeError,
            ValueError
        ):

            return api_response(
                message=(
                    "Semester must be a valid integer."
                ),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        # ----------------------------------------------------
        # Batch handling
        # ----------------------------------------------------

        batch = None

        if batch_id:

            try:

                batch = Batch.objects.get(
                    pk=batch_id
                )

            except Batch.DoesNotExist:

                return api_response(
                    message="Batch not found.",
                    status_code=(
                        status.HTTP_404_NOT_FOUND
                    )
                )

            if (
                batch.program_id
                != version.program_id
            ):

                return api_response(
                    message=(
                        "Batch program must match "
                        "curriculum version program."
                    ),
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    )
                )

            if (
                batch.curriculum_version_id
                != version.id
            ):

                return api_response(
                    message=(
                        "This batch is not assigned "
                        "to this curriculum version."
                    ),
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    )
                )

        elif (
            version.curriculum_mode
            == 'progressive'
        ):

            return api_response(
                message=(
                    "Batch is required for "
                    "progressive curriculum editing."
                ),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        # ----------------------------------------------------
        # Semester validation
        # ----------------------------------------------------

        if (
            semester_no < 1
            or
            semester_no
            > version.program.total_semesters
        ):

            return api_response(
                message=(
                    f"Semester must be between 1 and "
                    f"{version.program.total_semesters}."
                ),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        try:

            validate_semester_editable(
                version=version,
                semester_no=semester_no,
                batch=batch
            )

        except ValidationError as e:

            return api_response(
                message=str(e),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        # ----------------------------------------------------
        # Course
        # ----------------------------------------------------

        try:

            course = Course.objects.get(
                id=course_id
            )

        except Course.DoesNotExist:

            return api_response(
                message="Course not found.",
                status_code=(
                    status.HTTP_404_NOT_FOUND
                )
            )

        if (
            course.program_id
            != version.program_id
        ):

            return api_response(
                message=(
                    "Course program must match "
                    "version program."
                ),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        # ----------------------------------------------------
        # Duplicate
        # ----------------------------------------------------

        if CurriculumVersionCourse.objects.filter(
            version=version,
            course=course,
            is_active=True
        ).exists():

            return api_response(
                message=(
                    "This course is already present "
                    "in this curriculum version."
                ),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        # ----------------------------------------------------
        # Create course
        # ----------------------------------------------------

        curriculum_course = (
            CurriculumVersionCourse.objects.create(
                version=version,
                course=course,
                semester_no=semester_no,
                is_active=True
            )
        )

        # ----------------------------------------------------
        # CREATE COURSE HISTORY
        # ----------------------------------------------------

        CurriculumCourseHistory.objects.create(
            version=version,
            course=course,
            action='added',
            old_semester=None,
            new_semester=semester_no,
            old_data=None,
            new_data={
                'semester_no': semester_no
            },
            changed_by=request.user
        )

        serializer = self.get_serializer(
            version
        )

        return api_response(
            data=serializer.data,
            message="Course added successfully.",
            status_code=status.HTTP_201_CREATED
        )

    # ========================================================
    # COURSE HISTORY
    # ========================================================

    @action(
        detail=True,
        methods=['get'],
        url_path='course-history'
    )
    def course_history(
        self,
        request,
        pk=None
    ):

        # ----------------------------------------------------
        # Get curriculum version
        # ----------------------------------------------------

        version = self.get_object()

        # ----------------------------------------------------
        # Get history records
        # ----------------------------------------------------

        queryset = (
            CurriculumCourseHistory.objects
            .filter(
                version=version
            )
            .select_related(
                'course',
                'changed_by'
            )
            .order_by(
                '-created_at'
            )
        )

        # ----------------------------------------------------
        # Optional course filter
        # ----------------------------------------------------

        course_id = request.query_params.get(
            'course_id'
        )

        if course_id:

            queryset = queryset.filter(
                course_id=course_id
            )

        # ----------------------------------------------------
        # Build response
        # ----------------------------------------------------

        data = []

        for record in queryset:

            semester_no = (
                record.new_semester
                if record.new_semester is not None
                else record.old_semester
            )

            data.append({

                'id': record.id,

                'course_id': record.course_id,

                'course_code': (
                    record.course.code
                    if record.course
                    else None
                ),

                'course_name': (
                    record.course.name
                    if record.course
                    else None
                ),

                'action': record.action,

                'old_semester': (
                    record.old_semester
                ),

                'new_semester': (
                    record.new_semester
                ),

                # Important for frontend
                'semester_no': semester_no,

                'old_data': (
                    record.old_data
                ),

                'new_data': (
                    record.new_data
                ),

                'changed_by': (
                    record.changed_by_id
                ),

                'changed_by_name': (
                    str(record.changed_by)
                    if record.changed_by
                    else None
                ),

                'created_at': (
                    record.created_at
                ),

                'reason': (
                    record.reason
                ),
            })

        return api_response(
            data=data,
            message=(
                "Course history fetched "
                "successfully."
            ),
            status_code=status.HTTP_200_OK
        )
# ============================================================
# CURRICULUM VERSION COURSE VIEWSET
# ============================================================

from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError

from curriculum.models import (
    CurriculumVersion,
    CurriculumVersionCourse,
    CurriculumCourseHistory,
)

from core.models import Course
from core.models.batch import Batch

from .serializers import CurriculumVersionCourseSerializer

# Import these from wherever they already exist in your project
from curriculum.services import validate_semester_editable

# Import your custom response helper
# from core.utils.response import api_response


from rest_framework import (
    viewsets,
    status,
)

from rest_framework.permissions import (
    IsAuthenticated,
)

from rest_framework.exceptions import (
    ValidationError,
)

from .models import (
    CurriculumVersion,
    CurriculumVersionCourse,
    CurriculumCourseHistory,
)

from core.models.batch import Batch

from .serializers import (
    CurriculumVersionCourseSerializer,
)

from .services import (
    validate_semester_editable,
)

# IMPORTANT:
# api_response apne project ke actual import ke according rakho
# from core.utils.response import api_response


class CurriculumVersionCourseViewSet(
    viewsets.ModelViewSet
):

    queryset = (
        CurriculumVersionCourse.objects.all()
    )

    serializer_class = (
        CurriculumVersionCourseSerializer
    )

    permission_classes = [
        IsAuthenticated
    ]

    # ========================================================
    # QUERYSET
    # ========================================================

    def get_queryset(self):

        version_id = self.kwargs.get(
            'version_pk'
        )

        return (
            super()
            .get_queryset()
            .filter(
                version_id=version_id,
                is_active=True
            )
        )

    # ========================================================
    # SERIALIZER CONTEXT
    # ========================================================

    def get_serializer_context(self):

        context = (
            super()
            .get_serializer_context()
        )

        version_id = self.kwargs.get(
            'version_pk'
        )

        try:

            context['version'] = (
                CurriculumVersion.objects.get(
                    pk=version_id
                )
            )

        except CurriculumVersion.DoesNotExist:

            context['version'] = None

        return context

    # ========================================================
    # CREATE COURSE
    # ========================================================

    def perform_create(
        self,
        serializer
    ):

        version_id = self.kwargs.get(
            'version_pk'
        )

        # ----------------------------------------------------
        # Get version
        # ----------------------------------------------------

        try:

            version = (
                CurriculumVersion.objects.get(
                    pk=version_id
                )
            )

        except CurriculumVersion.DoesNotExist:

            raise ValidationError(
                "Curriculum version not found."
            )

        # ----------------------------------------------------
        # Get batch
        # ----------------------------------------------------

        batch_id = self.request.data.get(
            'batch_id'
        )

        batch = None

        if batch_id:

            try:

                batch = Batch.objects.get(
                    pk=batch_id
                )

            except Batch.DoesNotExist:

                raise ValidationError(
                    "Batch not found."
                )

            if (
                batch.program_id
                != version.program_id
            ):

                raise ValidationError(
                    "Batch program must match "
                    "curriculum version program."
                )

            if (
                batch.curriculum_version_id
                != version.id
            ):

                raise ValidationError(
                    "This batch is not assigned "
                    "to this curriculum version."
                )

        # ----------------------------------------------------
        # Permission
        # ----------------------------------------------------

        if version.curriculum_mode == 'progressive':

            if batch is None:

                raise ValidationError(
                    "Batch is required for "
                    "progressive curriculum editing."
                )

        else:

            if not version.is_editable():

                raise ValidationError(
                    "Cannot add course to a finalized "
                    "curriculum version. Clone it first."
                )

        # ----------------------------------------------------
        # Semester
        # ----------------------------------------------------

        semester = self.request.data.get(
            'semester_no'
        )

        if semester is None:

            raise ValidationError(
                "Semester is required."
            )

        try:

            semester_no = int(
                semester
            )

        except (
            TypeError,
            ValueError
        ):

            raise ValidationError(
                "Semester must be a valid integer."
            )

        # ----------------------------------------------------
        # Semester range
        # ----------------------------------------------------

        if (
            semester_no < 1
            or
            semester_no
            > version.program.total_semesters
        ):

            raise ValidationError(
                f"Semester must be between 1 and "
                f"{version.program.total_semesters}."
            )

        # ----------------------------------------------------
        # Semester editability
        # ----------------------------------------------------

        validate_semester_editable(
            version=version,
            semester_no=semester_no,
            batch=batch
        )

        # ----------------------------------------------------
        # Duplicate course
        # ----------------------------------------------------

        course_id = self.request.data.get(
            'course'
        )

        if course_id:

            exists = (
                CurriculumVersionCourse.objects.filter(
                    version=version,
                    course_id=course_id,
                    is_active=True
                ).exists()
            )

            if exists:

                raise ValidationError(
                    "This course is already present "
                    "in this curriculum version."
                )

        # ----------------------------------------------------
        # Save curriculum course
        # ----------------------------------------------------

        curriculum_course = serializer.save(
            version=version,
            semester_no=semester_no
        )

        # ====================================================
        # CREATE ADD HISTORY
        # ====================================================

        CurriculumCourseHistory.objects.create(

            version=version,

            course=curriculum_course.course,

            action='added',

            old_semester=None,

            new_semester=semester_no,

            old_data=None,

            new_data={
                'semester_no': semester_no
            },

            changed_by=(
                self.request.user
                if self.request.user.is_authenticated
                else None
            ),

            reason='Course added to curriculum'
        )

    # ========================================================
    # CREATE OVERRIDE
    # ========================================================

    def create(
        self,
        request,
        *args,
        **kwargs
    ):

        version_id = self.kwargs.get(
            'version_pk'
        )

        # ----------------------------------------------------
        # Get version
        # ----------------------------------------------------

        try:

            version = (
                CurriculumVersion.objects.get(
                    pk=version_id
                )
            )

        except CurriculumVersion.DoesNotExist:

            return api_response(
                message=(
                    "Curriculum version not found."
                ),
                status_code=(
                    status.HTTP_404_NOT_FOUND
                )
            )

        # ----------------------------------------------------
        # Progressive / normal
        # ----------------------------------------------------

        batch_id = request.data.get(
            'batch_id'
        )

        if version.curriculum_mode == 'progressive':

            if not batch_id:

                return api_response(
                    message=(
                        "Batch is required for "
                        "progressive curriculum editing."
                    ),
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    )
                )

        else:

            if not version.is_editable():

                return api_response(
                    message=(
                        "This curriculum version is "
                        "finalized. Clone it before "
                        "making changes."
                    ),
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    )
                )

        # ----------------------------------------------------
        # Serializer
        # ----------------------------------------------------

        serializer = self.get_serializer(
            data=request.data
        )

        if not serializer.is_valid():

            return api_response(
                message="Validation failed.",
                data={
                    "errors": serializer.errors,
                    "request_data": request.data,
                    "version_pk": version_id,
                    "version_status": version.status,
                    "curriculum_mode": (
                        version.curriculum_mode
                    ),
                },
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        # ----------------------------------------------------
        # Create
        # ----------------------------------------------------

        try:

            self.perform_create(
                serializer
            )

            return api_response(
                data=serializer.data,
                message=(
                    "Course added to curriculum "
                    "version successfully."
                ),
                status_code=(
                    status.HTTP_201_CREATED
                )
            )

        except ValidationError as e:

            return api_response(
                message=str(e),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        except Exception as e:

            return api_response(
                message=str(e),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

    # ========================================================
    # UPDATE COURSE
    # ========================================================

    def partial_update(
        self,
        request,
        *args,
        **kwargs
    ):

        instance = self.get_object()

        version = instance.version

        # ----------------------------------------------------
        # Batch
        # ----------------------------------------------------

        batch_id = request.data.get(
            'batch_id'
        )

        batch = None

        if batch_id:

            try:

                batch = Batch.objects.get(
                    pk=batch_id
                )

            except Batch.DoesNotExist:

                return api_response(
                    message="Batch not found.",
                    status_code=(
                        status.HTTP_404_NOT_FOUND
                    )
                )

            if (
                batch.program_id
                != version.program_id
            ):

                return api_response(
                    message=(
                        "Batch program must match "
                        "curriculum version program."
                    ),
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    )
                )

            if (
                batch.curriculum_version_id
                != version.id
            ):

                return api_response(
                    message=(
                        "This batch is not assigned "
                        "to this curriculum version."
                    ),
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    )
                )

        # ----------------------------------------------------
        # Permission
        # ----------------------------------------------------

        if version.curriculum_mode == 'progressive':

            if batch is None:

                return api_response(
                    message=(
                        "Batch is required for "
                        "progressive curriculum editing."
                    ),
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    )
                )

        else:

            if not version.is_editable():

                return api_response(
                    message=(
                        "Cannot update course in a "
                        "finalized curriculum version."
                    ),
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    )
                )

        # ----------------------------------------------------
        # Get old semester
        # IMPORTANT: before save
        # ----------------------------------------------------

        old_semester = instance.semester_no

        # ----------------------------------------------------
        # Semester validation
        # ----------------------------------------------------

        semester_no = request.data.get(
            'semester_no'
        )

        if semester_no is not None:

            try:

                semester_no = int(
                    semester_no
                )

            except (
                TypeError,
                ValueError
            ):

                return api_response(
                    message=(
                        "Semester must be a "
                        "valid integer."
                    ),
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    )
                )

            if (
                semester_no < 1
                or
                semester_no
                > version.program.total_semesters
            ):

                return api_response(
                    message=(
                        f"Semester must be between 1 "
                        f"and "
                        f"{version.program.total_semesters}."
                    ),
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    )
                )

            try:

                validate_semester_editable(
                    version=version,
                    semester_no=semester_no,
                    batch=batch
                )

            except ValidationError as e:

                return api_response(
                    message=str(e),
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    )
                )

        # ----------------------------------------------------
        # Serializer validation
        # ----------------------------------------------------

        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=True
        )

        if not serializer.is_valid():

            return api_response(
                message="Validation failed.",
                data={
                    "errors": serializer.errors
                },
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        # ----------------------------------------------------
        # Save
        # ----------------------------------------------------

        try:

            updated_instance = serializer.save()

        except ValidationError as e:

            return api_response(
                message=str(e),
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                )
            )

        # ====================================================
        # CREATE SEMESTER HISTORY
        # ====================================================

        new_semester = (
            updated_instance.semester_no
        )

        if old_semester != new_semester:

            CurriculumCourseHistory.objects.create(

                version=version,

                course=updated_instance.course,

                action='semester_changed',

                old_semester=old_semester,

                new_semester=new_semester,

                old_data={
                    'semester_no': old_semester
                },

                new_data={
                    'semester_no': new_semester
                },

                changed_by=(
                    request.user
                    if request.user.is_authenticated
                    else None
                ),

                reason='Course semester changed'
            )

        # ----------------------------------------------------
        # Response
        # ----------------------------------------------------

        serializer = self.get_serializer(
            updated_instance
        )

        return api_response(
            data=serializer.data,
            message=(
                "Course updated successfully."
            ),
            status_code=(
                status.HTTP_200_OK
            )
        )

    # ========================================================
    # FULL UPDATE
    # ========================================================

    def update(
        self,
        request,
        *args,
        **kwargs
    ):

        kwargs['partial'] = False

        return self.partial_update(
            request,
            *args,
            **kwargs
        )

    # ========================================================
    # DELETE / SOFT DELETE
    # ========================================================

    def destroy(
        self,
        request,
        *args,
        **kwargs
    ):

        instance = self.get_object()

        version = instance.version

        # ----------------------------------------------------
        # Batch
        # ----------------------------------------------------

        batch_id = request.data.get(
            'batch_id'
        )

        batch = None

        if batch_id:

            try:

                batch = Batch.objects.get(
                    pk=batch_id
                )

            except Batch.DoesNotExist:

                return api_response(
                    message="Batch not found.",
                    status_code=(
                        status.HTTP_404_NOT_FOUND
                    )
                )

            if (
                batch.program_id
                != version.program_id
            ):

                return api_response(
                    message=(
                        "Batch program must match "
                        "curriculum version program."
                    ),
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    )
                )

            if (
                batch.curriculum_version_id
                != version.id
            ):

                return api_response(
                    message=(
                        "This batch is not assigned "
                        "to this curriculum version."
                    ),
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    )
                )

        # ----------------------------------------------------
        # Permission
        # ----------------------------------------------------

        if version.curriculum_mode == 'progressive':

            if batch is None:

                return api_response(
                    message=(
                        "Batch is required for "
                        "progressive curriculum editing."
                    ),
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    )
                )

        else:

            if not version.is_editable():

                return api_response(
                    message=(
                        "Cannot delete course from a "
                        "finalized curriculum version."
                    ),
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    )
                )

        # ====================================================
        # CREATE DELETE HISTORY
        # ====================================================

        CurriculumCourseHistory.objects.create(

            version=version,

            course=instance.course,

            action='removed',

            old_semester=instance.semester_no,

            new_semester=None,

            old_data={
                'semester_no': instance.semester_no
            },

            new_data=None,

            changed_by=(
                request.user
                if request.user.is_authenticated
                else None
            ),

            reason='Course removed from curriculum'
        )

        # ----------------------------------------------------
        # Soft delete
        # ----------------------------------------------------

        instance.is_active = False

        instance.save(
            update_fields=[
                'is_active'
            ]
        )

        return api_response(
            message=(
                "Course removed successfully."
            ),
            status_code=(
                status.HTTP_204_NO_CONTENT
            )
        )
