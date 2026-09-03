from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

from .models import (
    CurriculumVersion,
    CurriculumVersionCourse,
)
from coordinators.models import TeacherAllocation


# ============================================================
# 1. CLONE / BRANCH VERSION FOR A SPECIFIC BATCH
# ============================================================

def branch_version_if_needed(version, batch, user):
    """
    Create a new curriculum version when a specific batch needs
    to modify a shared/finalized curriculum.

    Example:

        V1.0
        ├── Batch 2025
        └── Batch 2026

    If Batch 2026 needs a change:

        V1.0
        └── Batch 2025

        V1.1
        └── Batch 2026

    V1.0 is NOT modified.

    IMPORTANT:
    This branching is for batch-specific curriculum changes.

    It should NOT be used simply because a Progressive batch
    moves from Semester 1 to Semester 2.
    """

    if not batch:
        raise ValidationError(
            "Batch is required."
        )

    if batch.program_id != version.program_id:
        raise ValidationError(
            "Batch program must match curriculum version program."
        )

    # --------------------------------------------------------
    # If this batch already owns a draft version, use it.
    # --------------------------------------------------------

    if (
        version.status == "draft"
        and batch.curriculum_version_id == version.id
    ):
        return version

    with transaction.atomic():

        # ----------------------------------------------------
        # Generate next version number
        #
        # V1.0 -> V1.1 -> V1.2
        #
        # V2.0 -> V2.1
        # ----------------------------------------------------

        base_version = version.version_no

        if "." in base_version:
            major = base_version.split(".")[0]
        else:
            major = base_version

        existing_versions = (
            CurriculumVersion.objects.filter(
                program=version.program,
                version_no__startswith=f"{major}.",
            )
            .values_list("version_no", flat=True)
        )

        minor_numbers = []

        for version_no in existing_versions:

            try:
                minor = int(
                    version_no.split(".")[1]
                )
                minor_numbers.append(minor)

            except (IndexError, ValueError):
                continue

        next_minor = (
            max(minor_numbers, default=0) + 1
        )

        new_version_no = (
            f"{major}.{next_minor}"
        )

        # ----------------------------------------------------
        # Create new version
        # ----------------------------------------------------

        new_version = CurriculumVersion.objects.create(
            program=version.program,
            version_no=new_version_no,
            status="draft",
            curriculum_mode=version.curriculum_mode,
            cloned_from=version,
            created_by=user,
        )

        # ----------------------------------------------------
        # Only requested batch moves to new version
        # ----------------------------------------------------

        batch.curriculum_version = new_version

        batch.save(
            update_fields=[
                "curriculum_version"
            ]
        )

        # ----------------------------------------------------
        # Copy courses
        # ----------------------------------------------------

        for vc in version.version_courses.filter(
            is_active=True
        ):

            CurriculumVersionCourse.objects.create(
                version=new_version,
                course=vc.course,
                semester_no=vc.semester_no,
                is_active=True,
            )

        # ----------------------------------------------------
        # Copy CLO + CLO-GA mappings
        # ----------------------------------------------------

        clone_obe_data(
            version,
            new_version
        )

        # ----------------------------------------------------
        # Note: Teacher allocations are NOT cloned automatically.
        # Allocations must be created through the dedicated
        # Course Allocation UI by coordinators.
        # ----------------------------------------------------

        return new_version


# ============================================================
# 2. CLONE OBE DATA
# ============================================================

def clone_obe_data(
    source_version,
    new_version,
):
    """
    Copy active CLOs and CLO-GA mappings from source version
    to new version.
    """

    from obe.models import CLO, CLOGAMapping

    source_clos = CLO.objects.filter(
        curriculum_version=source_version,
        is_active=True,
    )

    for source_clo in source_clos:

        new_clo = CLO.objects.create(
            course=source_clo.course,
            curriculum_version=new_version,
            title=source_clo.title,
            description=source_clo.description,
            order_number=source_clo.order_number,
            bloom_level=source_clo.bloom_level,
            kpi_target=source_clo.kpi_target,
            is_active=True,
        )

        mappings = CLOGAMapping.objects.filter(
            clo=source_clo,
            is_active=True,
        )

        for mapping in mappings:

            CLOGAMapping.objects.create(
                clo=new_clo,
                ga=mapping.ga,
                weight=mapping.weight,
                is_active=True,
            )


# ============================================================
# 3. SUGGEST CURRICULUM FOR NEW BATCH
# ============================================================

def suggest_curriculum_for_new_batch(batch):
    """
    Assign the latest finalized curriculum to a new batch.

    IMPORTANT:
    We DO NOT clone just because a new batch is created.

    A clone is created only when the batch actually needs
    a curriculum modification.
    """

    latest_finalized = (
        CurriculumVersion.objects.filter(
            program=batch.program,
            status="finalized",
            is_active=True,
        )
        .order_by("-created_at")
        .first()
    )

    if latest_finalized:

        batch.curriculum_version = (
            latest_finalized
        )

        batch.save(
            update_fields=[
                "curriculum_version"
            ]
        )

        create_offerings_from_version(
            latest_finalized,
            target_batch=batch,
        )

        return latest_finalized

    # --------------------------------------------------------
    # No finalized curriculum exists.
    # Create first V1.0.
    # --------------------------------------------------------

    version = CurriculumVersion.objects.create(
        program=batch.program,
        version_no="v1.0",
        status="draft",
        curriculum_mode="progressive",
        created_by=batch.program.created_by,
    )

    batch.curriculum_version = version

    batch.save(
        update_fields=[
            "curriculum_version"
        ]
    )

    return version


# ============================================================
# 4. FINALIZE CURRICULUM
# ============================================================

def activate_curriculum_version(
    version,
    activated_by,
):
    """
    Finalize a draft curriculum.

    Progressive:
        Curriculum can be prepared semester by semester.

    Complete:
        All semesters must be defined before finalization.

    IMPORTANT:
        Finalization does NOT globally archive every other
        version of the program.

        A previous version is archived only when the same
        active batch is being moved to the new version.
    """

    with transaction.atomic():

        # ----------------------------------------------------
        # Version must be draft
        # ----------------------------------------------------

        if version.status != "draft":

            raise ValidationError(
                "Only draft versions can be finalized."
            )

        # ----------------------------------------------------
        # At least one course required
        # ----------------------------------------------------

        courses = version.version_courses.filter(
            is_active=True
        )

        if not courses.exists():

            raise ValidationError(
                "Curriculum version must have at least one course."
            )

        # ----------------------------------------------------
        # COMPLETE MODE
        # ----------------------------------------------------

        if version.curriculum_mode == "complete":

            total_semesters = (
                version.program.total_semesters
            )

            semester_numbers = set(
                courses.values_list(
                    "semester_no",
                    flat=True,
                )
            )

            missing_semesters = [
                semester
                for semester in range(
                    1,
                    total_semesters + 1,
                )
                if semester not in semester_numbers
            ]

            if missing_semesters:

                raise ValidationError(
                    "Complete mode requires curriculum data "
                    "for all semesters. Missing semesters: "
                    f"{', '.join(map(str, missing_semesters))}"
                )

        # ----------------------------------------------------
        # Find active batches using this version
        # ----------------------------------------------------

        active_batch_ids = set(
            version.assigned_batches
            .filter(is_active=True)
            .values_list("id", flat=True)
        )

        # ----------------------------------------------------
        # Archive older finalized version ONLY if the same
        # active batch is being moved to the new version.
        # ----------------------------------------------------

        previous_versions = (
            CurriculumVersion.objects.filter(
                program=version.program,
                status="finalized",
                is_active=True,
            )
            .exclude(pk=version.pk)
        )

        for previous_version in previous_versions:

            previous_batch_ids = set(
                previous_version.assigned_batches
                .filter(is_active=True)
                .values_list("id", flat=True)
            )

            if active_batch_ids.intersection(
                previous_batch_ids
            ):

                previous_version.status = "archived"

                previous_version.save(
                    update_fields=[
                        "status",
                        "updated_at",
                    ]
                )

        # ----------------------------------------------------
        # Finalize current version
        # ----------------------------------------------------

        version.status = "finalized"
        version.activated_by = activated_by
        version.activated_at = timezone.now()

        version.save(
            update_fields=[
                "status",
                "activated_by",
                "activated_at",
                "updated_at",
            ]
        )

        return version


# ============================================================
# 5. ADD / EDIT SEMESTER VALIDATION
# ============================================================

def validate_semester_editable(
    version,
    semester_no,
    batch=None,
):
    """
    Validate whether a semester can be edited.

    COMPLETE MODE
    --------------
    Draft:
        editable

    Finalized:
        completely locked


    PROGRESSIVE MODE
    ----------------
    Draft:
        editable

    Finalized:
        previous semesters -> locked
        current semester   -> editable
        future semesters   -> locked

    Example:

        batch.current_semester = 2

        Semester 1 -> LOCKED
        Semester 2 -> EDITABLE
        Semester 3 -> LOCKED
    """

    # ========================================================
    # Validate semester number
    # ========================================================

    try:
        semester_no = int(
            semester_no
        )

    except (
        TypeError,
        ValueError,
    ):

        raise ValidationError(
            "Invalid semester number."
        )

    if semester_no < 1:

        raise ValidationError(
            "Semester number must be at least 1."
        )

    if (
        semester_no
        > version.program.total_semesters
    ):

        raise ValidationError(
            f"Semester number cannot exceed "
            f"program total semesters "
            f"({version.program.total_semesters})."
        )

    # ========================================================
    # COMPLETE MODE
    # ========================================================

    if version.curriculum_mode == "complete":

        # Draft -> fully editable
        if version.status == "draft":
            return True

        # Finalized/Archived -> locked
        raise ValidationError(
            "Complete curriculum version is finalized "
            "and cannot be edited."
        )

    # ========================================================
    # PROGRESSIVE MODE
    # ========================================================

    if version.curriculum_mode == "progressive":

        if not batch:

            raise ValidationError(
                "Batch is required for progressive "
                "curriculum editing."
            )

        # ----------------------------------------------------
        # Batch must use this curriculum version
        # ----------------------------------------------------

        if (
            batch.curriculum_version_id
            != version.id
        ):

            raise ValidationError(
                "This batch is not assigned to "
                "this curriculum version."
            )

        # ----------------------------------------------------
        # Graduated batches can never be edited
        # ----------------------------------------------------

        if getattr(batch, "status", None) == "graduated":

            raise ValidationError(
                f"Batch {batch.name} has graduated "
                "and cannot be edited."
            )

        if getattr(batch, "is_program_end_ready", False):

            raise ValidationError(
                f"Batch {batch.name} is program-end-ready "
                "and cannot be edited."
            )

        # ----------------------------------------------------
        # If ANY batch assigned to this progressive version is
        # graduated, the entire curriculum is frozen — the
        # graduated batch represents the highest semester and
        # adding courses to any earlier batch would be
        # inconsistent with the already-passed curriculum.
        # ----------------------------------------------------

        any_graduated = any(
            b.status == "graduated"
            or getattr(b, "is_program_end_ready", False)
            for b in version.assigned_batches.all()
        )
        if any_graduated:

            raise ValidationError(
                "This progressive curriculum has one or more "
                "graduated batches and cannot be edited further."
            )

        # ----------------------------------------------------
        # Draft
        #
        # Draft curriculum can be edited.
        # ----------------------------------------------------

        if version.status == "draft":
            return True

        # ----------------------------------------------------
        # Archived
        #
        # Archived version can never be edited.
        # ----------------------------------------------------

        if version.status == "archived":

            raise ValidationError(
                "Archived curriculum version "
                "cannot be edited."
            )

        # ----------------------------------------------------
        # Finalized Progressive
        # ----------------------------------------------------

        if version.status == "finalized":

            current_semester = (
                batch.current_semester or 1
            )

            # ------------------------------------------------
            # Previous semester -> LOCKED
            # ------------------------------------------------

            if semester_no < current_semester:

                raise ValidationError(
                    f"Semester {semester_no} is locked "
                    f"for batch {batch.name}. "
                    f"Current semester is "
                    f"{current_semester}."
                )

            # ------------------------------------------------
            # Future semester -> LOCKED
            # ------------------------------------------------

            if semester_no > current_semester:

                raise ValidationError(
                    f"Semester {semester_no} is not "
                    f"unlocked yet. Current semester is "
                    f"{current_semester}."
                )

            # ------------------------------------------------
            # Current semester -> ALLOWED
            # ------------------------------------------------

            return True

        raise ValidationError(
            "Invalid curriculum status."
        )

    # ========================================================
    # INVALID MODE
    # ========================================================

    raise ValidationError(
        "Invalid curriculum mode."
    )


# ============================================================
# 6. ADD COURSE TO CURRICULUM VERSION
# ============================================================

def add_course_to_curriculum_version(
    version,
    course,
    semester_no,
    batch,
    user=None,
):
    """
    Add a course to a curriculum version.

    COMPLETE MODE
    -------------
    Draft:
        Course can be added.

    Finalized:
        Course cannot be added.


    PROGRESSIVE MODE
    ----------------
    Draft:
        Course can be added.

    Finalized:
        Only current semester can be modified.

    Example:

        current_semester = 2

        Semester 1 -> LOCKED
        Semester 2 -> ADD COURSE ALLOWED
        Semester 3 -> LOCKED


    IMPORTANT:
    Progressive finalized versions are NOT cloned simply
    because a new semester starts.

    The same finalized version can receive courses for the
    currently unlocked semester.
    """

    # --------------------------------------------------------
    # Batch required
    # --------------------------------------------------------

    if not batch:

        raise ValidationError(
            "Batch is required for curriculum editing."
        )

    # --------------------------------------------------------
    # Course required
    # --------------------------------------------------------

    if not course:

        raise ValidationError(
            "Course is required."
        )

    # --------------------------------------------------------
    # Batch program must match version
    # --------------------------------------------------------

    if (
        batch.program_id
        != version.program_id
    ):

        raise ValidationError(
            "Batch program must match "
            "curriculum version program."
        )

    # --------------------------------------------------------
    # Batch must be assigned to this version
    # --------------------------------------------------------

    if (
        batch.curriculum_version_id
        != version.id
    ):

        raise ValidationError(
            "This batch is not assigned to "
            "this curriculum version."
        )

    # --------------------------------------------------------
    # Course program must match version program
    # --------------------------------------------------------

    if (
        course.program_id
        != version.program_id
    ):

        raise ValidationError(
            "Course program must match "
            "curriculum version program."
        )

    # --------------------------------------------------------
    # Validate semester number
    # --------------------------------------------------------

    try:

        semester_no = int(
            semester_no
        )

    except (
        TypeError,
        ValueError,
    ):

        raise ValidationError(
            "Invalid semester number."
        )

    # --------------------------------------------------------
    # Validate Complete / Progressive rules
    # --------------------------------------------------------

    validate_semester_editable(
        version=version,
        semester_no=semester_no,
        batch=batch,
    )

    # --------------------------------------------------------
    # Check duplicate
    # --------------------------------------------------------

    existing = (
        CurriculumVersionCourse.objects.filter(
            version=version,
            course=course,
            semester_no=semester_no,
        )
        .first()
    )

    if existing:

        # ----------------------------------------------------
        # If old record exists but inactive, reactivate it.
        # ----------------------------------------------------

        if not existing.is_active:

            existing.is_active = True

            existing.save(
                update_fields=[
                    "is_active"
                ]
            )

            return existing

        raise ValidationError(
            f"Course '{course.name}' already exists "
            f"in Semester {semester_no}."
        )

    # --------------------------------------------------------
    # Create course
    # --------------------------------------------------------

    with transaction.atomic():

        version_course = (
            CurriculumVersionCourse.objects.create(
                version=version,
                course=course,
                semester_no=semester_no,
                is_active=True,
            )
        )

        # ----------------------------------------------------
        # Course history
        # ----------------------------------------------------

        try:

            from .models import (
                CurriculumCourseHistory
            )

            CurriculumCourseHistory.objects.create(
                version=version,
                course=course,
                action="added",
                old_semester=None,
                new_semester=semester_no,
                old_data=None,
                new_data={
                    "semester_no": semester_no,
                },
                changed_by=user,
                reason=(
                    f"Course added to Semester "
                    f"{semester_no}"
                ),
            )

        except Exception as history_error:

            # History should not break the actual
            # curriculum course creation.
            print(
                "[add_course_to_curriculum_version] "
                "History error:",
                history_error,
            )

        return version_course


# ============================================================
# 7. SYNC COURSES FROM PROGRAM
# ============================================================

def sync_courses_from_program(version):
    """
    Copy active program courses into the curriculum version.

    Used only when intentionally initializing a new draft
    curriculum.
    """

    from core.models.course import Course

    with transaction.atomic():

        program_courses = Course.objects.filter(
            program=version.program,
            is_active=True,
        )

        for course in program_courses:

            semester_number = getattr(
                course.semester,
                "number",
                1,
            )

            CurriculumVersionCourse.objects.get_or_create(
                version=version,
                course=course,
                defaults={
                    "semester_no": semester_number,
                    "is_active": True,
                },
            )


# ============================================================
# 8. CREATE COURSE OFFERINGS
# ============================================================

def create_offerings_from_version(
    version,
    target_batch=None,
):
    """
    Create CourseSessions for curriculum courses.

    If target_batch is supplied, offerings are created only
    for that batch.

    This is important when multiple batches share one version.
    """

    from obe.models import CourseSession
    from core.models import Semester as CoreSemester

    offerings = []

    # --------------------------------------------------------
    # If a specific batch was supplied
    # --------------------------------------------------------

    if target_batch:

        batches = [
            target_batch
        ]

    else:

        batches = list(
            version.assigned_batches.filter(
                is_active=True
            )
        )

    if not batches:
        return offerings

    with transaction.atomic():

        for batch in batches:

            courses = (
                version.version_courses
                .filter(is_active=True)
            )

            for vc in courses:

                allocation = (
                    TeacherAllocation.objects.filter(
                        curriculum_version=version,
                        course=vc.course,
                        batch=batch,
                        semester_no=vc.semester_no,
                        status="active",
                    )
                    .first()
                )

                semester_obj = (
                    CoreSemester.objects.filter(
                        program=version.program,
                        number=vc.semester_no,
                    )
                    .first()
                )

                if not semester_obj:
                    continue

                session, created = (
                    CourseSession.objects.update_or_create(
                        course=vc.course,
                        batch=batch,
                        semester=semester_obj,
                        defaults={
                            "instructor": (
                                allocation.teacher
                                if allocation
                                else None
                            ),
                            "is_active": True,
                            "assessment_status": (
                                "IN_PROGRESS"
                            ),
                        },
                    )
                )

                offerings.append(
                    session
                )

    return offerings


# ============================================================
# 9. CLONE TEACHER ALLOCATIONS
# ============================================================

def clone_allocations_for_version(
    source_version,
    new_version,
    target_batch=None,
):
    """
    Copy active TeacherAllocations.

    If target_batch is supplied, only allocations belonging
    to that batch are copied.

    This prevents one batch's allocations from being copied
    into another batch accidentally.
    """

    with transaction.atomic():

        allocations = (
            TeacherAllocation.objects.filter(
                curriculum_version=source_version,
                status="active",
            )
        )

        if target_batch:

            allocations = allocations.filter(
                batch=target_batch
            )

        for allocation in allocations:

            TeacherAllocation.objects.create(
                curriculum_version=new_version,
                course=allocation.course,
                batch=(
                    target_batch
                    if target_batch
                    else allocation.batch
                ),
                semester_no=allocation.semester_no,
                teacher=allocation.teacher,
                allocated_by=new_version.created_by,
                cloned_from=allocation,
                status="active",
            )