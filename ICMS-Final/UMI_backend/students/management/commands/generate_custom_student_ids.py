from django.core.management.base import BaseCommand
from students.models import Student

class Command(BaseCommand):
    help = 'Generate custom student IDs for existing students based on department code'

    def handle(self, *args, **options):
        students = Student.objects.filter(department__isnull=False, student_id__isnull=True).order_by('department', 'enrollment_date')
        department_counts = {}

        for student in students:
            dept_code = student.department.code.lower()
            if dept_code not in department_counts:
                department_counts[dept_code] = 0
            department_counts[dept_code] += 1
            new_id = f"{dept_code}{str(department_counts[dept_code]).zfill(3)}"
            Student.objects.filter(pk=student.pk).update(student_id=new_id)
            self.stdout.write(f"Updated {student.name} to ID {new_id}")

        self.stdout.write(self.style.SUCCESS('Custom student IDs generated for existing students'))
