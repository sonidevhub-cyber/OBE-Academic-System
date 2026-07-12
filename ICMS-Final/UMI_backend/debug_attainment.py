
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from students.models import Student
from core.models import Course, Batch
from assessments.models import Assessment, Question, StudentQuestionMark
from obe.models import StudentCLOScore, CourseSession
from retake.models import CourseRetake


batch = Batch.objects.filter(name__icontains='vs2025').first()
mudassar = Student.objects.filter(name__icontains='mudassar awan').first()
db201 = Course.objects.filter(code='db201').first()
session = CourseSession.objects.filter(course=db201, batch=batch).first()

print("=== Session ===")
print(session)

print("\n=== Assessments ===")
assessments = Assessment.objects.filter(
    course=db201,
    batch=batch,
    semester=session.semester,
    is_finalized=True
)
print(f"Found {len(assessments)} assessments")
for a in assessments:
    print(f"  - {a.title} ({a.assessment_type})")

print("\n=== Questions ===")
from obe.models import CLO
clos = CLO.objects.filter(course=db201).select_related('course')
print(f"Found {len(clos)} clos")
for clo in clos:
    print(f"  - CLO {clo.order_number}: {clo.title}")
    questions = Question.objects.filter(clo=clo, assessment__in=assessments)
    total_marks = sum(q.marks for q in questions)
    print(f"    Total marks: {total_marks}")
    
    print("    StudentQuestionMark for Mudassar:")
    
    latest_retake = CourseRetake.objects.filter(
        student=mudassar,
        failed_course=db201,
        is_active=True
    ).order_by('-attempt_number').first()
    
    if latest_retake:
        print("      Using retake:", latest_retake)
        retake_marks = StudentQuestionMark.objects.filter(
            student=mudassar,
            question__in=questions,
            course_retake=latest_retake
        )
        print(f"      Retake marks found: {len(retake_marks)}")
        
        if retake_marks.exists():
            student_marks = retake_marks
        else:
            student_marks = StudentQuestionMark.objects.filter(
                student=mudassar,
                question__in=questions,
                course_retake__isnull=True
            )
    else:
        student_marks = StudentQuestionMark.objects.filter(
            student=mudassar,
            question__in=questions,
            course_retake__isnull=True
        )
    
    print(f"    Total marks found: {len(student_marks)}")
    
    total_obtained = sum(sm.marks_obtained for sm in student_marks)
    print(f"      Total obtained: {total_obtained} / {total_marks}")
    
    if total_marks > 0:
        attainment = (total_obtained / total_marks) * 100
        print(f"      Attainment: {attainment:.2f}%")
    else:
        print("      No marks")
