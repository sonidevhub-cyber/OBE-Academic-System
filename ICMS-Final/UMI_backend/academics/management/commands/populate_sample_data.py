from django.core.management.base import BaseCommand
from academics.models import Department, Semester, Course

class Command(BaseCommand):
    help = 'Populate sample departments, semesters, and courses'

    def handle(self, *args, **options):
        # Create sample departments
        departments_data = [
            {'name': 'Computer Science', 'code': 'CS', 'description': 'Department of Computer Science'},
            {'name': 'Electrical Engineering', 'code': 'EE', 'description': 'Department of Electrical Engineering'},
            {'name': 'Mechanical Engineering', 'code': 'ME', 'description': 'Department of Mechanical Engineering'},
            {'name': 'Business Administration', 'code': 'BA', 'description': 'Department of Business Administration'},
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
            else:
                self.stdout.write(f'Department already exists: {dept.name}')

        # Create semesters for each department
        for dept in departments:
            for i in range(1, 9):  # 8 semesters
                semester, created = Semester.objects.get_or_create(
                    department=dept,
                    semester_code=f'{dept.code}SEM{i}',
                    defaults={
                        'name': f'Semester {i}',
                    }
                )
                if created:
                    self.stdout.write(f'Created semester: {semester.name} for {dept.name}')
                else:
                    self.stdout.write(f'Semester already exists: {semester.name} for {dept.name}')

        # Create sample courses
        courses_data = [
            {'name': 'Introduction to Programming', 'code': 'CS101', 'department': 'CS', 'semester': 1, 'credits': 3},
            {'name': 'Data Structures', 'code': 'CS201', 'department': 'CS', 'semester': 2, 'credits': 4},
            {'name': 'Database Systems', 'code': 'CS301', 'department': 'CS', 'semester': 3, 'credits': 3},
            {'name': 'Web Development', 'code': 'CS401', 'department': 'CS', 'semester': 4, 'credits': 3},
            {'name': 'Circuit Analysis', 'code': 'EE101', 'department': 'EE', 'semester': 1, 'credits': 4},
            {'name': 'Digital Electronics', 'code': 'EE201', 'department': 'EE', 'semester': 2, 'credits': 3},
            {'name': 'Thermodynamics', 'code': 'ME101', 'department': 'ME', 'semester': 1, 'credits': 3},
            {'name': 'Fluid Mechanics', 'code': 'ME201', 'department': 'ME', 'semester': 2, 'credits': 4},
            {'name': 'Principles of Management', 'code': 'BA101', 'department': 'BA', 'semester': 1, 'credits': 3},
            {'name': 'Marketing Management', 'code': 'BA201', 'department': 'BA', 'semester': 2, 'credits': 3},
        ]

        for course_data in courses_data:
            try:
                dept = Department.objects.get(code=course_data['department'])
                semester = Semester.objects.get(
                    department=dept,
                    semester_code=f"{dept.code}SEM{course_data['semester']}"
                )
                course, created = Course.objects.get_or_create(
                    code=course_data['code'],
                    defaults={
                        'name': course_data['name'],
                        'description': f'Course in {dept.name}',
                        'credits': course_data['credits'],
                        'semester': semester,
                    }
                )
                if created:
                    self.stdout.write(f'Created course: {course.name} ({course.code})')
                else:
                    self.stdout.write(f'Course already exists: {course.name} ({course.code})')
            except Exception as e:
                self.stdout.write(f'Error creating course {course_data["code"]}: {e}')

        self.stdout.write(self.style.SUCCESS('Sample data population completed!'))
