
from django.core.management.base import BaseCommand
from django.db import transaction
from core.models import Batch
from obe.models import CourseSession
from clo_master.signals import append_course_to_clo_master


class Command(BaseCommand):
    help = "Fix CLO Master by updating CourseSession status and triggering report"

    def add_arguments(self, parser):
        parser.add_argument("--batch", type=str, default="BSIT-2022")

    def handle(self, *args, **options):
        batch_name = options['batch']
        self.stdout.write(f"Processing batch: {batch_name}")

        try:
            batch = Batch.objects.get(name=batch_name)
        except Batch.DoesNotExist:
            self.stderr.write(f"No batch found with name: {batch_name}")
            return

        self.stdout.write("\n--- Fixing CourseSessions ---")
        course_sessions = CourseSession.objects.filter(
            batch=batch,
            assessment_done=True,
            assessment_status='IN_PROGRESS'
        ).select_related('course', 'semester')

        self.stdout.write(f"Found {len(course_sessions)} sessions to fix!")
        with transaction.atomic():
            for cs in course_sessions:
                self.stdout.write(
                    f"  Updating {cs.course.code} ({cs.course.name}): "
                    f"setting assessment_status to 'ASSESSMENT_DONE'"
                )
                cs.assessment_status = 'ASSESSMENT_DONE'
                cs.save()
                append_course_to_clo_master(None, cs, False)

        self.stdout.write("\n--- Done! ---")
