
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from students.models import Student
from core.models import Course, Batch
from assessments.models import Assessment, Question, StudentQuestionMark
from retake.models import CourseRetake


batch = Batch.objects.filter(name__icontains='vs2025').first()
mudassar = Student.objects.filter(name__icontains='mudassar awan').first()
db201 = Course.objects.filter(code='db201').first()

latest_retake = CourseRetake.objects.filter(
    student=mudassar,
    failed_course=db201,
    is_active=True
).order_by('-attempt_number').first()

print("Retake:", latest_retake)

print("\n=== Retake Assessments ===")
retake_assessments = Assessment.objects.filter(course_retake=latest_retake)
for a in retake_assessments:
    print(f"  - {a.title} ({a.assessment_type})")
    
    print("\n    Questions:")
    questions = Question.objects.filter(assessment=a).select_related('clo', 'clo__course')
    for q in questions:
        if q.clo:
            print(f"      - {q.id}: {q.description} (marks: {q.marks}, clo: CLO {q.clo.order_number} - {q.clo.id} - {q.clo.course})")
        else:
            print(f"      - {q.id}: {q.description} (marks: {q.marks}, no clo)")
        
    print("\n    Mudassar's marks:")
    sqm = StudentQuestionMark.objects.filter(
        student=mudassar,
        question__in=questions
    )
    for m in sqm:
        print(f"      - {m.question.description}: {m.marks_obtained}")
