
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from students.models import Student
from core.models import Course, Batch
from obe.models import StudentCLOScore, CourseSession
from retake.models import CourseRetake
from assessments.models import Assessment, Question, StudentQuestionMark

# Get data
batch = Batch.objects.filter(name__icontains='vs2025').first()
mudassar = Student.objects.filter(name__icontains='mudassar awan').first()
db201 = Course.objects.filter(code='db201').first()
session = CourseSession.objects.filter(course=db201, batch=batch).first()

print("=== STEP 1: Get Mudassar's retake ===")
latest_retake = CourseRetake.objects.filter(
    student=mudassar,
    failed_course=session.course,
    is_active=True
).order_by('-attempt_number').first()
print(f"Latest retake: {latest_retake}")

print("\n=== STEP 2: Get original questions for db201 session ===")
original_assessments = Assessment.objects.filter(
    course=session.course,
    batch=session.batch,
    semester=session.semester,
    is_finalized=True,
    course_retake__isnull=True
)
original_questions = Question.objects.filter(assessment__in=original_assessments)
print(f"Found {original_assessments.count()} original assessments, {original_questions.count()} original questions")
for q in original_questions:
    print(f"  Question {q.id}: clo {q.clo.order_number}, {q.marks} marks")

print("\n=== STEP 3: Get retake assessments/questions ===")
if latest_retake:
    retake_assessments = Assessment.objects.filter(course_retake=latest_retake, is_finalized=True)
    retake_questions = Question.objects.filter(assessment__in=retake_assessments)
    retake_sqms = StudentQuestionMark.objects.filter(student=mudassar, question__in=retake_questions)
    print(f"Found {retake_assessments.count()} retake assessments, {retake_questions.count()} retake questions, {retake_sqms.count()} retake sqms")
    for sqm in retake_sqms:
        print(f"  SQM {sqm.id}: question {sqm.question.id}, clo {sqm.question.clo.order_number}, obtained {sqm.marks_obtained}/{sqm.question.marks}")

print("\n=== STEP 4: Let's process each clo manually ===")
from obe.models import CLO
clos = CLO.objects.filter(course=session.course)
print(f"Number of CLO records for this course: {clos.count()}")
for clo in clos:
    print(f"\n--- CLO (id={clo.id}, order_number={clo.order_number}) ---")
    orig_q = original_questions.filter(clo=clo)
    orig_total = sum(q.marks for q in orig_q)
    print(f"Original questions count: {orig_q.count()}, Original total: {orig_total}")
    
    if latest_retake:
        ret_q = retake_questions.filter(clo=clo)
        ret_sqms = retake_sqms.filter(question__in=ret_q)
        ret_total = sum(q.marks for q in ret_q)
        ret_obt = sum(s.marks_obtained for s in ret_sqms)
        print(f"Retake questions count: {ret_q.count()}, Retake total: {ret_total}, retake obtained: {ret_obt}")
        
        if ret_total > 0:
            scaled_obt = (ret_obt / ret_total) * orig_total
            print(f"Scaled obtained: {scaled_obt}")
        else:
            print("No retake total")
    else:
        print("No retake")

