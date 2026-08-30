
from django.core.management.base import BaseCommand
from django.db import transaction

from obe.models import CourseSession
from assessments.services.clo_service import CLOService


class Command(BaseCommand):
    help = "Recalculate CLO attainments for all finalized assessments"

    def add_arguments(self, parser):
        parser.add_argument(
            "--course-id",
            type=str,
            help="Only recalculate for a specific course ID",
        )
        parser.add_argument(
            "--batch-id",
            type=str,
            help="Only recalculate for a specific batch ID",
        )
        parser.add_argument(
            "--semester-id",
            type=str,
            help="Only recalculate for a specific semester ID",
        )

    def handle(self, *args, **options):
        course_id = options.get("course_id")
        batch_id = options.get("batch_id")
        semester_id = options.get("semester_id")

        self.stdout.write("--- Starting CLO Attainment Recalculation ---")

        # Build queryset for active course sessions
        queryset = CourseSession.objects.filter(
            is_active=True
        ).select_related("course", "batch", "semester")

        if course_id:
            queryset = queryset.filter(course_id=course_id)
        if batch_id:
            queryset = queryset.filter(batch_id=batch_id)
        if semester_id:
            queryset = queryset.filter(semester_id=semester_id)

        total = queryset.count()
        self.stdout.write(f"Found {total} CourseSessions to process\n")

        for idx, session in enumerate(queryset, 1):
            self.stdout.write(
                f"[{idx}/{total}] Processing: {session.course.code} - {session.batch.name} - Semester {session.semester.number}"
            )
            try:
                with transaction.atomic():
                    # Regenerate the student report which recalculates CLO attainments
                    CLOService.generate_student_report(
                        course_id=str(session.course_id),
                        batch_id=str(session.batch_id),
                        semester_id=str(session.semester_id),
                    )
                    self.stdout.write(self.style.SUCCESS("  CLO attainments recalculated"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  Error: {e}"))

        self.stdout.write(self.style.SUCCESS("\n--- CLO Attainment Recalculation Complete ---"))
