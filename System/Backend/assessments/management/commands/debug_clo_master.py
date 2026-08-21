
from django.core.management.base import BaseCommand
from core.models import Batch
from obe.models import CourseSession
from clo_master.models import CourseCLOMasterEntry, SemesterCLOMasterCache


class Command(BaseCommand):
    help = "Debug CLO Master for batch"

    def add_arguments(self, parser):
        parser.add_argument("--batch", type=str, default="BSIT-2022")

    def handle(self, *args, **options):
        batch_name = options['batch']
        self.stdout.write(f"Checking batch: {batch_name}")

        try:
            batch = Batch.objects.get(name=batch_name)
        except Batch.DoesNotExist:
            self.stderr.write(f"No batch found with name: {batch_name}")
            return

        self.stdout.write("\n--- All CourseSessions ---")
        course_sessions = CourseSession.objects.filter(
            batch=batch
        ).select_related('course', 'semester')
        for cs in course_sessions:
            self.stdout.write(
                f"  ID: {cs.id}, "
                f"Course: {cs.course.code} ({cs.course.name}), "
                f"Semester: {cs.semester.number}, "
                f"Assessment Status: '{cs.assessment_status}', "
                f"Assessment Done: {cs.assessment_done}, "
                f"Is Active: {cs.is_active}"
            )

        self.stdout.write("\n--- SemesterCLOMasterCache ---")
        caches = SemesterCLOMasterCache.objects.filter(batch=batch)
        for cache in caches:
            self.stdout.write(
                f"  Cache ID: {cache.id}, "
                f"Program: {cache.program.name}, "
                f"Semester: {cache.semester.number}, "
                f"Finalized Count: {cache.total_courses_finalized}, "
                f"Expected: {cache.total_courses_expected}"
            )

        self.stdout.write("\n--- CourseCLOMasterEntry ---")
        entries = CourseCLOMasterEntry.objects.filter(
            master_cache__batch=batch
        ).select_related('course_session', 'course', 'student')

        # Group entries by course session
        entries_by_course = {}
        for entry in entries:
            cs_id = entry.course_session.id
            if cs_id not in entries_by_course:
                entries_by_course[cs_id] = {
                    'course_code': entry.course.code,
                    'count': 0
                }
            entries_by_course[cs_id]['count'] += 1

        for cs_id, data in entries_by_course.items():
            self.stdout.write(
                f"  Course Session {cs_id} ({data['course_code']}): {data['count']} entries"
            )

        self.stdout.write("\n--- Done ---")
