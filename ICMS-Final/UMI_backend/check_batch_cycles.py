
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from core.models import Batch
from obe.models import AlumniSurveyCycle

print("=== Checking Batches ===")
batches = Batch.objects.filter(is_active=True)
for batch in batches:
    print(f"  - Batch: {batch.name} (id: {batch.id})")
    print(f"    alumni_feedback_enabled: {batch.alumni_feedback_enabled}")
    print(f"    alumni_feedback_enabled_at: {batch.alumni_feedback_enabled_at}")

print("\n=== Checking AlumniSurveyCycles ===")
cycles = AlumniSurveyCycle.objects.all().order_by("-created_at")
for cycle in cycles:
    print(f"  - Cycle: {cycle.survey_window} (id: {cycle.id})")
    print(f"    status: {cycle.status}")
    print(f"    batch: {cycle.batch.name}")
    print(f"    due_at: {cycle.due_at}")
