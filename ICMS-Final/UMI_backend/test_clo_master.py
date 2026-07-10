
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from clo_master.views import CLOMasterViewSet
from rest_framework.test import APIRequestFactory
from core.models import Program, Semester, Batch

factory = APIRequestFactory()
view = CLOMasterViewSet.as_view({'get': 'get_report'})

# Test parameters
program_id = "3ef8367b-16c6-460e-b635-2c70ed33ee6e"  # BS Computer Science
semester_id = "031496e4-440f-4e06-ad14-175d582ea165"  # Semester 3
batch_id = "0130298e-55b6-4023-a50c-0a65c1c03b91"  # bscs-2026

# Create a request
request = factory.get(f"/api/clo-master/report/{program_id}/{semester_id}/", {'batch_id': batch_id})

# Call the view
response = view(request, program_id=program_id, semester_id=semester_id)

print("Status code:", response.status_code)
data = response.data
print("\nProgram:", data['program'])
print("\nSemester:", data['semester'])
print("\nBatch:", data['batch'])
print("\nStatus:", data['status'])
print("\nFinalized courses count:", len(data['finalized_courses']))
print("\nStudents count:", len(data['students']))
print("\nSample student data:", data['students'][0] if data['students'] else None)
