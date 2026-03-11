from django.core.management.base import BaseCommand
from students.models import Student
from academics.models import Course

class Command(BaseCommand):
    help = 'Fix invalid course_id values in students table'

    def handle(self, *args, **options):
        self.stdout.write('Fixing invalid course_id values...')

        students = Student.objects.all()
        fixed_count = 0

        for student in students:
            if student.course_id:
                try:
                    # Try to get the course by ID
                    Course.objects.get(pk=student.course_id)
                except Course.DoesNotExist:
                    # If course doesn't exist, set to None
                    student.course = None
                    student.save(update_fields=['course'])
                    fixed_count += 1
                    self.stdout.write(f'Fixed student {student.student_id}: course_id {student.course_id} -> None')
                except (ValueError, TypeError):
                    # If course_id is not a valid integer (e.g., string), set to None
                    student.course = None
                    student.save(update_fields=['course'])
                    fixed_count += 1
                    self.stdout.write(f'Fixed student {student.student_id}: invalid course_id {student.course_id} -> None')

        self.stdout.write(
            self.style.SUCCESS(f'Successfully fixed {fixed_count} invalid course references.')
        )
