
import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'UMI_backend.settings')
django.setup()

from core.models import Program, Batch, Course
from curriculum.models import CurriculumVersion
from obe.models import PEO, GA, CLO, CLOGAMapping, GAPEOMapping

print("=== Fixing CLOs, mappings ===")

# Get BSCS program
program = Program.objects.filter(code="BSCS").first()
if not program:
    print("BSCS program not found")
    exit()

print(f"\nFound program: {program}")

# Get active curriculum version (v1.0)
cv = CurriculumVersion.objects.filter(program=program, version_no="v1.0").first()
if not cv:
    print("Curriculum version v1.0 not found")
    exit()
print(f"Using curriculum version: {cv}")

# Get PEOs
peos = list(PEO.objects.filter(program=program, is_active=True))
print(f"\nFound PEOs: {len(peos)}")
for peo in peos:
    print(f"- {peo}")

# Get GAs
gas = list(GA.objects.filter(program=program, is_active=True))
print(f"\nFound GAs: {len(gas)}")
for ga in gas:
    print(f"- {ga}")

# Create GA-PEO mappings if missing for each GA
print(f"\n=== Creating GA-PEO mappings === ")
for ga in gas:
    for peo in peos:
        gap, gap_created = GAPEOMapping.objects.get_or_create(
            ga=ga, peo=peo, defaults={"is_active": True}
        )
        if gap_created:
            print(f"Created: {gap}")

# Get all active BSCS courses semester 1
semester1_courses = Course.objects.filter(
    program=program, semester__number=1, is_active=True
)
print(f"\nFound {len(semester1_courses)} semester 1 courses")

for course in semester1_courses:
    print(f"\nCourse: {course}")

    # Get CLOs for course (with or without curriculum version)
    clos = CLO.objects.filter(course=course, is_active=True)
    print(f"- CLOs: {len(clos)}")

    # If CLOs exist but have no curriculum_version, assign it
    for clo in clos:
        if not clo.curriculum_version:
            clo.curriculum_version = cv
            clo.save()
            print(f"  - Assigned curriculum version to {clo}")

        # Create CLO-GA mappings if missing for this CLO
        # Map to first two GAs like setup command
        for ga in gas[:2]:
            clom, clom_created = CLOGAMapping.objects.get_or_create(
                clo=clo,
                ga=ga,
                defaults={"weight": 1.0, "is_active": True},
            )
            if clom_created:
                print(f"  - Created mapping: {clom}")

print("\n✅ Done!")
