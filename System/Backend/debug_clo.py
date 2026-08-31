import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'UMI_backend.settings')
import django
django.setup()

from obe.models import CourseSession
from academics.models import Batch
from assessments.services.clo_service import CLOService

b = Batch.objects.get(name='BSCS(2025-2029)')
cs = CourseSession.objects.filter(course__code='GEN-103.', batch=b, semester__name='Semester 1').first()
print(f'CS ID: {cs.id}')

r = CLOService.generate_student_report(course_id=cs.course_id, batch_id=cs.batch_id, semester_id=cs.semester_id)
print(f'Total students in report: {len(r.get("students", []))}')
ca = r.get('class_clo_attainment', {})
for k, v in ca.items():
    print(f'  {k}: {v}')

failed = [s for s in r.get('students', []) if s.get('status') == 'FAIL']
print(f'Failed students: {len(failed)}')
for s in failed:
    reg = s.get('registration_number', '')
    name = s.get('name', '')
    pct = s.get('percentage', 0)
    clo3 = s.get('clo_attainment', {}).get('CLO-3', {})
    print(f'  {reg} | {name} | overall_pct={pct} | status={s.get("status")} | CLO-3={clo3}')

# Also check: which students are counted in get_students_for_batch
from obe.services import get_students_for_batch
gb_students = list(get_students_for_batch(b))
print(f'\nget_students_for_batch count: {len(gb_students)}')

# Check if the failing student is in get_students_for_batch
report_student_ids = set(str(s.get('student_id')) for s in r.get('students', []))
batch_student_ids = set(str(s.student_id) for s in gb_students)
print(f'Students in report but not in get_students_for_batch: {report_student_ids - batch_student_ids}')
print(f'Students in get_students_for_batch but not in report: {batch_student_ids - report_student_ids}')
