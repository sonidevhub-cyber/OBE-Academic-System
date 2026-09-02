from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from coordinators.models import TeacherAllocation
from .serializers import CourseHistorySerializer


class CourseHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Instructor Course History

    Shows previous semester course allocations for the
    currently logged-in instructor.

    Current semester courses are excluded.
    Existing TeacherAllocation records are reused.
    """

    serializer_class = CourseHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        # ---------------------------------------------------------
        # Get instructor's allocations
        # ---------------------------------------------------------
        allocations = (
            TeacherAllocation.objects
            .filter(
                teacher=user,
                batch__status="active",
            )
            .select_related(
                "course",
                "batch",
                "batch__program",
                "curriculum_version",
                "teacher",
            )
            .order_by(
                "batch__name",
                "semester_no",
                "course__name",
            )
        )

        # ---------------------------------------------------------
        # Only previous semesters
        # Current semester courses stay in My Courses
        # ---------------------------------------------------------
        history_allocations = []

        for allocation in allocations:

            batch = allocation.batch

            current_semester = getattr(
                batch,
                "current_semester",
                None
            )

            if current_semester is None:
                continue

            # Previous semester = History
            if allocation.semester_no < current_semester:
                history_allocations.append(allocation)

        return history_allocations

    # ============================================================
    # BY BATCH
    # ============================================================

    @action(
        detail=False,
        methods=["get"],
        url_path="by-batch",
    )
    def by_batch(self, request):

        queryset = self.get_queryset()

        data = {}

        for allocation in queryset:

            batch_id = str(allocation.batch.id)
            batch_name = allocation.batch.name

            if batch_id not in data:

                data[batch_id] = {
                    "batch_id": allocation.batch.id,
                    "batch_name": batch_name,

                    "program_name": (
                        allocation.batch.program.name
                        if allocation.batch.program
                        else ""
                    ),

                    "program_code": (
                        allocation.batch.program.code
                        if allocation.batch.program
                        else ""
                    ),

                    "courses": [],
                }

            serializer = self.get_serializer(allocation)

            data[batch_id]["courses"].append(
                serializer.data
            )

        return Response(
            {
                "count": len(queryset),
                "batches": list(data.values()),
            }
        )

    # ============================================================
    # BY SEMESTER
    # ============================================================

    @action(
        detail=False,
        methods=["get"],
        url_path="by-semester",
    )
    def by_semester(self, request):

        queryset = self.get_queryset()

        data = {}

        for allocation in queryset:

            semester_no = allocation.semester_no
            key = str(semester_no)

            if key not in data:

                data[key] = {
                    "semester_no": semester_no,
                    "courses": [],
                }

            data[key]["courses"].append(
                self.get_serializer(allocation).data
            )

        return Response(
            {
                "count": len(queryset),
                "semesters": list(data.values()),
            }
        )