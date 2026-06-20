import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'umi_backend.settings')
django.setup()

from obe.models import CourseSession

print("Current sessions:")
sessions = CourseSession.objects.all()
for s in sessions:
    print(f"  {s.id} - {s.course.code} - {s.assessment_status}")

print("\nUpdating to ASSESSMENT_DONE...")
sessions.update(assessment_status='ASSESSMENT_DONE')

print("\nUpdated sessions:")
for s in sessions:
    s.refresh_from_db()
    print(f"  {s.id} - {s.course.code} - {s.assessment_status}")
