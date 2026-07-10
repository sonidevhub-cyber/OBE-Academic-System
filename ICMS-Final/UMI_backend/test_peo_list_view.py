
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from core.models import Program
from obe.views.peo_views import PEOListCreateView
from django.http import HttpRequest

print("=== Testing PEOListCreateView ===")
program = Program.objects.filter(is_active=True).first()
if not program:
    print("No active program found")
    exit()
print(f"Program found: {program.name} (id: {program.id})")


# Simulate calling the view
request = HttpRequest()
view = PEOListCreateView()
view.setup(request, program_id=program.id)
response = view.get(request, program_id=program.id)
print(f"Response status: {response.status_code}")
print(f"Response data: {response.data}")
