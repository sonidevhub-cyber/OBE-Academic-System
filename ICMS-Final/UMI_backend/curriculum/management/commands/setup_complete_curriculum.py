
from django.core.management.base import BaseCommand
from core.models import Program, Batch, Course, Semester
from curriculum.models import CurriculumVersion, CurriculumVersionCourse
from obe.models import PEO, GA, CLO, CLOGAMapping, GAPEOMapping, CourseSession
from django.contrib.auth import get_user_model

User = get_user_model()

# Sample course data for 8 semesters (6 courses/sem)
SAMPLE_COURSES = [
    # Semester 1
    [
        ("Introduction to Computing", "CS101", 3, "LECTURE"),
        ("Programming Fundamentals", "CS102", 3, "LECTURE"),
        ("Programming Fundamentals Lab", "CS102L", 1, "LAB"),
        ("Calculus & Analytical Geometry", "MATH101", 3, "LECTURE"),
        ("English & Composition", "ENG101", 2, "LECTURE"),
        ("Islamic Studies", "ISL101", 2, "LECTURE"),
    ],
    # Semester 2
    [
        ("Object Oriented Programming", "CS201", 3, "LECTURE"),
        ("Object Oriented Programming Lab", "CS201L", 1, "LAB"),
        ("Discrete Structures", "CS202", 3, "LECTURE"),
        ("Linear Algebra", "MATH102", 3, "LECTURE"),
        ("Pakistan Studies", "PS101", 2, "LECTURE"),
        ("Communication Skills", "ENG102", 2, "LECTURE"),
    ],
    # Semester 3
    [
        ("Data Structures & Algorithms", "CS301", 3, "LECTURE"),
        ("Data Structures & Algorithms Lab", "CS301L", 1, "LAB"),
        ("Digital Logic Design", "CS302", 3, "LECTURE"),
        ("Digital Logic Design Lab", "CS302L", 1, "LAB"),
        ("Differential Equations", "MATH201", 3, "LECTURE"),
        ("Statistics & Probability", "MATH202", 3, "LECTURE"),
    ],
    # Semester 4
    [
        ("Computer Organization & Assembly", "CS401", 3, "LECTURE"),
        ("Computer Organization Lab", "CS401L", 1, "LAB"),
        ("Database Management Systems", "CS402", 3, "LECTURE"),
        ("Database Management Systems Lab", "CS402L", 1, "LAB"),
        ("Operating Systems", "CS403", 3, "LECTURE"),
        ("Operating Systems Lab", "CS403L", 1, "LAB"),
    ],
    # Semester 5
    [
        ("Software Engineering", "CS501", 3, "LECTURE"),
        ("Computer Networks", "CS502", 3, "LECTURE"),
        ("Computer Networks Lab", "CS502L", 1, "LAB"),
        ("Theory of Automata", "CS503", 3, "LECTURE"),
        ("Numerical Computing", "CS504", 3, "LECTURE"),
        ("Technical & Business Writing", "ENG501", 2, "LECTURE"),
    ],
    # Semester 6
    [
        ("Artificial Intelligence", "CS601", 3, "LECTURE"),
        ("Artificial Intelligence Lab", "CS601L", 1, "LAB"),
        ("Web Engineering", "CS602", 3, "LECTURE"),
        ("Web Engineering Lab", "CS602L", 1, "LAB"),
        ("Analysis & Design of Algorithms", "CS603", 3, "LECTURE"),
        ("Final Year Project - I", "CS699", 3, "LECTURE"),
    ],
    # Semester 7
    [
        ("Machine Learning", "CS701", 3, "LECTURE"),
        ("Human Computer Interaction", "CS702", 3, "LECTURE"),
        ("Distributed Systems", "CS703", 3, "LECTURE"),
        ("Professional Practice", "CS704", 2, "LECTURE"),
        ("Elective - I", "CS751", 3, "LECTURE"),
        ("Final Year Project - II", "CS799", 3, "LECTURE"),
    ],
    # Semester 8
    [
        ("Cloud Computing", "CS801", 3, "LECTURE"),
        ("Cyber Security", "CS802", 3, "LECTURE"),
        ("Elective - II", "CS851", 3, "LECTURE"),
        ("Elective - III", "CS852", 3, "LECTURE"),
        ("Internship Report", "CS898", 3, "LECTURE"),
        ("Entrepreneurship", "CS899", 2, "LECTURE"),
    ],
]

# Sample PEOs for BSCS
SAMPLE_PEOS = [
    {
        "title": "PEO-1",
        "description": "Apply computing knowledge to solve real-world problems",
        "order_number": 1,
        "kpi_threshold": 60,
    },
    {
        "title": "PEO-2",
        "description": "Demonstrate professional skills and ethical behavior",
        "order_number": 2,
        "kpi_threshold": 60,
    },
    {
        "title": "PEO-3",
        "description": "Pursue lifelong learning and professional growth",
        "order_number": 3,
        "kpi_threshold": 60,
    },
]

# Sample GAs for BSCS
SAMPLE_GAS = [
    {
        "title": "Mathematical & Algorithmic Foundations",
        "description": "Apply mathematical foundations, algorithmic principles, and computer science theory in modeling and design",
        "order_number": 1,
        "kpi_threshold": 60,
    },
    {
        "title": "System Design & Implementation",
        "description": "Design, implement, and evaluate computing-based solutions to meet requirements",
        "order_number": 2,
        "kpi_threshold": 60,
    },
    {
        "title": "Communication Skills",
        "description": "Communicate effectively in a variety of professional contexts",
        "order_number": 3,
        "kpi_threshold": 60,
    },
    {
        "title": "Professional Responsibilities",
        "description": "Recognize professional responsibilities and make informed judgments in computing practice",
        "order_number": 4,
        "kpi_threshold": 60,
    },
    {
        "title": "Teamwork & Leadership",
        "description": "Function effectively as a member or leader of a team",
        "order_number": 5,
        "kpi_threshold": 60,
    },
    {
        "title": "Continuous Learning",
        "description": "Apply knowledge to solve complex problems and engage in continuous learning",
        "order_number": 6,
        "kpi_threshold": 60,
    },
]


class Command(BaseCommand):
    help = "Complete curriculum setup: courses per semester, CLOs, GAs, PEOs and mappings"

    def handle(self, *args, **options):
        # Get BSCS program first
        bscs_program = Program.objects.filter(code="BSCS").first()
        if not bscs_program:
            self.stdout.write(self.style.ERROR("BSCS program not found!"))
            return

        self.stdout.write(self.style.NOTICE(f"=== Setting up BSCS Program ==="))

        # 1. Create or get a user (for created_by)
        admin_user = User.objects.filter(is_superuser=True).first()
        if not admin_user:
            self.stdout.write(self.style.WARNING("No admin user found, creating one..."))
            admin_user = User.objects.create_superuser(
                email="admin@eduobe.edu", full_name="Admin User", password="admin123"
            )

        # 2. Create Semesters for 1-8
        self.stdout.write(self.style.NOTICE("\n--- Creating Semesters ---"))
        semesters = {}
        for sem_no in range(1, 9):
            sem, created = Semester.objects.get_or_create(
                program=bscs_program,
                number=sem_no,
                defaults={
                    "name": f"Semester {sem_no}",
                    "is_active": True,
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created {sem.name}"))
            semesters[sem_no] = sem

        # 3. Create sample courses for each semester if not exist
        self.stdout.write(self.style.NOTICE("\n--- Creating Sample Courses ---"))
        created_courses = []
        for sem_no, courses in enumerate(SAMPLE_COURSES, 1):
            for name, code, credits, course_type in courses:
                course, created = Course.objects.get_or_create(
                    code=code,
                    program=bscs_program,
                    defaults={
                        "name": name,
                        "credit_hours": credits,
                        "semester": semesters[sem_no],
                        "course_type": course_type,
                        "is_active": True,
                    },
                )
                if created:
                    self.stdout.write(self.style.SUCCESS(f"Created course: {code} - {name}"))
                else:
                    self.stdout.write(f"Course exists: {code} - {name}")
                created_courses.append((sem_no, course))

        # 3. Create Curriculum Version if not exists
        self.stdout.write(self.style.NOTICE("\n--- Setting up Curriculum Version ---"))
        cv, cv_created = CurriculumVersion.objects.get_or_create(
            program=bscs_program,
            version_no="v1.0",
            defaults={
                "created_by": admin_user,
                "status": "draft",
            },
        )
        if cv_created:
            self.stdout.write(self.style.SUCCESS("Created curriculum version v1.0"))
        else:
            self.stdout.write("Curriculum version v1.0 already exists")

        # 4. Assign courses to semester in curriculum version
        self.stdout.write(self.style.NOTICE("\n--- Assigning Courses to Semesters ---"))
        for sem_no, course in created_courses:
            cvc, cvc_created = CurriculumVersionCourse.objects.get_or_create(
                version=cv,
                course=course,
                semester_no=sem_no,
                defaults={"is_active": True},
            )
            if cvc_created:
                self.stdout.write(f"Assigned {course.code} to Semester {sem_no}")

        # 5. Create PEOs
        self.stdout.write(self.style.NOTICE("\n--- Creating PEOs ---"))
        peos = []
        for peo_data in SAMPLE_PEOS:
            peo, created = PEO.objects.get_or_create(
                program=bscs_program,
                order_number=peo_data["order_number"],
                defaults={
                    "title": peo_data["title"],
                    "description": peo_data["description"],
                    "kpi_threshold": peo_data["kpi_threshold"],
                    "is_active": True,
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created {peo.title}"))
            else:
                self.stdout.write(f"PEO {peo.title} already exists")
            peos.append(peo)

        # 6. Create GAs
        self.stdout.write(self.style.NOTICE("\n--- Creating GAs ---"))
        gas = []
        for ga_data in SAMPLE_GAS:
            ga, created = GA.objects.get_or_create(
                program=bscs_program,
                order_number=ga_data["order_number"],
                defaults={
                    "title": ga_data["title"],
                    "description": ga_data["description"],
                    "kpi_threshold": ga_data["kpi_threshold"],
                    "is_active": True,
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created {ga.title}"))
            else:
                # Update existing GA
                ga.title = ga_data["title"]
                ga.description = ga_data["description"]
                ga.kpi_threshold = ga_data["kpi_threshold"]
                ga.save(skip_exit_survey=True)
                self.stdout.write(f"Updated {ga.title}")
            gas.append(ga)

        # 7. Create CourseSession records for active batches and their current semesters (skipped for now due to DB column issue)
        # self.stdout.write(self.style.NOTICE("\n--- Creating CourseSessions ---"))
        # active_batches = Batch.objects.filter(is_active=True, program=bscs_program)
        # for batch in active_batches:
        #     sem_no = batch.current_semester
        #     if sem_no not in semesters:
        #         continue
        #     sem = semesters[sem_no]
        #     # Get all courses for this semester
        #     semester_courses = [c for (s, c) in created_courses if s == sem_no]
        #     for course in semester_courses:
        #         cs, created = CourseSession.objects.get_or_create(
        #             course=course,
        #             batch=batch,
        #             semester=sem,
        #             defaults={
        #                 "is_active": True,
        #                 "assessment_status": "ASSESSMENT_DONE",
        #             },
        #         )
        #         if created:
        #             self.stdout.write(self.style.SUCCESS(f"Created CourseSession for {course} in {batch}"))

        # 7. Create GA-PEO mappings (each GA mapped to all PEOs)
        self.stdout.write(self.style.NOTICE("\n--- Creating GA-PEO Mappings ---"))
        for ga in gas:
            for peo in peos:
                gap, gap_created = GAPEOMapping.objects.get_or_create(
                    ga=ga, peo=peo, defaults={"is_active": True}
                )
                if gap_created:
                    self.stdout.write(f"Mapped {ga.title} ↔ {peo.title}")

        # 8. Create CLOs for each course and CLO-GA mappings
        self.stdout.write(self.style.NOTICE("\n--- Creating CLOs and CLO-GA Mappings ---"))
        for sem_no, course in created_courses:
            # Create 3 CLOs per course
            for clo_num in range(1, 4):
                clo, clo_created = CLO.objects.get_or_create(
                    course=course,
                    curriculum_version=cv,
                    order_number=clo_num,
                    defaults={
                        "title": f"CLO-{clo_num}: Understand {course.name}",
                        "description": f"Students will understand and apply concepts from {course.name}",
                        "bloom_level": f"K{min(clo_num+1,6)}",
                        "kpi_target": 60,
                        "is_active": True,
                    },
                )
                if clo_created:
                    self.stdout.write(
                        self.style.SUCCESS(f"Created {clo.title} for {course.code}")
                    )

                # Map each CLO to 2 random GAs
                for ga in gas[:2]:
                    clom, clom_created = CLOGAMapping.objects.get_or_create(
                        clo=clo,
                        ga=ga,
                        defaults={"weight": 1.0, "is_active": True},
                    )
                    if clom_created:
                        self.stdout.write(f"Mapped {clo.title} ↔ {ga.title}")

        # 9. Assign curriculum version to all active batches
        self.stdout.write(
            self.style.NOTICE("\n--- Assigning Curriculum to Active Batches ---")
        )
        active_batches = Batch.objects.filter(is_active=True, program=bscs_program)
        for batch in active_batches:
            if not batch.curriculum_version:
                batch.curriculum_version = cv
                batch.save()
                self.stdout.write(
                    self.style.SUCCESS(f"Assigned curriculum to {batch.name}")
                )

        self.stdout.write(self.style.SUCCESS("\n✅ Complete curriculum setup done!"))

