
import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from students.models import Student
from core.models import Batch, Course
from obe.models import CourseSession

# Get data
batch = Batch.objects.filter(name__icontains='vs2025').first()
db201 = Course.objects.filter(code='db201').first()
session = CourseSession.objects.filter(course=db201, batch=batch).first()

print("=== CourseSession info ===")
print(f"assessment_status: {session.assessment_status}")

# Let's set it to ASSESSMENT_DONE and save to trigger the signal!
session.assessment_status = 'ASSESSMENT_DONE'
session.save()
print("Saved CourseSession with assessment_status ASSESSMENT_DONE")
