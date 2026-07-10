
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from core.models import Program, Semester, Batch
from clo_master.models import SemesterCLOMasterCache, CourseCLOMasterEntry
from obe.models import CourseSession, StudentCLOScore

# Test parameters
program_id = "3ef8367b-16c6-460e-b635-2c70ed33ee6e"  # BS Computer Science
semester_id = "031496e4-440f-4e06-ad14-175d582ea165"  # Semester 3
batch_id = "0130298e-55b6-4023-a50c-0a65c1c03b91"  # bscs-2026

program = Program.objects.get(id=program_id)
semester = Semester.objects.get(id=semester_id)
batch = Batch.objects.get(id=batch_id)

print("Program:", program)
print("Semester:", semester)
print("Batch:", batch)

master_cache = SemesterCLOMasterCache.objects.filter(
    program=program, batch=batch, semester=semester
).first()

print("\nMaster cache exists:", master_cache is not None)
if master_cache:
    print("Total courses expected:", master_cache.total_courses_expected)
    print("Total courses finalized:", master_cache.total_courses_finalized)

course_entries = CourseCLOMasterEntry.objects.filter(
    master_cache=master_cache, is_active=True
) if master_cache else []

print("CourseCLOMasterEntry count:", len(course_entries))

from students.models import Student
students = Student.objects.filter(user__batch_id=batch_id)
print("Student count:", students.count())

if students.count() > 0:
    sample_student = students.first()
    print("\nSample student:", sample_student)
    sample_entries = course_entries.filter(student=sample_student)
    print("Sample entries for student:", len(sample_entries))
