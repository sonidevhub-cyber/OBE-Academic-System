
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from core.models import Program, Batch, Course, Semester
from obe.models import CourseSession, CLO, CLOGAMapping, GA, GAPEOMapping, GAReport, CourseGAScore
from assessments.models import (
    Assessment, Question, StudentQuestionMark, StudentAssessment, CLOAttainment
)
from students.models import Student
from coordinators.models import TeacherAllocation
from assessments.services.clo_service import CLOService
from obe.services import calculate_all_course_ga_scores
import random
from datetime import date, timedelta
from decimal import Decimal

User = get_user_model()

class Command(BaseCommand):
    help = "Create instructors, TRF, allocate to semester 1 courses, create assessments, and add marks"

    def handle(self, *args, **options):
        # Step 1: Create 10 instructors and 5 TRF teachers
        self.stdout.write(self.style.NOTICE("\n--- Creating Instructors and TRF Teachers ---"))
        self.create_faculty()

        # Step 2: Get all active programs and process each
        active_programs = Program.objects.filter(is_active=True)
        for program in active_programs:
            self.stdout.write(self.style.NOTICE(f"\n--- Processing Program: {program.name} ---"))
            self.process_program(program)

        self.stdout.write(self.style.SUCCESS("\n✅ All tasks completed!"))

    def create_faculty(self):
        # Create 10 instructors
        for i in range(1, 11):
            email = f"instructor_{i}@eduobe.edu"
            full_name = f"Instructor {i}"
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "full_name": full_name,
                    "role": "instructor",
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created instructor: {full_name} ({email})"))

        # Create 5 TVF teachers (using 'instructor' role with 'Visiting Faculty' designation)
        for i in range(1, 6):
            email = f"trf_{i}@eduobe.edu"
            full_name = f"TRF Teacher {i}"
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "full_name": full_name,
                    "role": "instructor",
                    "designation": "Visiting Faculty",
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created TRF teacher: {full_name} ({email})"))

    def process_program(self, program):
        # Get semester 1 for this program
        semester_1 = Semester.objects.filter(program=program, number=1).first()
        if not semester_1:
            self.stdout.write(self.style.ERROR(f"Semester 1 not found for {program.name}!"))
            return

        # Get all active instructors for this program
        faculty = list(User.objects.filter(
            role="instructor",
            is_active=True
        ))
        if not faculty:
            self.stdout.write(self.style.ERROR(f"No faculty found for {program.name}!"))
            return

        # Get all semester 1 courses for this program
        semester1_courses = Course.objects.filter(
            program=program, semester=semester_1, is_active=True
        )
        if not semester1_courses:
            self.stdout.write(self.style.ERROR(f"No semester 1 courses found for {program.name}!"))
            return

        # Get all active batches for this program
        active_batches = Batch.objects.filter(is_active=True, program=program)
        
        # Delete all assessments, questions, student marks, and CLO attainments for semester 1 courses
        self.stdout.write(self.style.NOTICE(f"\n--- Deleting all existing data for {program.name} ---"))
        from assessments.models import (
            Assessment, Question, StudentQuestionMark, StudentAssessment, CLOAttainment
        )
        for batch in active_batches:
            for course in semester1_courses:
                # Delete CLOAttainment
                CLOAttainment.objects.filter(
                    course_id=course.id,
                    batch_id=batch.id,
                    semester_id=semester_1.id
                ).delete()
                
                # Delete StudentQuestionMark, StudentAssessment, Question, Assessment
                assessments = Assessment.objects.filter(
                    course=course,
                    batch=batch,
                    semester=semester_1
                )
                deleted_count = assessments.delete()[0]
                if deleted_count > 0:
                    self.stdout.write(f"Deleted {deleted_count} items for {course.name} in {batch.name}")
        
        # Get a user to use as allocated_by
        allocated_by = User.objects.filter(is_staff=True, is_active=True).first()
        if not allocated_by:
            allocated_by = User.objects.filter(is_superuser=True, is_active=True).first()
        if not allocated_by:
            allocated_by = faculty[0]

        # Allocate teachers to courses and create CourseSessions
        self.stdout.write(self.style.NOTICE(f"\n--- Allocating teachers and creating CourseSessions for {program.name} ---"))
        for batch in active_batches:
            curriculum_version = batch.curriculum_version
            if not curriculum_version:
                self.stdout.write(self.style.WARNING(f"No curriculum version for batch {batch.name}!"))
                continue
                
            for course in semester1_courses:
                # Check 1: Course has active CLOs
                clos = CLO.objects.filter(course=course, is_active=True)
                if not clos.exists():
                    self.stdout.write(self.style.WARNING(f"Skipping {course.name} (no active CLOs)"))
                    continue
                
                # Check 2: All CLOs have at least one CLO-GA mapping
                clos_without_ga = []
                for clo in clos:
                    if not CLOGAMapping.objects.filter(clo=clo, is_active=True).exists():
                        clos_without_ga.append(clo)
                if len(clos_without_ga) > 0:
                    self.stdout.write(self.style.WARNING(f"Skipping {course.name} (some CLOs have no GA mappings)"))
                    continue
                
                # Check 3: All GAs (mapped to course's CLOs) have at least one GA-PEO mapping
                # Get all unique GAs mapped to this course's CLOs
                mapped_gas = GA.objects.filter(
                    clo_mappings__clo__in=clos,
                    clo_mappings__is_active=True,
                    is_active=True
                ).distinct()
                # Check each mapped GA has at least one PEO mapping
                gas_without_peo = []
                for ga in mapped_gas:
                    if not GAPEOMapping.objects.filter(ga=ga, is_active=True).exists():
                        gas_without_peo.append(ga)
                if len(gas_without_peo) > 0:
                    self.stdout.write(self.style.WARNING(f"Skipping {course.name} (some mapped GAs have no PEO mappings)"))
                    continue

                # All checks passed! Now proceed
                # Assign random faculty to course
                instructor = random.choice(faculty)
                
                course_session, created = CourseSession.objects.get_or_create(
                    course=course,
                    batch=batch,
                    semester=semester_1,
                    defaults={
                        "instructor": instructor,
                        "assessment_status": "ASSESSMENT_DONE",
                        "is_active": True
                    }
                )
                if created:
                    self.stdout.write(
                        f"Created CourseSession for {course.name} in {batch.name} with {instructor.full_name}"
                    )
                
                # Create TeacherAllocation entry
                teacher_alloc, alloc_created = TeacherAllocation.objects.get_or_create(
                    curriculum_version=curriculum_version,
                    course=course,
                    batch=batch,
                    semester_no=1,
                    defaults={
                        "teacher": instructor,
                        "allocated_by": allocated_by,
                        "status": "active",
                        "is_active": True
                    }
                )
                if alloc_created:
                    self.stdout.write(
                        f"Created TeacherAllocation for {course.name} in {batch.name} to {instructor.full_name}"
                    )

                # Create assessments for this CourseSession
                self.create_assessments_for_course(course, batch, semester_1, instructor)

        # Add marks for all students
        self.stdout.write(self.style.NOTICE(f"\n--- Adding marks for {program.name} ---"))
        self.add_student_marks(active_batches, semester1_courses, semester_1)
        
        # Calculate CLO Attainments to trigger CQI
        self.stdout.write(self.style.NOTICE(f"\n--- Calculating CLO Attainments for {program.name} ---"))
        for batch in active_batches:
            for course in semester1_courses:
                try:
                    # Need to get the semester ID (semester_1)
                    CLOService.generate_student_report(
                        course_id=course.id,
                        batch_id=batch.id,
                        semester_id=semester_1.id
                    )
                    self.stdout.write(f"Calculated CLO attainment for {course.name} in {batch.name}")
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Error calculating for {course.name} in {batch.name}: {e}"))
        
        # Calculate CourseGAScores for all CourseSessions
        self.stdout.write(self.style.NOTICE(f"\n--- Calculating Course GA Scores ---"))
        for batch in active_batches:
            for course_session in CourseSession.objects.filter(
                batch=batch,
                semester=semester_1,
                is_active=True
            ):
                try:
                    scores = calculate_all_course_ga_scores(course_session)
                    self.stdout.write(
                        f"Calculated {len(scores)} GA scores for CourseSession {course_session.course.name} - {batch.name}"
                    )
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f"Error calculating CourseGAScores for {course_session.course.name} - {batch.name}: {e}")
                    )
        
        # Finalize/lock all reports (CourseSession and GAReport) for semester 1
        self.stdout.write(self.style.NOTICE(f"\n--- Finalizing Reports for Semester 1 ---"))
        for batch in active_batches:
            # Lock CourseSessions
            for course_session in CourseSession.objects.filter(
                batch=batch,
                semester=semester_1,
                is_active=True
            ):
                course_session.assessment_status = "ASSESSMENT_DONE"
                course_session.allow_result_editing = False
                course_session.save()
                self.stdout.write(f"Locked CourseSession: {course_session.course.name} - {batch.name}")
            
            # Create/update and lock GAReports for this batch
            for ga in GA.objects.filter(program=program, is_active=True):
                ga_report, created = GAReport.objects.update_or_create(
                    batch=batch,
                    ga=ga,
                    defaults={"is_locked": True}
                )
                if created:
                    self.stdout.write(f"Created & Locked GAReport: {ga.title} - {batch.name}")
                else:
                    self.stdout.write(f"Updated & Locked GAReport: {ga.title} - {batch.name}")

    def create_assessments_for_course(self, course, batch, semester, instructor):
        # Get all CLOs for this course
        clos = CLO.objects.filter(course=course, is_active=True)
        if not clos:
            return

        # Required assessment types
        required_titles = [
            "Quiz 1", "Quiz 2", "Quiz 3",
            "Assignment 1", "Assignment 2", "Assignment 3",
            "Presentation", "Midterm", "Final"
        ]
        
        # Delete extra assessments (not in required_titles)
        extra_assessments = Assessment.objects.filter(
            course=course,
            batch=batch,
            semester=semester
        ).exclude(title__in=required_titles)
        deleted_count = extra_assessments.delete()[0]
        if deleted_count > 0:
            self.stdout.write(f"Deleted {deleted_count} extra assessments for {course.name} in {batch.name}")

        # Create assessment types with specified total marks
        assessment_types = [
            ("Quiz 1", "quiz", 5),
            ("Quiz 2", "quiz", 5),
            ("Quiz 3", "quiz", 5),
            ("Assignment 1", "assignment", 5),
            ("Assignment 2", "assignment", 5),
            ("Assignment 3", "assignment", 5),
            ("Presentation", "presentation", 15),
            ("Midterm", "midterm", 25),
            ("Final", "final", 60),
        ]

        for title, atype, total_marks in assessment_types:
            assessment, created = Assessment.objects.get_or_create(
                title=title,
                course=course,
                batch=batch,
                semester=semester,
                instructor=instructor,
                assessment_type=atype,
                defaults={
                    "total_marks": total_marks,
                    "assessment_date": date.today() - timedelta(days=random.randint(1, 30)),
                    "is_finalized": True
                }
            )

            if not created:
                continue

            # Create questions for each CLO
            for clo in clos:
                Question.objects.get_or_create(
                    assessment=assessment,
                    clo=clo,
                    defaults={
                        "description": f"Question for {clo.title}",
                        "bloom_level": clo.bloom_level,
                        "marks": (Decimal(str(total_marks)) / Decimal(str(len(clos)))).quantize(Decimal('0.00'))
                    }
                )

    def add_student_marks(self, batches, courses, semester):
        students = list(Student.objects.filter(
            user__batch__in=batches,
            user__is_active=True
        ))
        self.stdout.write(f"Adding marks for {len(students)} students")

        # Assign some students to get low marks (trigger CQI) and some high (achieve KPI)
        num_low = len(students) // 3  # ~33% students trigger CQI
        low_students = random.sample(students, num_low)
        
        for student in students:
            for course in courses:
                for assessment in Assessment.objects.filter(
                    course=course,
                    batch=student.user.batch,
                    semester=semester,
                    is_finalized=True
                ):
                    questions = assessment.questions.all()
                    total_marks_obtained = Decimal('0.00')

                    # Add marks per question
                    for question in questions:
                        # Generate random marks: 30-50% for low students, 70-100% for others
                        if student in low_students:
                            percentage = Decimal(str(random.uniform(0.3, 0.5)))
                        else:
                            percentage = Decimal(str(random.uniform(0.7, 1.0)))
                        marks = percentage * question.marks
                        sqm, created = StudentQuestionMark.objects.get_or_create(
                            student=student,
                            question=question,
                            defaults={"marks_obtained": marks.quantize(Decimal('0.00'))}
                        )
                        # Always add marks, whether created or existing
                        if created:
                            total_marks_obtained += marks
                        else:
                            total_marks_obtained += sqm.marks_obtained

                    # Create or update StudentAssessment
                    sa, created = StudentAssessment.objects.update_or_create(
                        student=student,
                        assessment=assessment,
                        defaults={
                            "marks_obtained": total_marks_obtained.quantize(Decimal('0.00'))
                        }
                    )

        self.stdout.write("Marks added successfully!")
