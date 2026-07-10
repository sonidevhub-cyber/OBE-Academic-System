
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from core.models import Program
from obe.models import PEO, AlumniSurveyQuestion

print("=== Checking Programs ===")
programs = Program.objects.filter(is_active=True)
for program in programs:
    print(f"Program: {program.name} ({program.id})")

print("\n=== Checking PEOs ===")
peos = PEO.objects.filter(is_active=True)
print(f"Found {peos.count()} active PEOs:")
for peo in peos:
    print(f"  - PEO: {peo.title} (id: {peo.id})")
    questions = peo.alumni_survey_questions.filter(is_active=True)
    print(f"    Active questions: {questions.count()}")
    for q in questions:
        print(f"      - {q.question_text} (locked: {q.is_locked})")

print("\n=== Checking all AlumniSurveyQuestions ===")
all_questions = AlumniSurveyQuestion.objects.all()
print(f"Found {all_questions.count()} total questions:")
for q in all_questions:
    print(f"  - {q.question_text} (is_active: {q.is_active}, is_locked: {q.is_locked})")
