
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q

from obe.models import CourseSession
from obe.services import calculate_all_course_ga_scores
from clo_master.signals import append_course_to_clo_master
from obe.signals import update_ga_master_cache


class Command(BaseCommand):
    help = "Recalculate CLO Master and GA reports for all finalized CourseSessions"

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-id",
            type=str,
            help="Only recalculate for a specific batch ID",
        )
        parser.add_argument(
            "--course-id",
            type=str,
            help="Only recalculate for a specific course ID",
        )
        parser.add_argument(
            "--semester-id",
            type=str,
            help="Only recalculate for a specific semester ID",
        )

    def handle(self, *args, **options):
        batch_id = options.get("batch_id")
        course_id = options.get("course_id")
        semester_id = options.get("semester_id")

        self.stdout.write("--- Starting report recalculation (Weighted CLO Formula v2) ---")

        # Build queryset — include BOTH fully finalized (ASSESSMENT_DONE) AND
        # provisional internals-locked (internal_complete_awaiting_final)
        # sessions so Coordinator CLO Master is rebuilt for every reportable state.
        queryset = CourseSession.objects.filter(
            Q(assessment_status="ASSESSMENT_DONE")
            | Q(internal_complete_awaiting_final=True),
            is_active=True
        ).select_related("course", "batch", "semester").order_by(
            "batch__name",
            "semester__number",
            "course__code",
        )

        if batch_id:
            queryset = queryset.filter(batch_id=batch_id)
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        if semester_id:
            queryset = queryset.filter(semester_id=semester_id)

        total = queryset.count()
        self.stdout.write(f"Found {total} CourseSessions to process\n")

        success = 0
        failed = 0

        for idx, session in enumerate(queryset, 1):
            label = (
                f"[{idx}/{total}] "
                f"{session.course.code} | "
                f"Batch {session.batch.name if session.batch else '?'} | "
                f"Sem {session.semester.number if session.semester else '?'}"
            )
            self.stdout.write(label)
            try:
                # Step 1 — refresh GA scores + StudentCLOScore baseline
                self.stdout.write("  → GA/StudentCLOScore ...")
                calculate_all_course_ga_scores(session)

                # Step 2 — rebuild Coordinator CLO Master cache entries using
                # weighted CLOService numbers (new formula consistent with Instructor).
                self.stdout.write("  → CLO Master (weighted) ...")
                append_course_to_clo_master(None, session, False)

                # Step 3 — refresh GA Master cache
                self.stdout.write("  → GA Master cache ...")
                update_ga_master_cache(None, session, False)

                success += 1
                self.stdout.write(self.style.SUCCESS("  ✓ OK"))
            except Exception as e:
                failed += 1
                self.stdout.write(self.style.ERROR(f"  ✗ FAILED: {e}"))
                import traceback
                traceback.print_exc()

        self.stdout.write(
            self.style.SUCCESS(
                f"\n--- DONE: {success} OK  /  {failed} FAILED  (of {total} sessions ---"
            )
        )

