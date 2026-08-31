import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'UMI_backend.settings')
import django
django.setup()

from obe.models import CourseSession, CLO
from academics.models import Batch
from curriculum.models import CurriculumVersion
from decimal import Decimal
from assessments.services.clo_service import CLOService

b = Batch.objects.get(name='BSCS(2025-2029)')
cs = CourseSession.objects.filter(course__code='GEN-103.', batch=b, semester__name='Semester 1').first()
course = cs.course

# Check curriculum version mismatch
batch_cv = cs.batch.curriculum_version
print(f'Batch curriculum_version_id: {batch_cv.id if batch_cv else None}')
print(f'Batch curriculum_version_no: {batch_cv.version_no if batch_cv else None}')

program_cv = CurriculumVersion.objects.filter(program=course.program, is_active=True).first()
print(f'Program active curriculum_version_id: {program_cv.id if program_cv else None}')
print(f'Program active curriculum_version_no: {program_cv.version_no if program_cv else None}')
print(f'Same? {batch_cv.id == program_cv.id if batch_cv and program_cv else "N/A"}')

# Check CLOs from both versions
batch_clos = CLO.objects.filter(course=course, is_active=True, curriculum_version=batch_cv) if batch_cv else CLO.objects.filter(course=course, is_active=True)
program_clos = CLO.objects.filter(course=course, is_active=True, curriculum_version=program_cv) if program_cv else CLO.objects.none()
print(f'\nBatch CV CLOs: {batch_clos.count()}')
[print(f'  {c.id} | CLO-{c.order_number} | cv={c.curriculum_version_id}') for c in batch_clos]
print(f'Program CV CLOs: {program_clos.count()}')
[print(f'  {c.id} | CLO-{c.order_number} | cv={c.curriculum_version_id}') for c in program_clos]

# Now check what generate_student_report returns
r = CLOService.generate_student_report(course_id=cs.course_id, batch_id=cs.batch_id, semester_id=cs.semester_id)
students = r.get('students', [])
class_clo = r.get('class_clo_attainment', {})
total = len(students)
print(f'\nService: {total} students')

# Simulate what report_views.py does
for clo in batch_clos:
    clo_code = f'CLO-{clo.order_number}'
    target_kpi = float(class_clo.get(clo_code, {}).get('kpi', clo.kpi_target))
    
    pass_count = 0
    for s in students:
        s_clo = (s.get('clo_attainment') or {}).get(clo_code)
        if s_clo:
            pct = Decimal(str(s_clo.get('percentage', 0) or 0))
            kpi = Decimal(str(s_clo.get('kpi', target_kpi) or target_kpi))
            if pct >= kpi:
                pass_count += 1
    
    overall = round((Decimal(pass_count) / Decimal(total)) * Decimal('100'), 2) if total > 0 else None
    print(f'{clo_code}: pass_count={pass_count}/{total} = {overall}% | service says: {class_clo.get(clo_code, {}).get("percentage", "N/A")}')

# Check for students missing CLO-3 attainment
missing = []
for s in students:
    clo3_data = (s.get('clo_attainment') or {}).get('CLO-3')
    if not clo3_data:
        missing.append(s.get('registration_number'))
print(f'\nStudents missing CLO-3 in clo_attainment: {len(missing)}')
for m in missing:
    print(f'  {m}')
