
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from core.models import Program
from obe.views.peo_views import PEOAlumniSurveyQuestionListView
from obe.models import PEO
from django.http import HttpRequest

print("=== Testing PEOAlumniSurveyQuestionListView ===")
program = Program.objects.filter(is_active=True).first()
if not program:
    print("No active program found")
    exit()
print(f"Program found: {program.name} (id: {program.id})")

peos = PEO.objects.filter(program=program, is_active=True)
print(f"\nFound {len(peos)} active PEOs:")
for peo in peos:
    print(f"  - {peo.title} (id: {peo.id})")
    
    # Simulate calling the view
    request = HttpRequest()
    view = PEOAlumniSurveyQuestionListView()
    view.setup(request, peo_id=peo.id)
    response = view.get(request, peo_id=peo.id)
    print(f"  Response status: {response.status_code}")
    print(f"  Response data: {response.data}")
