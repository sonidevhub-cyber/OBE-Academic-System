
import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'UMI_backend.settings')
django.setup()

from core.models import Program, Batch
from obe.services import calculate_ga_report

program = Program.objects.filter(code="BSCS").first()
batch = Batch.objects.filter(name="BSCS-2024", program=program).first()
print("=== Debug GA Report for BSCS-2024 ===")
print()

report = calculate_ga_report(batch)
for row in report:
    print(f"GA: {row['ga_code']} {row['ga_title']}")
    print(f"  Direct Score: {row['direct_score']}")
    print(f"  Indirect Score: {row['indirect_score']}")
    print(f"  Final Score: {row['final_score']}")
    print(f"  Formula Applied: {row['formula_applied']}")
    print()
