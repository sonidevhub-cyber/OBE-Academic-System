from django.core.management.base import BaseCommand
from students.models import Student

class Command(BaseCommand):
    help = 'Populate student departments based on their course department'

    def handle(self, *args, **options):
        self.stdout.write('Populating student departments...')

        students = Student.objects.filter(department__isnull=True, course__isnull=False)
        updated_count = 0

        for student in students:
            if student.course and student.course.department:
                student.department = student.course.department
                student.save(update_fields=['department'])
                updated_count += 1
                self.stdout.write(f'Updated student {student.student_id}: department set to {student.course.department.name}')

        self.stdout.write(
            self.style.SUCCESS(f'Successfully updated {updated_count} students with department from course.')
        )
