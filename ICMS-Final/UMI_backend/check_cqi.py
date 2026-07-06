
import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'UMI_backend.settings')
django.setup()

from assessments.models import CLOAttainment, Assessment, Question, StudentQuestionMark
from core.models import Batch, Course, Semester, Program
from obe.models import GACQIRecord, CLO
from students.models import Student

print('--- Checking Question count for semester 1 course in first batch ---')
print('='*80)
program = Program.objects.filter(name='BS Computer Science').first()
semester_1 = Semester.objects.filter(program=program, number=1).first()
batch = Batch.objects.filter(is_active=True, program=program).first()
course = Course.objects.filter(program=program, semester=semester_1, is_active=True).first()
assessments = Assessment.objects.filter(course=course, batch=batch, semester=semester_1)
questions = Question.objects.filter(assessment__in=assessments)
sqms = StudentQuestionMark.objects.filter(question__in=questions)
print(f'Batch: {batch.name}')
print(f'Course: {course.name}')
print(f'Assessments: {len(assessments)}')
print(f'Questions: {len(questions)}')
print(f'Student Question Marks: {len(sqms)}')
print('='*80)

print('\n--- CLO Attainment Records that are NOT Achieved (will trigger CQI):')
for ca in CLOAttainment.objects.filter(is_achieved=False):
    course = Course.objects.filter(id=ca.course_id).first()
    batch = Batch.objects.filter(id=ca.batch_id).first()
    print(f'Batch: {batch.name if batch else "N/A"}, Course: {course.name if course else "N/A"}, CLO: {ca.clo.order_number if ca.clo else "N/A"}, Attained: {ca.attained_percentage}%')
print('='*80)
