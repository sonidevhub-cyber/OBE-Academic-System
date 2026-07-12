
import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from students.models import Student
from core.models import Batch, Course
from obe.models import CourseSession
from clo_master.models import CourseCLOMasterEntry

# Get data
batch = Batch.objects.filter(name__icontains='vs2025').first()
mudassar = Student.objects.filter(name__icontains='mudassar awan').first()
db201 = Course.objects.filter(code='db201').first()
session = CourseSession.objects.filter(course=db201, batch=batch).first()

print("=== Checking CourseCLOMasterEntry for mudassar ===")
entries = CourseCLOMasterEntry.objects.filter(course_session=session, student=mudassar)

for entry in entries:
    print(f"  - {entry.clo}: {entry.clo_score}% (KPI achieved: {entry.is_kpi_achieved})")
