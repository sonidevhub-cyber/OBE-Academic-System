from django.core.management.base import BaseCommand
from academics.models import Department, Semester, Course
from instructors.models import Instructor
from register.models import User

class Command(BaseCommand):
    help = 'Create sample academic data'

    def handle(self, *args, **options):
        # Create departments
        cs_dept, _ = Department.objects.get_or_create(
            code='CS',
            defaults={'name': 'Computer Science', 'num_semesters': 8}
        )
        
        ee_dept, _ = Department.objects.get_or_create(
            code='EE', 
            defaults={'name': 'Electrical Engineering', 'num_semesters': 8}
        )

        # Create semesters if they don't exist
        for dept in [cs_dept, ee_dept]:
            for i in range(1, 9):
                Semester.objects.get_or_create(
                    semester_code=f"{dept.code}-SEM{i}",
                    defaults={
                        'name': f"Semester {i}",
                        'program': dept.name,
                        'capacity': 30,
                        'department': dept
                    }
                )

        # Create courses
        cs_sem1 = Semester.objects.get(semester_code='CS-SEM1')
        cs_sem2 = Semester.objects.get(semester_code='CS-SEM2')
        
        courses_data = [
            {'code': 'CS101', 'name': 'Programming Fundamentals', 'semester': cs_sem1},
            {'code': 'CS102', 'name': 'Data Structures', 'semester': cs_sem1},
            {'code': 'CS201', 'name': 'Object Oriented Programming', 'semester': cs_sem2},
            {'code': 'CS202', 'name': 'Database Systems', 'semester': cs_sem2},
        ]
        
        for course_data in courses_data:
            Course.objects.get_or_create(
                code=course_data['code'],
                defaults={
                    'name': course_data['name'],
                    'credits': 3,
                    'semester': course_data['semester']
                }
            )

        # Create sample instructors
        instructors_data = [
            {'name': 'Dr. John Smith', 'email': 'john.smith@university.edu', 'employee_id': 'INS001'},
            {'name': 'Dr. Sarah Johnson', 'email': 'sarah.johnson@university.edu', 'employee_id': 'INS002'},
            {'name': 'Prof. Michael Brown', 'email': 'michael.brown@university.edu', 'employee_id': 'INS003'},
        ]
        
        for inst_data in instructors_data:
            # Create user first
            user, created = User.objects.get_or_create(
                username=inst_data['employee_id'],
                defaults={
                    'email': inst_data['email'],
                    'name': inst_data['name'],
                    'role': 'instructor'
                }
            )
            
            # Create instructor profile
            Instructor.objects.get_or_create(
                employee_id=inst_data['employee_id'],
                defaults={
                    'name': inst_data['name'],
                    'email': inst_data['email'],
                    'user': user,
                    'department': cs_dept
                }
            )

        self.stdout.write(self.style.SUCCESS('Sample data created successfully'))