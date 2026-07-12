
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from students.models import Student
from core.models import Course, Batch
from obe.models import StudentCLOScore, CourseSession
from obe.services import calculate_all_course_ga_scores

# Get data
batch = Batch.objects.filter(name__icontains='vs2025').first()
mudassar = Student.objects.filter(name__icontains='mudassar awan').first()
db201 = Course.objects.filter(code='db201').first()
session = CourseSession.objects.filter(course=db201, batch=batch).first()

print("--- Debugging calculate_all_course_ga_scores ---")
print(f"Session batch: {session.batch}")
print(f"Session batch curriculum_version: {session.batch.curriculum_version}")
print("--- Getting CLOs ---")
from obe.models import CLO
target_curriculum_version = session.batch.curriculum_version if session.batch else None
print(f"target_curriculum_version: {target_curriculum_version}")
clos_all = CLO.objects.filter(course=session.course, is_active=True)
print(f"All active CLOs: {len(clos_all)}")
for clo in clos_all:
    print(f"  CLO {clo.order_number}: id={clo.id}, curriculum_version={clo.curriculum_version}")
if target_curriculum_version:
    clos = CLO.objects.filter(course=session.course, is_active=True, curriculum_version=target_curriculum_version)
else:
    clos = CLO.objects.filter(course=session.course, is_active=True)
print(f"Filtered clos: {len(clos)}")
for clo in clos:
    print(f"  CLO {clo.order_number}: id={clo.id}")
print("\nRecalculating course scores...")
calculate_all_course_ga_scores(session)
print("Recalculated course scores!")

# Check scores
scores = StudentCLOScore.objects.filter(student=mudassar, course_session=session)

print("\nStudent:", mudassar)
print("Session:", session)
print("\nStudentCLOScore count:", scores.count())

for s in scores:
    print(f"- CLO {s.clo.order_number}: {s.attainment}% (KPI target: {s.clo.kpi_target}%, Achieved: {s.attainment >= s.clo.kpi_target})")
