
from django.core.management.base import BaseCommand
from core.models import Batch
from obe.models import CourseSession
from clo_master.models import SemesterCLOMasterCache, CourseCLOMasterEntry
from clo_master.signals import append_course_to_clo_master


class Command(BaseCommand):
    help = 'Debug clo master for bs-check batch'

    def handle(self, *args, **kwargs):
        self.stdout.write("=== Debugging bs-check ===")
        batch = Batch.objects.get(name='bs-check')
        self.stdout.write(f"Batch {batch.name} (id {batch.id})")
        cs_list = CourseSession.objects.filter(batch=batch, assessment_status='ASSESSMENT_DONE', is_active=True)
        self.stdout.write(f"  CourseSession with assessment_status ASSESSMENT_DONE:")
        for cs in cs_list:
            self.stdout.write(f"    {cs.course.code}: done={cs.assessment_done}, is_active={cs.is_active}")
        
        cache_list = SemesterCLOMasterCache.objects.filter(batch=batch)
        self.stdout.write(f"\n  SemesterCLOMasterCache:")
        for cache in cache_list:
            self.stdout.write(f"    {cache}")
            self.stdout.write(f"      total_courses_expected: {cache.total_courses_expected}")
            self.stdout.write(f"      total_courses_finalized: {cache.total_courses_finalized}")
            self.stdout.write(f"      is_active: {cache.is_active}")
            entries = CourseCLOMasterEntry.objects.filter(master_cache=cache, is_active=True)
            self.stdout.write(f"      CourseCLOMasterEntry count: {entries.count()}")
            
            if cs_list and not entries:
                self.stdout.write(f"    No entries found, let's call append_course_to_clo_master now:")
                for cs in cs_list:
                    self.stdout.write(f"      Calling append_course_to_clo_master on {cs.course.code}")
                    append_course_to_clo_master(None, cs, False)
                cache.refresh_from_db()
                self.stdout.write(f"    Cache after:")
                self.stdout.write(f"      total_courses_finalized: {cache.total_courses_finalized}")
                self.stdout.write(f"      entries: {CourseCLOMasterEntry.objects.filter(master_cache=cache, is_active=True).count()}")
