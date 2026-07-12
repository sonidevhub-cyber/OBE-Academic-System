
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from students.models import Student
from core.models import Course, Batch
from obe.models import StudentCLOScore, CourseSession
from assessments.models import Assessment, StudentQuestionMark
from retake.models import CourseRetake

# Get vs2025 batch
batch = Batch.objects.filter(name__icontains='vs2025').first()
print("Batch:", batch)

# Get Mudassar
mudassar = Student.objects.filter(name__icontains='mudassar awan').first()
print("Mudassar:", mudassar)

# Get all courses to check correct code
print("All Courses:")
for course in Course.objects.all().order_by('code'):
    print(f"  {course.code}: {course.name}")

# Get DB course (db201)
db201 = Course.objects.filter(code='db201').first()
print("db201:", db201)

# Get CourseSession for DB201, vs2025
session = CourseSession.objects.filter(course=db201, batch=batch).first()
print("Course Session:", session)

# Get StudentCLOScores
scores = StudentCLOScore.objects.filter(student=mudassar, course_session=session)
print("Scores count:", scores.count())
for s in scores:
    print(f"  CLO {s.clo.order_number} - {s.attainment}%")

# Get all StudentQuestionMark for Mudassar
print("\nAll StudentQuestionMarks for Mudassar:")
sqms = StudentQuestionMark.objects.filter(student=mudassar).select_related('question', 'question__clo', 'question__assessment', 'course_retake')
for sqm in sqms:
    print(f"  Question: {sqm.question.description}, Marks: {sqm.marks_obtained}, Retake: {sqm.course_retake}, Assessment: {sqm.question.assessment.title}")

# Get all CourseRetakes (for any student) linked to db201
print("\nAll CourseRetakes for db201:")
retakes = CourseRetake.objects.filter(failed_course=db201).select_related('student').order_by('-attempt_number')
for r in retakes:
    print(f"\n  --- Retake ---")
    print(f"  Student: {r.student}")
    print(f"  Attempt number: {r.attempt_number}, active: {r.is_active}")
    # Get assessments
    assessments = Assessment.objects.filter(course_retake=r)
    print(f"  Assessments: {list(assessments.values_list('title', 'assessment_type', 'is_finalized'))}")
