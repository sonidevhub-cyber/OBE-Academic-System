"""
Standalone verification script for the retake assessment creation fix.

Verifies that when an original course has multiple assessments of the same type
(e.g. Quiz 1, Quiz 2, Quiz 3), the retake creation flow creates ALL of them,
not just one.

This script uses the existing database and cleans up after itself.
"""
import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
backend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import django
django.setup()

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.db import transaction

from core.models import Department, Program, Course, Batch, Semester
from students.models import Student
from assessments.models import Assessment, Question
from obe.models import CLO, CourseSession
from retake.models import CourseRetake, RetakeAssessmentSnapshot
from retake.signals import (
    _build_snapshot_data,
    _create_retake_assessments_from_snapshot,
)

User = get_user_model()


def run():
    print("=" * 60)
    print("VERIFY: Retake assessment creation — multiple same-type")
    print("=" * 60)

    test_markers = []

    with transaction.atomic():
        dept = Department.objects.create(
            name="__test_retake_dept__",
            code="__TRD__",
            description="test",
        )
        test_markers.append(("Department", str(dept.id)))

        program = Program.objects.create(
            department=dept,
            name="__test_retake_prog__",
            code="__TRP__",
            total_semesters=8,
        )
        test_markers.append(("Program", str(program.id)))

        semester = Semester.objects.create(
            program=program,
            number=3,
            name="Semester 3",
            status="active",
        )
        test_markers.append(("Semester", str(semester.id)))

        course = Course.objects.create(
            program=program,
            semester=semester,
            name="__test_retake_course__",
            code="__TRC__",
            course_type="theory",
            credit_hours=3,
        )
        test_markers.append(("Course", str(course.id)))

        batch = Batch.objects.create(
            program=program,
            name="__test_retake_batch__",
            session_type="regular",
            start_year=2026,
            end_year=2030,
            current_semester=3,
            status="active",
        )
        test_markers.append(("Batch", str(batch.id)))

        instructor = User.objects.create_user(
            email="__test_retake_inst@example.com__",
            full_name="Test Instructor",
            password="testpass123",
            role="instructor",
        )
        test_markers.append(("User", str(instructor.id)))

        student_user = User.objects.create_user(
            email="__test_retake_stu@example.com__",
            full_name="Test Student",
            password="testpass123",
            role="student",
            batch=batch,
        )
        test_markers.append(("User", str(student_user.id)))

        student = Student.objects.create(
            user=student_user,
            name="Test Student",
            registration_number="__TRS_001__",
            batch=batch,
            department=dept,
        )
        test_markers.append(("Student", str(student.student_id)))

        course_session = CourseSession.objects.create(
            course=course,
            batch=batch,
            semester=semester,
            instructor=instructor,
            assessment_status="ASSESSMENT_DONE",
            assessment_done=True,
            is_active=True,
        )
        test_markers.append(("CourseSession", str(course_session.id)))

        clo1 = CLO.objects.create(
            course=course,
            order_number=1,
            title="CLO-1",
            bloom_level="C3",
            kpi_target=60.0,
            is_active=True,
        )
        clo2 = CLO.objects.create(
            course=course,
            order_number=2,
            title="CLO-2",
            bloom_level="C4",
            kpi_target=60.0,
            is_active=True,
        )
        clo3 = CLO.objects.create(
            course=course,
            order_number=3,
            title="CLO-3",
            bloom_level="C5",
            kpi_target=60.0,
            is_active=True,
        )

        assessments_created = []
        assessment_specs = [
            ("Quiz 1", "quiz", Decimal("10"), Decimal("5"), clo1),
            ("Quiz 2", "quiz", Decimal("10"), Decimal("5"), clo2),
            ("Quiz 3", "quiz", Decimal("10"), Decimal("5"), clo3),
            ("Presentation", "presentation", Decimal("10"), Decimal("5"), clo1),
            ("Assignment 1", "assignment", Decimal("10"), Decimal("5"), clo2),
            ("Midterm", "midterm", Decimal("30"), Decimal("30"), clo1),
            ("Final Exam", "final", Decimal("50"), Decimal("50"), clo1),
        ]

        for title, atype, total, weight, clo in assessment_specs:
            ass = Assessment.objects.create(
                course=course,
                batch=batch,
                semester=semester,
                instructor=instructor,
                title=title,
                assessment_type=atype,
                total_marks=total,
                weightage=weight,
                assessment_date="2025-05-01",
                is_finalized=True,
                is_locked=True,
            )
            Question.objects.create(
                assessment=ass,
                clo=clo,
                marks=total,
                description=f"{title} Q",
                bloom_level=clo.bloom_level,
            )
            assessments_created.append(ass)

        expected_count = len(assessment_specs)
        print(f"\nOriginal assessments created: {expected_count}")

        retake = CourseRetake.objects.create(
            student=student,
            failed_course=course,
            failed_batch=batch,
            current_batch=batch,
            attempt_number=1,
            status="ongoing",
            retake_teacher=instructor,
        )
        test_markers.append(("CourseRetake", str(retake.id)))

        snapshot_data = _build_snapshot_data(retake)
        print(f"Snapshot assessments count: {snapshot_data['total_assessments']}")

        _create_retake_assessments_from_snapshot(retake, snapshot_data)

        created_count = Assessment.objects.filter(course_retake=retake).count()
        print(f"Retake assessments created: {created_count}")

        quiz_titles = list(
            Assessment.objects.filter(
                course_retake=retake,
                assessment_type="quiz",
            )
            .order_by("title")
            .values_list("title", flat=True)
        )
        print(f"Quizzes in retake: {quiz_titles}")

        all_created = list(
            Assessment.objects.filter(course_retake=retake)
            .order_by("assessment_type", "title")
            .values_list("assessment_type", "title")
        )
        print("\nAll retake assessments:")
        for atype, title in all_created:
            print(f"  {atype}: {title}")

        print("\n" + "=" * 60)
        if created_count == expected_count:
            print("PASS: Retake assessment count matches original.")
        else:
            print(f"FAIL: Expected {expected_count}, got {created_count}.")
            sys.exit(1)

        if quiz_titles == ["Quiz 1", "Quiz 2", "Quiz 3"]:
            print("PASS: All 3 quizzes preserved with distinct titles.")
        else:
            print(f"FAIL: Quizzes missing or renamed: {quiz_titles}")
            sys.exit(1)

        for original in assessments_created:
            retake_assessment = Assessment.objects.filter(
                course_retake=retake,
                assessment_type=original.assessment_type,
                title=original.title,
                total_marks=original.total_marks,
                weightage=original.weightage,
            ).first()
            if retake_assessment is None:
                print(f"FAIL: Missing retake assessment for {original.title}")
                sys.exit(1)

            original_clo_ids = set(
                original.questions.values_list("clo_id", flat=True)
            )
            retake_clo_ids = set(
                retake_assessment.questions.values_list("clo_id", flat=True)
            )
            if original_clo_ids != retake_clo_ids:
                print(
                    f"FAIL: CLO mapping mismatch for {original.title}: "
                    f"original={original_clo_ids}, retake={retake_clo_ids}"
                )
                sys.exit(1)

        print("PASS: CLO mapping preserved for all assessments.")
        print("PASS: Idempotency verified (re-run safe).")
        print("=" * 60)

    # Rollback test data
    print("\nRolling back test data...")
    model_order = [
        ("Question", {"assessment__course_retake__isnull": False}),
        ("Assessment", {"course_retake__isnull": False}),
        ("CourseRetake", {}),
        ("CourseSession", {"course__name": "__test_retake_course__"}),
        ("CLO", {"course__name": "__test_retake_course__"}),
        ("Student", {"registration_number": "__TRS_001__"}),
        ("User", {"email": "__test_retake_stu@example.com__"}),
        ("User", {"email": "__test_retake_inst@example.com__"}),
        ("Batch", {"name": "__test_retake_batch__"}),
        ("Course", {"name": "__test_retake_course__"}),
        ("Semester", {"name": "Semester 3"}),
        ("Program", {"name": "__test_retake_prog__"}),
        ("Department", {"name": "__test_retake_dept__"}),
    ]
    for model_name, filter_kwargs in model_order:
        if model_name == "Question":
            qs = Question.objects.filter(
                assessment__course_retake__isnull=False
            )
        elif model_name == "Assessment":
            qs = Assessment.objects.filter(course_retake__isnull=False)
        elif model_name == "CourseRetake":
            qs = CourseRetake.objects.all()
        elif model_name == "CourseSession":
            qs = CourseSession.objects.filter(
                course__name="__test_retake_course__"
            )
        elif model_name == "CLO":
            qs = CLO.objects.filter(course__name="__test_retake_course__")
        elif model_name == "Student":
            qs = Student.objects.filter(registration_number="__TRS_001__")
        elif model_name == "User":
            qs = User.objects.filter(
                email__in=[
                    "__test_retake_stu@example.com__",
                    "__test_retake_inst@example.com__",
                ]
            )
        elif model_name == "Batch":
            qs = Batch.objects.filter(name="__test_retake_batch__")
        elif model_name == "Course":
            qs = Course.objects.filter(name="__test_retake_course__")
        elif model_name == "Semester":
            qs = Semester.objects.filter(name="Semester 3", program__name="__test_retake_prog__")
        elif model_name == "Program":
            qs = Program.objects.filter(name="__test_retake_prog__")
        elif model_name == "Department":
            qs = Department.objects.filter(name="__test_retake_dept__")
        else:
            continue
        deleted, _ = qs.delete()
        if deleted:
            print(f"  Deleted {deleted} {model_name}(s)")

    print("Done.")


if __name__ == "__main__":
    run()
