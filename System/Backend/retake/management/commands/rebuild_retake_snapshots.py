from django.core.management.base import BaseCommand

from retake.models import CourseRetake, RetakeAssessmentSnapshot
from retake.signals import _build_snapshot_data, _create_retake_assessments_from_snapshot


class Command(BaseCommand):
    help = "Rebuild assessment snapshots for existing retake records and create missing retake assessments."

    def add_arguments(self, parser):
        parser.add_argument(
            "--retake-id",
            type=str,
            help="Rebuild snapshot for a specific retake ID only.",
        )

    def handle(self, *args, **options):
        retake_id = options.get("retake_id")
        if retake_id:
            retakes = CourseRetake.objects.filter(id=retake_id)
            if not retakes.exists():
                self.stdout.write(self.style.ERROR(f"Retake {retake_id} not found."))
                return
        else:
            retakes = CourseRetake.objects.all()

        total = retakes.count()
        self.stdout.write(self.style.NOTICE(f"Processing {total} retake(s)..."))

        created_snapshots = 0
        created_assessments = 0

        for retake in retakes:
            snapshot = RetakeAssessmentSnapshot.objects.filter(retake=retake).first()

            if not snapshot:
                snapshot_data = _build_snapshot_data(retake)
                snapshot = RetakeAssessmentSnapshot.objects.create(
                    retake=retake,
                    original_course_id=retake.failed_course_id,
                    original_batch_id=retake.failed_batch_id,
                    original_semester_id=getattr(retake.failed_batch, "current_semester", None),
                    snapshot_data=snapshot_data,
                    is_locked=True,
                )
                created_snapshots += 1
                self.stdout.write(self.style.SUCCESS(f"Created snapshot for retake {retake.id}"))
            else:
                snapshot_data = snapshot.snapshot_data

            before_count = retake.assessments.count()
            _create_retake_assessments_from_snapshot(retake, snapshot_data)
            after_count = retake.assessments.count()
            created = after_count - before_count
            if created > 0:
                created_assessments += created
                self.stdout.write(self.style.SUCCESS(f"Created {created} assessment(s) for retake {retake.id}"))

        self.stdout.write(self.style.SUCCESS(f"Done. Snapshots created: {created_snapshots}, Assessments created: {created_assessments}"))
