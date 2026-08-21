
import random
from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth import get_user_model
from core.models.batch import Batch
from core.models.semester import Semester
from core.models.course import Course
from core.models.program import Program
from assessments.models import Assessment, Question, StudentQuestionMark
from students.models import Student
from feedback.models import FeedbackResponse
from obe.models import CourseSession, CLO, CLOGAMapping

User = get_user_model()


class Command(BaseCommand):
    help = "Set up complete BSCS-2026 batch with all 8 semesters"

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('=== Starting setup for BSCS-2026 ==='))

        # 1. Get or create BSCS program and batch
        try:
            program = Program.objects.get(name__iexact='BS Computer Science')
        except Program.DoesNotExist:
            program = Program.objects.create(
                name='BS Computer Science',
                short_name='BSCS',
                total_semesters=8
            )
        self.stdout.write(self.style.SUCCESS(f'Program found: {program}'))

        try:
            batch = Batch.objects.get(name='bscs-2026')
        except Batch.DoesNotExist:
            batch = Batch.objects.create(
                name='bscs-2026',
                program=program,
                session_type='fall',
                current_semester=1,
                status='active'
            )
        self.stdout.write(self.style.SUCCESS(f'Batch found: {batch}'))

        # 2. Get or create an instructor
        try:
            instructor = User.objects.filter(role='instructor', is_active=True).first()
        except Exception:
            instructor = None
        if not instructor:
            instructor = User.objects.create_user(
                username='setup_instructor',
                email='setup_instructor@example.com',
                password='testpass123',
                full_name='Setup Instructor',
                role='instructor',
                is_active=True
            )
        self.stdout.write(self.style.SUCCESS(f'Instructor: {instructor.full_name}'))

        # 3. Get semesters for program
        semesters = list(Semester.objects.filter(program=program).order_by('number'))
        if len(semesters) < 8:
            self.stdout.write(self.style.WARNING('Not enough semesters, creating up to 8'))
            for num in range(1, 9):
                Semester.objects.get_or_create(
                    program=program,
                    number=num,
                    defaults={'name': f'Semester {num}'}
                )
            semesters = list(Semester.objects.filter(program=program).order_by('number'))
        self.stdout.write(self.style.SUCCESS(f'Semesters found: {len(semesters)}'))

        # 4. Check if students exist, if not create some sample ones
        students = list(Student.objects.filter(user__batch=batch))
        if not students:
            self.stdout.write(self.style.WARNING('No students, creating 20 sample students'))
            for i in range(1, 21):
                user = User.objects.create_user(
                    username=f'bscs2026_student{i}',
                    email=f'bscs2026_student{i}@example.com',
                    password='testpass123',
                    full_name=f'Student {i}',
                    role='student',
                    batch=batch,
                    current_semester=1,
                    promotion_status='none',
                    is_active=True
                )
                student = Student.objects.create(
                    user=user,
                    roll_number=f'2026-CS-{i:03d}'
                )
                students.append(student)
        self.stdout.write(self.style.SUCCESS(f'Students: {len(students)}'))

        # 5. Process each semester up to 8
        target_curriculum_version = batch.curriculum_version
        self.stdout.write(self.style.SUCCESS(f'Using curriculum version: {target_curriculum_version}'))

        for sem_num in range(1, 9):
            self.stdout.write(f'\n--- Processing Semester {sem_num} ---')
            current_sem = next(s for s in semesters if s.number == sem_num)
            base_date = date.today() - timedelta(days=((8 - sem_num) * 30))

            # Get courses for this curriculum version if possible, else use active courses
            courses = []
            if target_curriculum_version:
                from curriculum.models import CurriculumVersionCourse
                version_courses = CurriculumVersionCourse.objects.filter(
                    version=target_curriculum_version,
                    is_active=True,
                    semester_no=sem_num
                )
                courses = [vc.course for vc in version_courses]

            if not courses:
                self.stdout.write(self.style.WARNING('Creating sample courses'))
                course1, _ = Course.objects.get_or_create(
                    code=f'CS{sem_num}01', name=f'Introduction to CS {sem_num}'
                )
                course2, _ = Course.objects.get_or_create(
                    code=f'CS{sem_num}02', name=f'Data Structures {sem_num}'
                )
                courses = [course1, course2]

            # Create course sessions for these courses
            for course in courses:
                cs, created = CourseSession.objects.get_or_create(
                    batch=batch,
                    course=course,
                    semester=current_sem,
                    defaults={
                        'instructor': instructor,
                        'is_active': True,
                        'assessment_status': 'ASSESSMENT_DONE',
                        'assessment_done': True
                    }
                )
                self.stdout.write(f'  Course Session: {course.code}')

                # Get CLOs for this course from target curriculum version
                course_clos = CLO.objects.filter(
                    course=course,
                    is_active=True
                )
                if target_curriculum_version:
                    course_clos = course_clos.filter(curriculum_version=target_curriculum_version)

                if not course_clos.exists():
                    self.stdout.write(self.style.WARNING(f'    No CLOs found for {course.code} in target curriculum, skipping assessments'))
                    continue

                # Assessment config: (type, title, total_marks)
                assessment_specs = [
                    ('quiz', 'Quiz 1', 5),
                    ('quiz', 'Quiz 2', 5),
                    ('quiz', 'Quiz 3', 5),
                    ('assignment', 'Assignment 1', 5),
                    ('assignment', 'Assignment 2', 5),
                    ('assignment', 'Assignment 3', 5),
                    ('presentation', 'Presentation', 15),
                    ('midterm', 'Midterm', 25),
                    ('final', 'Final', 60),
                ]

                for a_idx, (a_type, a_title, a_total) in enumerate(assessment_specs):
                    assess, _ = Assessment.objects.get_or_create(
                        course=course,
                        batch=batch,
                        semester=current_sem,
                        title=a_title,
                        defaults={
                            'instructor': instructor,
                            'assessment_type': a_type,
                            'total_marks': Decimal(a_total),
                            'is_finalized': True,
                            'assessment_date': base_date + timedelta(days=a_idx * 5)
                        }
                    )

                    # For this assessment, create a question for each CLO (or use existing ones)
                    for clo in course_clos:
                        existing_q = Question.objects.filter(assessment=assess, clo=clo).first()
                        if not existing_q:
                            # Create new question
                            q = Question.objects.create(
                                assessment=assess,
                                clo=clo,
                                description=f'Question for {clo} ({a_title})',
                                bloom_level='K3',
                                marks=Decimal(a_total / len(course_clos))
                            )
                        else:
                            q = existing_q

                        # Add marks for all students for this question
                        for student in students:
                            StudentQuestionMark.objects.get_or_create(
                                student=student,
                                question=q,
                                defaults={
                                    'marks_obtained': Decimal(
                                        random.randint(int(q.marks * Decimal('0.7')), int(q.marks))
                                    )
                                }
                            )

                cs.assessment_status = 'ASSESSMENT_DONE'
                cs.assessment_done = True
                cs.save()

            # Now add feedback for all students, courses, and their CLOs
            course_sessions = CourseSession.objects.filter(
                batch=batch, semester=current_sem, is_active=True
            )
            for cs in course_sessions:
                course = cs.course
                clos = CLO.objects.filter(course=course, is_active=True)
                if target_curriculum_version:
                    clos = clos.filter(curriculum_version=target_curriculum_version)
                for student in students:
                    for clo in clos:
                        FeedbackResponse.objects.get_or_create(
                            student=student,
                            course=course,
                            batch=batch,
                            semester=current_sem,
                            clo=clo,
                            defaults={'rating': random.randint(4, 5)}
                        )
            self.stdout.write(self.style.SUCCESS(f'  Feedback added'))

            if sem_num < 8:
                self.stdout.write(self.style.SUCCESS(f'  Promoting to Semester {sem_num + 1}'))
                next_sem_num = sem_num + 1
                batch.current_semester = next_sem_num
                batch.save()
                User.objects.filter(
                    batch=batch, role='student', is_active=True
                ).update(current_semester=next_sem_num, promotion_status='provisional')
                User.objects.filter(
                    batch=batch, role='student', is_active=True, promotion_status='provisional'
                ).update(promotion_status='confirmed')

        self.stdout.write(self.style.SUCCESS('=== Setup complete! ==='))
