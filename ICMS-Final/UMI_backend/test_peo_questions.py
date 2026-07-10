
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from core.models import Program
from obe.models import PEO, AlumniSurveyQuestion
from obe.serializers import PEOSerializer, AlumniSurveyQuestionSerializer

print("=== Testing PEO and Alumni Survey Questions ===")
program_id = "3ef8367b-16c6-460e-b635-2c70ed33ee6e"

try:
    program = Program.objects.get(id=program_id)
    print("Program found:", program.name)

    peos = PEO.objects.filter(program=program, is_active=True)
    print(f"\nFound {len(peos)} PEOs:")
    for peo in peos:
        print(f"  - PEO: {peo.title} (id: {peo.id})")
        serializer = PEOSerializer(peo)
        print("    Serialized data:", serializer.data)

        questions = AlumniSurveyQuestion.objects.filter(peo=peo, is_active=True)
        print(f"    Found {len(questions)} alumni survey questions for this PEO:")
        for q in questions:
            q_serializer = AlumniSurveyQuestionSerializer(q)
            print(f"      - {q_serializer.data}")

except Program.DoesNotExist:
    print("Program not found")
