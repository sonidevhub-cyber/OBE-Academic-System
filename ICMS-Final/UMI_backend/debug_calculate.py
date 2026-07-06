
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from core.models.batch import Batch
from obe.models import CourseSession, GA
from obe.services import calculate_course_ga_score


batch = Batch.objects.get(name='bscs-2026')
cs = CourseSession.objects.filter(batch=batch, course__code='db201', semester__number=1).first()
print('Course session:', cs)

program = batch.program
gas = GA.objects.filter(program=program, is_active=True)

print('Number of GAs to calculate for:', len(gas))
for ga in gas:
    print(f'\n--- Calculating for {ga} ---')
    score = calculate_course_ga_score(cs, ga)
    print(f'Result: {score.score if score else "None"}')
