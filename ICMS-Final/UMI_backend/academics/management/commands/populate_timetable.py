from django.core.management.base import BaseCommand
from academics.models import Department, Semester, Course, Timetable
from instructors.models import Instructor
from datetime import time

class Command(BaseCommand):
    help = 'Populate sample timetable data'

    def handle(self, *args, **options):
        self.stdout.write('Creating sample timetable data...')
        
        try:
            # Get or create sample department
            dept, created = Department.objects.get_or_create(
                code='CS',
                defaults={
                    'name': 'Computer Science',
                    'description': 'Computer Science Department',
                    'num_semesters': 8
                }
            )
            
            # Get or create sample semester
            semester, created = Semester.objects.get_or_create(
                semester_code='CS1',
                defaults={
                    'name': 'Semester 1',
                    'program': 'Bachelor of Computer Science',
                    'capacity': 60,
                    'department': dept
                }
            )
            
            # Create sample courses
            courses_data = [
                {'name': 'Programming Fundamentals', 'code': 'CS101', 'credits': 3},
                {'name': 'Mathematics I', 'code': 'MATH101', 'credits': 3},
                {'name': 'English Composition', 'code': 'ENG101', 'credits': 2},
                {'name': 'Physics', 'code': 'PHY101', 'credits': 3},
                {'name': 'Computer Lab', 'code': 'CS101L', 'credits': 1},
            ]
            
            courses = []
            for course_data in courses_data:
                course, created = Course.objects.get_or_create(
                    code=course_data['code'],
                    defaults={
                        'name': course_data['name'],
                        'credits': course_data['credits'],
                        'semester': semester
                    }
                )
                courses.append(course)
            
            # Get or create sample instructor
            from register.models import User
            
            # Create user for instructor if not exists
            user, created = User.objects.get_or_create(
                email='john.smith@university.edu',
                defaults={
                    'username': 'john.smith',
                    'first_name': 'John',
                    'last_name': 'Smith'
                }
            )
            
            instructor, created = Instructor.objects.get_or_create(
                employee_id='INS001',
                defaults={
                    'user': user,
                    'name': 'Dr. John Smith',
                    'phone': '123-456-7890',
                    'department': dept,
                    'specialization': 'Computer Science'
                }
            )
            
            # Create sample timetable entries
            timetable_data = [
                # Monday
                {'course': courses[0], 'day': 'monday', 'start_time': time(9, 0), 'end_time': time(10, 30), 'room': 'Room 101'},
                {'course': courses[1], 'day': 'monday', 'start_time': time(11, 0), 'end_time': time(12, 30), 'room': 'Room 102'},
                {'course': courses[2], 'day': 'monday', 'start_time': time(14, 0), 'end_time': time(15, 0), 'room': 'Room 103'},
                
                # Tuesday
                {'course': courses[0], 'day': 'tuesday', 'start_time': time(10, 0), 'end_time': time(11, 30), 'room': 'Room 101'},
                {'course': courses[3], 'day': 'tuesday', 'start_time': time(13, 0), 'end_time': time(14, 30), 'room': 'Lab 201'},
                {'course': courses[4], 'day': 'tuesday', 'start_time': time(15, 0), 'end_time': time(17, 0), 'room': 'Computer Lab'},
                
                # Wednesday
                {'course': courses[1], 'day': 'wednesday', 'start_time': time(9, 0), 'end_time': time(10, 30), 'room': 'Room 102'},
                {'course': courses[2], 'day': 'wednesday', 'start_time': time(11, 0), 'end_time': time(12, 0), 'room': 'Room 103'},
                {'course': courses[3], 'day': 'wednesday', 'start_time': time(14, 0), 'end_time': time(15, 30), 'room': 'Lab 201'},
                
                # Thursday
                {'course': courses[0], 'day': 'thursday', 'start_time': time(9, 0), 'end_time': time(10, 30), 'room': 'Room 101'},
                {'course': courses[1], 'day': 'thursday', 'start_time': time(11, 0), 'end_time': time(12, 30), 'room': 'Room 102'},
                
                # Friday
                {'course': courses[2], 'day': 'friday', 'start_time': time(10, 0), 'end_time': time(11, 0), 'room': 'Room 103'},
                {'course': courses[3], 'day': 'friday', 'start_time': time(13, 0), 'end_time': time(14, 30), 'room': 'Lab 201'},
                {'course': courses[4], 'day': 'friday', 'start_time': time(15, 0), 'end_time': time(17, 0), 'room': 'Computer Lab'},
            ]
            
            # Create timetable entries
            for entry in timetable_data:
                timetable, created = Timetable.objects.get_or_create(
                    course=entry['course'],
                    day=entry['day'],
                    start_time=entry['start_time'],
                    defaults={
                        'instructor': instructor,
                        'end_time': entry['end_time'],
                        'room': entry['room']
                    }
                )
                if created:
                    self.stdout.write(f'Created timetable: {timetable}')
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully created sample timetable data for {dept.name} - {semester.name}'
                )
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error creating timetable data: {str(e)}')
            )