from django.core.management.base import BaseCommand
from academics.models import Department, Course
from students.models import Student
from register.models import User
from django.contrib.auth.hashers import make_password

class Command(BaseCommand):
    help = 'Create sample data for testing'

    def handle(self, *args, **options):
        # Create departments
        departments_data = [
            {'name': 'Computer Science', 'code': 'CS', 'description': 'Computer Science Department'},
            {'name': 'Electrical Engineering', 'code': 'EE', 'description': 'Electrical Engineering Department'},
            {'name': 'Business Administration', 'code': 'BA', 'description': 'Business Administration Department'},
            {'name': 'Mathematics', 'code': 'MATH', 'description': 'Mathematics Department'},
        ]

        departments = []
        for dept_data in departments_data:
            dept, created = Department.objects.get_or_create(
                code=dept_data['code'],
                defaults=dept_data
            )
            departments.append(dept)
            if created:
                self.stdout.write(f'Created department: {dept.name}')

        # Create courses
        courses_data = [
            {'name': 'Introduction to Programming', 'code': 'CS101', 'department': departments[0]},
            {'name': 'Data Structures', 'code': 'CS102', 'department': departments[0]},
            {'name': 'Database Systems', 'code': 'CS201', 'department': departments[0]},
            {'name': 'Circuit Analysis', 'code': 'EE101', 'department': departments[1]},
            {'name': 'Digital Electronics', 'code': 'EE102', 'department': departments[1]},
            {'name': 'Business Management', 'code': 'BA101', 'department': departments[2]},
            {'name': 'Marketing Principles', 'code': 'BA201', 'department': departments[2]},
            {'name': 'Calculus I', 'code': 'MATH101', 'department': departments[3]},
            {'name': 'Linear Algebra', 'code': 'MATH201', 'department': departments[3]},
        ]

        courses = []
        for course_data in courses_data:
            course, created = Course.objects.get_or_create(
                code=course_data['code'],
                defaults=course_data
            )
            courses.append(course)
            if created:
                self.stdout.write(f'Created course: {course.name}')

        # Create sample students
        students_data = [
            {
                'name': 'John Doe',
                'email': 'john.doe@example.com',
                'phone': '+1234567890',
                'department': departments[0],
                'course': courses[0],
                'date_of_birth': '2000-01-15',
                'father_guardian': 'Robert Doe',
            },
            {
                'name': 'Jane Smith',
                'email': 'jane.smith@example.com',
                'phone': '+1234567891',
                'department': departments[0],
                'course': courses[1],
                'date_of_birth': '2000-03-20',
                'father_guardian': 'Michael Smith',
            },
            {
                'name': 'Alice Johnson',
                'email': 'alice.johnson@example.com',
                'phone': '+1234567892',
                'department': departments[1],
                'course': courses[3],
                'date_of_birth': '1999-07-10',
                'father_guardian': 'David Johnson',
            },
            {
                'name': 'Bob Wilson',
                'email': 'bob.wilson@example.com',
                'phone': '+1234567893',
                'department': departments[2],
                'course': courses[5],
                'date_of_birth': '2001-05-25',
                'father_guardian': 'James Wilson',
            },
        ]

        for student_data in students_data:
            student, created = Student.objects.get_or_create(
                email=student_data['email'],
                defaults=student_data
            )
            if created:
                self.stdout.write(f'Created student: {student.name}')

        # Create a test user
        user, created = User.objects.get_or_create(
            username='testuser',
            defaults={
                'email': 'test@example.com',
                'password': make_password('testpass123'),
                'role': 'student',
                'first_name': 'Test',
                'last_name': 'User',
            }
        )
        if created:
            self.stdout.write(f'Created test user: {user.username}')

        self.stdout.write(
            self.style.SUCCESS('Successfully created sample data!')
        )




