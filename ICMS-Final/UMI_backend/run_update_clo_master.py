
import os
import sys
import django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from students.models import Student
from core.models import Batch, Course
from obe.models import CourseSession
from clo_master.signals import append_course_to_clo_master

# Get data
batch = Batch.objects.filter(name__icontains='vs2025').first()
db201 = Course.objects.filter(code='db201').first()
session = CourseSession.objects.filter(course=db201, batch=batch).first()

print("=== Manually calling append_course_to_clo_master ===")
append_course_to_clo_master(CourseSession, session, False)
print("=== Done! Now checking entries ===")

from clo_master.models import CourseCLOMasterEntry
mudassar = Student.objects.filter(name__icontains='mudassar awan').first()
entries = CourseCLOMasterEntry.objects.filter(course_session=session, student=mudassar)
for entry in entries:
    print(f"  - {entry.clo}: {entry.clo_score}% (KPI achieved: {entry.is_kpi_achieved})")
