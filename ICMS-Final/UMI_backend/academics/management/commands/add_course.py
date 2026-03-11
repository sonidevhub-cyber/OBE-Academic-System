from django.core.management.base import BaseCommand
from academics.models import Department, Course

class Command(BaseCommand):
    help = 'Add sample courses to the database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--department',
            type=str,
            help='Department code to add courses to',
        )
        parser.add_argument(
            '--count',
            type=int,
            default=5,
            help='Number of courses to create',
        )

    def handle(self, *args, **options):
        department_code = options['department']
        count = options['count']

        if department_code:
            try:
                department = Department.objects.get(code=department_code)
            except Department.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f'Department with code "{department_code}" does not exist.')
                )
                return
        else:
            # Get the first department if none specified
            department = Department.objects.first()
            if not department:
                self.stdout.write(
                    self.style.ERROR('No departments found. Please create a department first.')
                )
                return

        self.stdout.write(f'Adding {count} courses to department: {department.name}')

        courses_data = [
            {'name': 'Introduction to Computer Science', 'code': f'CS{101 + i}', 'description': f'Basic computer science concepts - Course {i+1}'}
            for i in range(count)
        ]

        created_count = 0
        for course_data in courses_data:
            course, created = Course.objects.get_or_create(
                code=course_data['code'],
                defaults={
                    'name': course_data['name'],
                    'description': course_data['description'],
                    'department': department,
                    'credits': 3,
                    'duration_months': 6
                }
            )
            if created:
                created_count += 1
                self.stdout.write(f'Created course: {course.name} ({course.code})')

        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {created_count} courses.')
        )
