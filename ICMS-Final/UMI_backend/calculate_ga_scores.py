
import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'UMI_backend.settings')
django.setup()

from core.models import Program, Batch, Semester
from obe.models import CourseSession, GA
from obe.services import calculate_all_course_ga_scores

print("=== Calculating Course GA Scores for BS Computer Science ===")

program = Program.objects.filter(code="BSCS").first()
if not program:
    print("Program not found")
    exit()
    
semester_1 = Semester.objects.filter(program=program, number=1).first()
active_batches = Batch.objects.filter(is_active=True, program=program)

print(f"Found {len(active_batches)} active batches")

for batch in active_batches:
    for course_session in CourseSession.objects.filter(
        batch=batch,
        semester=semester_1,
        is_active=True
    ):
        try:
            scores = calculate_all_course_ga_scores(course_session)
            print(f"Calculated {len(scores)} GA scores for {course_session.course.name} in {batch.name}")
        except Exception as e:
            print(f"Error calculating for {course_session.course.name} in {batch.name}: {e}")
