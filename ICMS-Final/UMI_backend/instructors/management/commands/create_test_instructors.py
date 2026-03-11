from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from register.models import User
from instructors.models import Instructor
from academics.models import Department

class Command(BaseCommand):
    help = 'Create test instructors'

    def handle(self, *args, **options):
        # Get or create a department
        department, created = Department.objects.get_or_create(
            name='Computer Science',
            defaults={'code': 'CS', 'description': 'Computer Science Department'}
        )
        
        # Create test instructors
        instructors_data = [
            {
                'name': 'John Smith',
                'email': 'john.smith@university.edu',
                'employee_id': 'EMP001',
                'specialization': 'Software Engineering',
                'experience_years': 5
            },
            {
                'name': 'Jane Doe',
                'email': 'jane.doe@university.edu',
                'employee_id': 'EMP002',
                'specialization': 'Data Science',
                'experience_years': 3
            },
            {
                'name': 'Bob Johnson',
                'email': 'bob.johnson@university.edu',
                'employee_id': 'EMP003',
                'specialization': 'Web Development',
                'experience_years': 7
            }
        ]
        
        for instructor_data in instructors_data:
            # Create user
            user, created = User.objects.get_or_create(
                email=instructor_data['email'],
                defaults={
                    'username': instructor_data['email'],
                    'password': make_password('password123'),
                    'role': 'instructor',
                    'name': instructor_data['name']
                }
            )
            
            # Create instructor profile
            instructor, created = Instructor.objects.get_or_create(
                user=user,
                defaults={
                    'name': instructor_data['name'],
                    'employee_id': instructor_data['employee_id'],
                    'specialization': instructor_data['specialization'],
                    'experience_years': instructor_data['experience_years'],
                    'department': department,
                    'phone': '123-456-7890'
                }
            )
            
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'Successfully created instructor: {instructor.name}')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'Instructor already exists: {instructor.name}')
                )
        
        self.stdout.write(
            self.style.SUCCESS(f'Created test instructors in department: {department.name}')
        )