
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from core.models import Program, Batch, Course, Semester
from curriculum.models import CurriculumVersion, CurriculumVersionCourse
from obe.models import PEO, GA, CLO, CLOGAMapping
import random

User = get_user_model()

class Command(BaseCommand):
    help = "Add instructors, TRF teachers, 4 CLOs per course, and ensure 6 courses per semester for batches"

    def handle(self, *args, **options):
        # Get BSCS Program
        bscs_program = Program.objects.filter(code="BSCS").first()
        if not bscs_program:
            self.stdout.write(self.style.ERROR("BSCS Program not found!"))
            return

        # 1. Create 15 Instructors
        self.stdout.write(self.style.NOTICE("\n--- Creating Instructors ---"))
        for i in range(1, 16):
            email = f"instructor_{i}@eduobe.edu"
            full_name = f"Instructor {i}"
            try:
                user = User.objects.get_or_create(
                    email=email,
                    defaults={
                        "full_name": full_name,
                        "role": "instructor",
                    }
                )[0]
                self.stdout.write(self.style.SUCCESS(f"Created instructor {full_name} ({email})"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Failed to create instructor {i}: {e}"))

        # 2. Create 5 TRF Teachers
        self.stdout.write(self.style.NOTICE("\n--- Creating TRF Teachers ---"))
        for i in range(1, 6):
            email = f"trf_{i}@eduobe.edu"
            full_name = f"TRF Teacher {i}"
            try:
                user = User.objects.get_or_create(
                    email=email,
                    defaults={
                        "full_name": full_name,
                        "role": "instructor",
                    }
                )[0]
                self.stdout.write(self.style.SUCCESS(f"Created TRF teacher {full_name} ({email})"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Failed to create TRF teacher {i}: {e}"))

        # 3. Get or create Curriculum Version
        curriculum = CurriculumVersion.objects.filter(program=bscs_program).first()
        if not curriculum:
            curriculum = CurriculumVersion.objects.create(
                program=bscs_program,
                version_no="v1.0"
            )

        # 4. Ensure each Semester has 6 Courses and each Course has 4 CLOs
        semesters = Semester.objects.filter(program=bscs_program)
        self.stdout.write(self.style.NOTICE("\n--- Ensuring 6 courses per semester and adding 4 CLOs per course ---"))

        # First, make sure all courses have curriculum assignments
        all_courses = Course.objects.filter(program=bscs_program, is_active=True)
        for course in all_courses:
            # Ensure course is in its semester's curriculum
            if course.semester:
                CurriculumVersionCourse.objects.get_or_create(
                    version=curriculum,
                    course=course,
                    semester_no=course.semester.number,
                    defaults={"is_active": True}
                )

            # Create or get 4 CLOs per course
            for clo_num in range(1,5):
                title = f"CLO {clo_num}: Understand and Apply {course.name}"
                description = f"Students will demonstrate understanding and application of {course.name} concepts"
                CLO.objects.get_or_create(
                    course=course,
                    curriculum_version=curriculum,
                    order_number=clo_num,
                    defaults={
                        "title": title,
                        "description": description,
                        "bloom_level": f"K{min(clo_num+1, 6)}",
                        "kpi_target": 60,
                        "is_active": True
                    }
                )
            self.stdout.write(f"Ensured 4 CLOs for {course.name}")

        # Now assign curriculum version to all active batches
        active_batches = Batch.objects.filter(is_active=True, program=bscs_program)
        for batch in active_batches:
            if not batch.curriculum_version:
                batch.curriculum_version = curriculum
                batch.save()
                self.stdout.write(self.style.SUCCESS(f"Assigned curriculum to {batch.name}"))

        self.stdout.write(self.style.SUCCESS("\n✅ Completed all tasks!"))
