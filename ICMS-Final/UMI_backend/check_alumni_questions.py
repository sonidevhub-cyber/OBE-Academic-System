
import django
import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from obe.models import PEO, AlumniSurveyQuestion

print("PEOs:")
for peo in PEO.objects.filter(is_active=True):
    print(f"- ID: {peo.id}, Description: {peo.description}")

print("\nAlumni Survey Questions:")
for q in AlumniSurveyQuestion.objects.filter(is_active=True):
    print(f"- ID: {q.id}, PEO ID: {q.peo_id}, Text: {q.question_text}")
