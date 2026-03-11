from django.core.management.base import BaseCommand
from academics.models import Department, Semester

class Command(BaseCommand):
    help = 'Populate semesters for all existing departments'

    def handle(self, *args, **kwargs):
        departments = Department.objects.all()
        for department in departments:
            existing_semesters = Semester.objects.filter(department=department).count()
            if existing_semesters < department.num_semesters:
                for i in range(existing_semesters + 1, department.num_semesters + 1):
                    Semester.objects.create(
                        name=f"Semester {i}",
                        semester_code=f"{department.code}-S{i}",
                        program=department.name,
                        capacity=30,
                        department=department
                    )
                self.stdout.write(self.style.SUCCESS(f"Added semesters for department {department.name}"))
            else:
                self.stdout.write(f"Department {department.name} already has {existing_semesters} semesters")
