
from django.core.management.base import BaseCommand
from django.db import transaction

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

    def handle(self, *args, **options):
        batch_id = options.get("batch_id")
        course_id = options.get("course_id")

        self.stdout.write("--- Starting report recalculation ---")

        # Build queryset
        queryset = CourseSession.objects.filter(
            assessment_status="ASSESSMENT_DONE",
            is_active=True
        ).select_related("course", "batch", "semester")

        if batch_id:
            queryset = queryset.filter(batch_id=batch_id)
        if course_id:
            queryset = queryset.filter(course_id=course_id)

        self.stdout.write(f"Found {queryset.count()} CourseSessions to process")

        with transaction.atomic():
            for session in queryset:
                self.stdout.write(
                    f"Processing: Course {session.course.code}, Batch {session.batch.name}, Semester {session.semester.number}"
                )
                # First calculate course GA scores and StudentCLOScore records (in case they are missing)
                self.stdout.write("  Calculating course GA scores...")
                calculate_all_course_ga_scores(session)
                # Trigger CLO Master update
                self.stdout.write("  Updating CLO Master...")
                append_course_to_clo_master(None, session, False)
                # Trigger GA Master update
                self.stdout.write("  Updating GA Master cache...")
                update_ga_master_cache(None, session, False)

        self.stdout.write("\n--- Done! ---")

