
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from core.models.batch import Batch
from obe.models import CLOGAMapping, CourseGAScore, CourseSession, GA, CLO


batch = Batch.objects.get(name='bscs-2026')
target_version = batch.curriculum_version
print('=== Batch:', batch)
print('Batch curriculum version:', target_version)

semesters = [1, 2]
for sem_num in semesters:
    print(f'\n--- Semester {sem_num} ---')
    cs_list = CourseSession.objects.filter(
        batch=batch,
        is_active=True,
        assessment_status='ASSESSMENT_DONE',
        semester__number=sem_num
    )
    for cs in cs_list:
        print(f'\n  Course: {cs.course.code} ({cs.course.name})')
        clos = CLO.objects.filter(
            course=cs.course,
            curriculum_version=target_version,
            is_active=True
        )
        print(f'  Number of CLOs for this course in current curriculum: {clos.count()}')
        for clo in clos:
            print(f'    - CLO-{clo.order_number} (ID: {clo.id})')
            mappings = CLOGAMapping.objects.filter(clo=clo, is_active=True)
            print(f'      - Has {mappings.count()} mappings to GAs')
            for m in mappings:
                print(f'        * {m.ga}: weight {m.weight}')
