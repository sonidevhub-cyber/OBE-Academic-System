
from clo_master.models import SemesterCLOMasterCache, CourseCLOMasterEntry
from core.models import Batch

for batch in Batch.objects.filter(name__in=["bsit-2023", "bscs-2026"]):
    print(f"--- Batch: {batch.name} (id: {batch.id}) ---")
    caches = SemesterCLOMasterCache.objects.filter(batch=batch)
    print(f"  Caches:")
    for cache in caches:
        print(f"    - id: {cache.id}, program: {cache.program.id}, semester: {cache.semester.id}, finalized: {cache.total_courses_finalized}/{cache.total_courses_expected}")
    entries = CourseCLOMasterEntry.objects.filter(master_cache__batch=batch)
    print(f"  Courses in entries: {list(entries.values_list('course_session__course__code', flat=True).distinct())}")
