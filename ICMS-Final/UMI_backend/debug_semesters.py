
from core.models import Program, Batch, Semester

print("=== Programs ===")
for program in Program.objects.all():
    print(f"  {program.id} - {program.name} ({program.code})")
    print(f"    Semesters:")
    for semester in program.semesters.all():
        print(f"      {semester.id} - {semester.name} (#{semester.number})")

print("\n=== Batches ===")
for batch in Batch.objects.filter(name__in=["bsit-2023", "bscs-2026"]):
    print(f"  {batch.id} - {batch.name}")
    print(f"    Program: {batch.program.name} ({batch.program.id})")
    print(f"    Curriculum Version: {batch.curriculum_version}")
