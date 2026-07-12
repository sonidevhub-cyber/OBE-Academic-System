
from clo_master.models import SemesterCLOMasterCache, CourseCLOMasterEntry
from core.models import Batch

print("=== SemesterCLOMasterCache ===")
for cache in SemesterCLOMasterCache.objects.all():
    print(f"\nCache ID: {cache.id}")
    print(f"  Program: {cache.program.name}")
    print(f"  Batch: {cache.batch.name} (id: {cache.batch.id})")
    print(f"  Semester: {cache.semester.name} (#{cache.semester.number})")
    print(f"  Finalized: {cache.total_courses_finalized}/{cache.total_courses_expected}")
    entries = CourseCLOMasterEntry.objects.filter(master_cache=cache)
    print(f"  Entries count: {len(entries)}")
    courses = set(e.course_session.course.code for e in entries)
    print(f"  Courses in cache: {sorted(courses)}")
