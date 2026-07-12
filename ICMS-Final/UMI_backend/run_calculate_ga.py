
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from students.models import Student
from core.models import Course, Batch
from obe.models import StudentCLOScore, CourseSession
from obe.services import calculate_all_course_ga_scores
from clo_master.signals import append_course_to_clo_master

# Get vs2025 batch
batch = Batch.objects.filter(name__icontains='vs2025').first()
print("Batch:", batch)

# Get db201
db201 = Course.objects.filter(code='db201').first()
print("db201:", db201)

# Get course session
session = CourseSession.objects.filter(course=db201, batch=batch).first()
print("Session:", session)

# Calculate GA scores (which also updates StudentCLOScore)
print("Running calculate_all_course_ga_scores...")
scores = calculate_all_course_ga_scores(session)
print("Scores:", scores)

# Manually trigger append_course_to_clo_master to update the cache
print("\nTriggering append_course_to_clo_master...")
append_course_to_clo_master(sender=CourseSession, instance=session, created=False)
print("Done!")
