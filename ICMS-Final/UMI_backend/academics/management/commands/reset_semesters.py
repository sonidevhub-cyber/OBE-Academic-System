from django.core.management.base import BaseCommand
from academics.models import Semester, Department

class Command(BaseCommand):
    help = 'Remove all existing semesters and add new semesters numbered 1 to 8 for each department'

    def handle(self, *args, **options):
        # Delete all existing semesters
        Semester.objects.all().delete()
        self.stdout.write(self.style.SUCCESS('Deleted all existing semesters.'))

        # For each department, create semesters 1 to 8
        departments = Department.objects.all()
        for department in departments:
            for sem_num in range(1, 9):
                semester_code = f'SEM{sem_num}'
                semester_name = f'Semester {sem_num}'
                semester, created = Semester.objects.get_or_create(
                    department=department,
                    semester_code=semester_code,
                    defaults={
                        'name': semester_name,
                        'program': department.name,
                        'capacity': 30,
                    }
                )
                if created:
                    self.stdout.write(self.style.SUCCESS(f'Created {semester_name} for department {department.name}'))
                else:
                    self.stdout.write(f'{semester_name} for department {department.name} already exists.')

        self.stdout.write(self.style.SUCCESS('Reset semesters completed successfully.'))
