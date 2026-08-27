from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from core.models import Batch
from curriculum.models import CurriculumVersion
from academic_structure.models import Course
from ..models import CourseSession
from ..serializers import (
    CourseSessionSerializer,
    CurriculumVersionSerializer,
)


# ============================================================
# HELPER
# ============================================================

def get_batch(batch_id):
    """
    Return batch or None.
    """
    try:
        return Batch.objects.get(id=batch_id)
    except Batch.DoesNotExist:
        return None


def validate_session_edit(batch, session=None, semester_number=None):
    """
    Enforce Complete / Progressive curriculum rules.

    Complete:
        Finalized curriculum = completely locked.

    Progressive:
        Finalized curriculum:
            previous semester -> locked
            current semester  -> editable
            future semester    -> locked
    """

    # --------------------------------------------------------
    # Get curriculum version from batch
    # --------------------------------------------------------

    version = getattr(batch, "curriculum_version", None)

    # No curriculum version -> normal operation
    if not version:
        return None

    # --------------------------------------------------------
    # Draft = editable
    # --------------------------------------------------------

    if version.status == "draft":
        return None

    # --------------------------------------------------------
    # Curriculum mode
    # --------------------------------------------------------

    mode = str(
        getattr(batch, "curriculum_mode", "")
    ).lower().strip()

    # --------------------------------------------------------
    # COMPLETE MODE
    # --------------------------------------------------------

    if mode == "complete":
        return Response(
            {
                "error": (
                    "This curriculum is in Complete mode "
                    "and is locked after finalization."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # --------------------------------------------------------
    # PROGRESSIVE MODE
    # --------------------------------------------------------

    if mode == "progressive":

        current_semester = (
            getattr(batch, "current_semester", None) or 1
        )

        # Determine semester
        if semester_number is None and session is not None:

            if session.semester:
                semester_number = session.semester.number

        if semester_number is None:
            return Response(
                {
                    "error": (
                        "Semester could not be determined "
                        "for this course session."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Only current semester is editable
        if int(semester_number) != int(current_semester):

            return Response(
                {
                    "error": (
                        f"Semester {semester_number} is locked. "
                        f"Only Semester {current_semester} "
                        f"is currently editable."
                    ),
                    "semester": semester_number,
                    "current_semester": current_semester,
                    "curriculum_mode": "progressive",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return None

    # --------------------------------------------------------
    # UNKNOWN MODE
    # --------------------------------------------------------

    return Response(
        {
            "error": (
                "Curriculum mode is not configured "
                "for this batch."
            )
        },
        status=status.HTTP_400_BAD_REQUEST,
    )


# ============================================================
# COURSE SESSION LIST
# ============================================================

class CourseSessionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):

        # ----------------------------------------------------
        # Batch
        # ----------------------------------------------------

        batch = get_batch(batch_id)

        if not batch:
            return Response(
                {
                    "error": "Batch not found"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        print(
            f"[CourseSessionListView] "
            f"Batch {batch.name} "
            f"current_semester: {batch.current_semester}"
        )

        # ----------------------------------------------------
        # Curriculum version courses
        # ----------------------------------------------------

        allowed_course_ids = []

        if batch.curriculum_version:

            allowed_course_ids = (
                batch.curriculum_version
                .version_courses
                .filter(is_active=True)
                .values_list("course_id", flat=True)
            )

        # ----------------------------------------------------
        # Sessions
        # ----------------------------------------------------

        sessions = (
            CourseSession.objects
            .filter(
                batch_id=batch_id,
                is_active=True,
                course_id__in=allowed_course_ids,
            )
            .select_related(
                "course",
                "batch",
                "instructor",
                "semester",
            )
        )

        print(
            "[CourseSessionListView] "
            "All sessions before filter:"
        )

        for s in sessions:

            print(
                f"  - {s.course.code}: "
                f"semester_number="
                f"{s.semester.number if s.semester else None}"
            )

        # ----------------------------------------------------
        # Create sessions if none exist
        # ----------------------------------------------------

        if (
            not sessions.exists()
            and batch.curriculum_version
        ):

            try:

                from curriculum.services import (
                    create_offerings_from_version
                )

                create_offerings_from_version(
                    batch.curriculum_version
                )

                sessions = (
                    CourseSession.objects
                    .filter(
                        batch_id=batch_id,
                        is_active=True,
                        course_id__in=allowed_course_ids,
                    )
                    .select_related(
                        "course",
                        "batch",
                        "instructor",
                        "semester",
                    )
                )

            except Exception as e:

                print(
                    "[CourseSessionListView] "
                    f"Error creating course sessions: {str(e)}"
                )

        # ----------------------------------------------------
        # Show current + previous semesters
        #
        # Example:
        #
        # current_semester = 2
        #
        # Semester 1 -> visible
        # Semester 2 -> visible
        # Semester 3 -> hidden
        # ----------------------------------------------------

        filtered_sessions = []

        current_semester = (
            batch.current_semester or 1
        )

        for session in sessions:

            if session.semester:

                print(
                    f"  Checking {session.course.code}: "
                    f"semester_number="
                    f"{session.semester.number}, "
                    f"batch.current_semester="
                    f"{current_semester}"
                )

                if (
                    session.semester.number
                    <= current_semester
                ):
                    filtered_sessions.append(session)

        print(
            "[CourseSessionListView] "
            f"Filtered sessions count: "
            f"{len(filtered_sessions)}"
        )

        return Response(
            {
                "sessions": CourseSessionSerializer(
                    filtered_sessions,
                    many=True,
                ).data
            }
        )


# ============================================================
# COURSE SESSION CREATE
# ============================================================

class CourseSessionCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):

        batch_id = request.data.get("batch")

        if not batch_id:
            batch_id = request.data.get("batch_id")

        if not batch_id:
            return Response(
                {
                    "error": "batch_id is required."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        batch = get_batch(batch_id)

        if not batch:
            return Response(
                {
                    "error": "Batch not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # ----------------------------------------------------
        # Determine semester
        # ----------------------------------------------------

        semester_number = request.data.get(
            "semester_number"
        )

        # If serializer/model sends semester ID,
        # try to determine semester from it.
        if semester_number is None:

            semester_id = request.data.get(
                "semester"
            )

            if semester_id:

                try:

                    from core.models import Semester

                    semester = Semester.objects.get(
                        id=semester_id
                    )

                    semester_number = (
                        semester.number
                    )

                except Exception:
                    pass

        # ----------------------------------------------------
        # Finalized curriculum protection
        # ----------------------------------------------------

        error_response = validate_session_edit(
            batch=batch,
            semester_number=semester_number,
        )

        if error_response:
            return error_response

        # ----------------------------------------------------
        # Create session
        # ----------------------------------------------------

        serializer = CourseSessionSerializer(
            data=request.data
        )

        if serializer.is_valid():

            serializer.save(
                status="allocated"
            )

            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED,
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )


# ============================================================
# COURSE SESSION UPDATE
# ============================================================

class CourseSessionUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):

        # ----------------------------------------------------
        # Session
        # ----------------------------------------------------

        try:

            session = CourseSession.objects.get(
                pk=pk,
                is_active=True,
            )

        except CourseSession.DoesNotExist:

            return Response(
                {
                    "error": "Not found"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # ----------------------------------------------------
        # Batch
        # ----------------------------------------------------

        batch = session.batch

        if not batch:

            return Response(
                {
                    "error": "Batch not found for this session."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ----------------------------------------------------
        # Finalized protection
        # ----------------------------------------------------

        semester_number = None

        if session.semester:

            semester_number = (
                session.semester.number
            )

        error_response = validate_session_edit(
            batch=batch,
            session=session,
            semester_number=semester_number,
        )

        if error_response:
            return error_response

        # ----------------------------------------------------
        # Update
        # ----------------------------------------------------

        serializer = CourseSessionSerializer(
            session,
            data=request.data,
            partial=True,
        )

        if serializer.is_valid():

            serializer.save()

            return Response(
                serializer.data
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )


# ============================================================
# CURRICULUM VERSION LIST
# ============================================================

class CurriculumVersionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):

        # ----------------------------------------------------
        # Batch
        # ----------------------------------------------------

        batch = get_batch(batch_id)

        if not batch:

            return Response(
                {
                    "error": "Batch not found"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # ----------------------------------------------------
        # Current assigned version
        # ----------------------------------------------------

        version = getattr(
            batch,
            "curriculum_version",
            None
        )

        if version:

            return Response(
                CurriculumVersionSerializer(
                    [version],
                    many=True,
                ).data
            )

        return Response([])

    def post(self, request, batch_id):

        data = request.data.copy()

        # Keep batch context for serializer only if the
        # serializer/model supports it.
        data["batch"] = batch_id

        serializer = CurriculumVersionSerializer(
            data=data
        )

        if serializer.is_valid():

            serializer.save()

            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED,
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )


# ============================================================
# CURRICULUM VERSION DELETE
# ============================================================

class CurriculumVersionDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):

        try:

            version = CurriculumVersion.objects.get(
                pk=pk,
                is_active=True,
            )

        except CurriculumVersion.DoesNotExist:

            return Response(
                {
                    "error": "Not found"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # ----------------------------------------------------
        # Finalized versions should not be deleted through
        # this generic endpoint.
        # ----------------------------------------------------

        if version.status == "finalized":

            return Response(
                {
                    "error": (
                        "Finalized curriculum versions "
                        "cannot be deleted."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        version.is_active = False
        version.save()

        return Response(
            {
                "success": True
            }
        )


# ============================================================
# EFFECTIVE CURRICULUM
# ============================================================

class EffectiveCurriculumView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):

        # ----------------------------------------------------
        # Batch
        # ----------------------------------------------------

        try:

            batch = Batch.objects.get(
                pk=batch_id
            )

        except Batch.DoesNotExist:

            return Response(
                {
                    "error": "Batch not found"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # ----------------------------------------------------
        # Base courses
        # ----------------------------------------------------

        base_courses = Course.objects.filter(
            program=batch.program,
            is_active=True,
        )

        # ----------------------------------------------------
        # Current curriculum version
        # ----------------------------------------------------

        version = getattr(
            batch,
            "curriculum_version",
            None
        )

        # ----------------------------------------------------
        # If curriculum version exists, use its courses
        # ----------------------------------------------------

        if version:

            curriculum_courses = (
                version
                .version_courses
                .filter(is_active=True)
                .select_related("course")
            )

            courses = [
                item.course
                for item in curriculum_courses
                if item.course and item.course.is_active
            ]

            from academic_structure.serializers import (
                CourseSerializer
            )

            return Response(
                {
                    "batch": batch.name,
                    "courses": CourseSerializer(
                        courses,
                        many=True,
                    ).data,
                    "total_courses": len(courses),
                    "curriculum_version": (
                        str(version.id)
                    ),
                    "curriculum_status": (
                        version.status
                    ),
                    "curriculum_mode": getattr(
                        batch,
                        "curriculum_mode",
                        None,
                    ),
                    "current_semester": (
                        batch.current_semester
                    ),
                }
            )

        # ----------------------------------------------------
        # No curriculum version
        # ----------------------------------------------------

        from academic_structure.serializers import (
            CourseSerializer
        )

        return Response(
            {
                "batch": batch.name,
                "courses": CourseSerializer(
                    base_courses,
                    many=True,
                ).data,
                "total_courses": base_courses.count(),
                "curriculum_version": None,
                "curriculum_status": None,
                "curriculum_mode": getattr(
                    batch,
                    "curriculum_mode",
                    None,
                ),
                "current_semester": (
                    batch.current_semester
                ),
            }
        )