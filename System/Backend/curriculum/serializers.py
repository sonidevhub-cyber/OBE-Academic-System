from rest_framework import serializers

from .models import (
    CurriculumVersion,
    CurriculumVersionCourse,
    CurriculumCourseHistory,
)

from core.serializers.course import CourseSerializer
from core.models import Course


# ============================================================
# CURRICULUM VERSION COURSE SERIALIZER
# ============================================================

class CurriculumVersionCourseSerializer(
    serializers.ModelSerializer
):

    course = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.filter(
            is_active=True
        )
    )

    course_code = serializers.ReadOnlyField(
        source="course.code"
    )

    course_name = serializers.ReadOnlyField(
        source="course.name"
    )

    course_type = serializers.ReadOnlyField(
        source="course.course_type"
    )

    credit_hours = serializers.ReadOnlyField(
        source="course.credit_hours"
    )

    class Meta:

        model = CurriculumVersionCourse

        fields = [
            "id",
            "course",
            "course_code",
            "course_name",
            "course_type",
            "credit_hours",
            "semester_no",
            "is_active",
        ]

        read_only_fields = [
            "is_active",
        ]

    # ========================================================
    # VALIDATION
    # ========================================================

    def validate(self, attrs):

        version = self.context.get("version")

        if not version:

            raise serializers.ValidationError(
                "Curriculum version not found."
            )

        course = attrs.get(
            "course",
            getattr(
                self.instance,
                "course",
                None,
            ),
        )

        semester_no = attrs.get(
            "semester_no",
            getattr(
                self.instance,
                "semester_no",
                None,
            ),
        )

        # ----------------------------------------------------
        # Archived version
        # ----------------------------------------------------

        if version.status == "archived":

            raise serializers.ValidationError(
                "Archived curriculum version "
                "cannot be modified."
            )

        # ----------------------------------------------------
        # Course program validation
        # ----------------------------------------------------

        if (
            course
            and course.program_id
            != version.program_id
        ):

            raise serializers.ValidationError(
                "Course program must match "
                "curriculum version program."
            )

        # ----------------------------------------------------
        # Semester validation
        # ----------------------------------------------------

        if semester_no is None:

            raise serializers.ValidationError(
                "Semester number is required."
            )

        try:

            semester_no = int(
                semester_no
            )

        except (
            TypeError,
            ValueError,
        ):

            raise serializers.ValidationError(
                {
                    "semester_no":
                    "Invalid semester number."
                }
            )

        if semester_no < 1:

            raise serializers.ValidationError(
                {
                    "semester_no":
                    "Semester number must be at least 1."
                }
            )

        if (
            semester_no
            > version.program.total_semesters
        ):

            raise serializers.ValidationError(
                {
                    "semester_no":
                    f"Semester number cannot exceed "
                    f"program total semesters "
                    f"({version.program.total_semesters})."
                }
            )

        # ----------------------------------------------------
        # COMPLETE MODE
        # ----------------------------------------------------

        if version.curriculum_mode == "complete":

            if version.status == "finalized":

                raise serializers.ValidationError(
                    "Finalized Complete curriculum "
                    "cannot be modified."
                )

        # ----------------------------------------------------
        # PROGRESSIVE MODE
        # ----------------------------------------------------

        elif version.curriculum_mode == "progressive":

            # ------------------------------------------------
            # Resolve selected batch.
            #
            # Priority:
            #   1. Explicit serializer context["batch"]
            #   2. serializer context["batch_id"]
            #   3. request.data["batch_id"]
            #
            # For CREATE requests, the frontend sends batch_id
            # in the POST payload. DRF may not put that value into
            # serializer context automatically, so request.data is
            # the final fallback.
            # ------------------------------------------------

            batch = self.context.get("batch")

            batch_id = self.context.get("batch_id")

            request = self.context.get("request")

            if not batch_id and request is not None:
                try:
                    batch_id = request.data.get("batch_id")
                except Exception:
                    batch_id = None

            if not batch and batch_id:

                from core.models.batch import Batch

                try:
                    batch = Batch.objects.get(
                        pk=batch_id
                    )
                except Batch.DoesNotExist:
                    batch = None

            # ------------------------------------------------
            # Finalized Progressive curriculum
            # ------------------------------------------------

            if version.status == "finalized":

                if not batch:
                    raise serializers.ValidationError(
                        "Batch is required when editing "
                        "a finalized Progressive curriculum."
                    )

                # Selected batch must belong to this version.
                if (
                    batch.curriculum_version_id
                    != version.id
                ):
                    raise serializers.ValidationError(
                        "This batch is not assigned to "
                        "this curriculum version."
                    )

                # ------------------------------------------------
                # Only selected batch's current semester is editable
                # ------------------------------------------------

                from curriculum.services import (
                    validate_semester_editable
                )

                try:
                    validate_semester_editable(
                        version=version,
                        semester_no=semester_no,
                        batch=batch,
                    )
                except Exception as exc:
                    raise serializers.ValidationError(
                        {
                            "semester_no": str(exc)
                        }
                    )

            # Draft Progressive versions remain editable and do
            # not require a batch context.
        else:

            raise serializers.ValidationError(
                "Invalid curriculum mode."
            )

        return attrs


# ============================================================
# CURRICULUM VERSION SERIALIZER
# ============================================================

class CurriculumVersionSerializer(
    serializers.ModelSerializer
):

    assigned_batches = (
        serializers.SerializerMethodField()
    )

    program_name = serializers.ReadOnlyField(
        source="program.name"
    )

    program_total_semesters = (
        serializers.ReadOnlyField(
            source="program.total_semesters"
        )
    )

    created_by_name = serializers.ReadOnlyField(
        source="created_by.full_name"
    )

    cloned_from_version_no = (
        serializers.ReadOnlyField(
            source="cloned_from.version_no"
        )
    )

    total_courses = (
        serializers.SerializerMethodField()
    )

    is_editable = serializers.ReadOnlyField()

    curriculum_mode = serializers.ReadOnlyField()

    current_semester = (
        serializers.SerializerMethodField()
    )

    class Meta:

        model = CurriculumVersion

        fields = [
            "id",

            "program",
            "program_name",
            "program_total_semesters",

            "curriculum_mode",
            "current_semester",

            "assigned_batches",

            "version_no",
            "status",

            "cloned_from",
            "cloned_from_version_no",

            "created_by",
            "created_by_name",

            "activated_by",
            "activated_at",

            "created_at",
            "updated_at",

            "is_active",

            "total_courses",
            "is_editable",
        ]

        read_only_fields = [
            "version_no",
            "status",
            "created_by",
            "activated_by",
            "activated_at",
        ]

    # ========================================================
    # ASSIGNED BATCHES
    # ========================================================

    def get_assigned_batches(self, obj):
      return [
        {
            "id": str(batch.id),
            "name": batch.name,
            "current_semester": getattr(
                batch,
                "current_semester",
                None
            ),

            # Send curriculum mode at batch level too.
            "curriculum_mode": getattr(
                batch,
                "curriculum_mode",
                None
            ),

            # Helpful aliases for existing frontend compatibility.
            "currentSemester": getattr(
                batch,
                "current_semester",
                None
            ),
            "batch_current_semester": getattr(
                batch,
                "current_semester",
                None
            ),
        }
        for batch in obj.assigned_batches.all()
    ]

    # ========================================================
    # TOTAL COURSES
    # ========================================================

    def get_total_courses(self, obj):

        return obj.version_courses.filter(
            is_active=True
        ).count()

    # ========================================================
    # CURRENT SEMESTER
    # ========================================================

    def get_current_semester(self, obj):

        # ----------------------------------------------------
        # Complete curriculum has no semester locking
        # ----------------------------------------------------

        if obj.curriculum_mode != "progressive":

            return None

        # ----------------------------------------------------
        # First try explicit batch object
        # ----------------------------------------------------

        batch = self.context.get(
            "batch"
        )

        # ----------------------------------------------------
        # Otherwise use batch_id
        # ----------------------------------------------------

        if not batch:

            batch_id = self.context.get(
                "batch_id"
            )

            request = self.context.get(
                "request"
            )

            if not batch_id and request is not None:
                try:
                    batch_id = (
                        request.query_params.get("batch_id")
                        or request.query_params.get("batch")
                        or request.data.get("batch_id")
                    )
                except Exception:
                    batch_id = None

            if batch_id:

                from core.models.batch import Batch

                try:

                    batch = Batch.objects.get(
                        pk=batch_id
                    )

                except Batch.DoesNotExist:

                    batch = None

        if not batch:

            return None

        return getattr(
            batch,
            "current_semester",
            None,
        )

    # ========================================================
    # REPRESENTATION
    # ========================================================

    def to_representation(
        self,
        instance
    ):

        representation = (
            super().to_representation(
                instance
            )
        )

        # ----------------------------------------------------
        # Detail view
        # ----------------------------------------------------

        if (
            self.context.get(
                "view_type"
            )
            == "detail"
        ):

            from coordinators.models import (
                TeacherAllocation
            )

            from coordinators.serializers import (
                TeacherAllocationSerializer
            )

            from core.models.batch import (
                Batch
            )

            courses = (
                instance.version_courses
                .filter(
                    is_active=True
                )
                .select_related(
                    "course"
                )
                .order_by(
                    "semester_no",
                    "course__name"
                )
            )

            grouped_courses = {}

            # ------------------------------------------------
            # Selected batch
            # ------------------------------------------------

            batch = self.context.get(
                "batch"
            )

            if not batch:

                batch_id = self.context.get(
                    "batch_id"
                )

                request = self.context.get(
                    "request"
                )

                if not batch_id and request is not None:
                    try:
                        batch_id = (
                            request.query_params.get("batch_id")
                            or request.query_params.get("batch")
                        )
                    except Exception:
                        batch_id = None

                if batch_id:

                    try:

                        batch = Batch.objects.get(
                            pk=batch_id
                        )

                    except Batch.DoesNotExist:

                        batch = None

            # ------------------------------------------------
            # Group courses semester-wise
            # ------------------------------------------------

            for vc in courses:

                sem_key = (
                    f"semester_{vc.semester_no}"
                )

                if sem_key not in grouped_courses:

                    grouped_courses[
                        sem_key
                    ] = []

                # --------------------------------------------
                # Course data
                # --------------------------------------------

                course_data = (
                    CurriculumVersionCourseSerializer(
                        vc,
                        context={
                            "version": instance,
                            "batch": batch,
                            "batch_id": (
                                batch.id
                                if batch
                                else None
                            ),
                        },
                    ).data
                )

                # --------------------------------------------
                # Teacher allocation
                # --------------------------------------------

                allocation_query = (
                    TeacherAllocation.objects.filter(
                        curriculum_version=instance,
                        course=vc.course,
                        semester_no=vc.semester_no,
                        status="active",
                        is_active=True,
                    )
                )

                # --------------------------------------------
                # If batch selected, filter allocation
                # for that batch
                # --------------------------------------------

                if batch:

                    allocation_query = (
                        allocation_query.filter(
                            batch=batch
                        )
                    )

                allocation = (
                    allocation_query
                    .first()
                )

                course_data["allocation"] = (
                    TeacherAllocationSerializer(
                        allocation
                    ).data
                    if allocation
                    else None
                )

                # --------------------------------------------
                # Lock status
                # --------------------------------------------

                course_data[
                    "is_locked"
                ] = self._is_course_locked(
                    version=instance,
                    semester_no=vc.semester_no,
                    batch=batch,
                )

                course_data[
                    "is_editable"
                ] = not course_data[
                    "is_locked"
                ]

                grouped_courses[
                    sem_key
                ].append(
                    course_data
                )

            representation[
                "courses_by_semester"
            ] = grouped_courses

        return representation

    # ========================================================
    # COURSE LOCK STATUS
    # ========================================================

    def _is_course_locked(
        self,
        version,
        semester_no,
        batch=None,
    ):
        """
        Returns True when the course cannot be edited.

        COMPLETE:
            Finalized -> everything locked

        PROGRESSIVE:
            Draft -> editable
            Finalized:
                previous semester -> locked
                current semester -> editable
                future semester -> locked
        """

        # ----------------------------------------------------
        # Draft
        # ----------------------------------------------------

        if version.status == "draft":

            return False

        # ----------------------------------------------------
        # Archived
        # ----------------------------------------------------

        if version.status == "archived":

            return True

        # ----------------------------------------------------
        # Complete
        # ----------------------------------------------------

        if version.curriculum_mode == "complete":

            return True

        # ----------------------------------------------------
        # Progressive
        # ----------------------------------------------------

        if version.curriculum_mode == "progressive":

            if not batch:

                return True

            current_semester = (
                getattr(
                    batch,
                    "current_semester",
                    None,
                )
                or 1
            )

            return (
                semester_no
                != current_semester
            )

        return True