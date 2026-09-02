"""
Test that retake assessment creation preserves all same-type assessments.

Verifies the fix for the bug where multiple assessments of the same type
(e.g. Quiz 1, Quiz 2, Quiz 3) were collapsed into a single retake assessment
because the existing-check filtered by assessment_type alone.
"""
import os
import sys
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "System", "Backend"))
django.setup()

import uuid
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.db import transaction

from core.models import Department, Program, Course, Batch, Semester
from students.models import Student
from assessments.models import Assessment, Question
from obe.models import CLO
from obe.models import CourseSession
from retake.models import CourseRetake, RetakeAssessmentSnapshot
from retake.signals import (
    _build_snapshot_data,
    _create_retake_assessments_from_snapshot,
)


User = get_user_model()


class RetakeAssessmentCreationTest(TestCase):
    """Test retake assessment creation with multiple same-type assessments."""

    def setUp(self):
        self.dept = Department.objects.create(
            name="Test Dept",
            code="TD",
            description="Test",
        )
        self.program = Program.objects.create(
            department=self.dept,
            name="Test Program",
            code="TP",
            total_semesters=8,
        )
        self.semester = Semester.objects.create(
            program=self.program,
            number=3,
            name="Semester 3",
            status="active",
        )
        self.course = Course.objects.create(
            program=self.program,
            semester=self.semester,
            name="Test Course",
            code="TC-301",
            course_type="theory",
            credit_hours=3,
        )
        self.batch = Batch.objects.create(
            program=self.program,
            name="Test Batch 2026",
            session_type="regular",
            start_year=2026,
            end_year=2030,
            current_semester=3,
            status="active",
        )
        self.instructor = User.objects.create_user(
            email="test_instructor@example.com",
            full_name="Test Instructor",
            password="testpass123",
            role="instructor",
        )
        self.student_user = User.objects.create_user(
            email="test_student@example.com",
            full_name="Test Student",
            password="testpass123",
            role="student",
            batch=self.batch,
        )
        self.student = Student.objects.create(
            user=self.student_user,
            name="Test Student",
            registration_number="TCS-001",
            batch=self.batch,
            department=self.dept,
        )

        self.course_session = CourseSession.objects.create(
            course=self.course,
            batch=self.batch,
            semester=self.semester,
            instructor=self.instructor,
            assessment_status="ASSESSMENT_DONE",
            assessment_done=True,
            is_active=True,
        )

        self.clo1 = CLO.objects.create(
            course=self.course,
            order_number=1,
            title="CLO-1",
            bloom_level="C3",
            kpi_target=60.0,
            is_active=True,
        )
        self.clo2 = CLO.objects.create(
            course=self.course,
            order_number=2,
            title="CLO-2",
            bloom_level="C4",
            kpi_target=60.0,
            is_active=True,
        )
        self.clo3 = CLO.objects.create(
            course=self.course,
            order_number=3,
            title="CLO-3",
            bloom_level="C5",
            kpi_target=60.0,
            is_active=True,
        )

    def _create_original_assessments(self):
        """Create a course with multiple same-type assessments."""
        quiz1 = Assessment.objects.create(
            course=self.course,
            batch=self.batch,
            semester=self.semester,
            instructor=self.instructor,
            title="Quiz 1",
            assessment_type="quiz",
            total_marks=Decimal("10"),
            weightage=Decimal("5"),
            assessment_date="2025-03-01",
            is_finalized=True,
            is_locked=True,
        )
        Question.objects.create(
            assessment=quiz1,
            clo=self.clo1,
            marks=Decimal("10"),
            description="Q1",
            bloom_level="C3",
        )

        quiz2 = Assessment.objects.create(
            course=self.course,
            batch=self.batch,
            semester=self.semester,
            instructor=self.instructor,
            title="Quiz 2",
            assessment_type="quiz",
            total_marks=Decimal("10"),
            weightage=Decimal("5"),
            assessment_date="2025-03-15",
            is_finalized=True,
            is_locked=True,
        )
        Question.objects.create(
            assessment=quiz2,
            clo=self.clo2,
            marks=Decimal("10"),
            description="Q2",
            bloom_level="C4",
        )

        quiz3 = Assessment.objects.create(
            course=self.course,
            batch=self.batch,
            semester=self.semester,
            instructor=self.instructor,
            title="Quiz 3",
            assessment_type="quiz",
            total_marks=Decimal("10"),
            weightage=Decimal("5"),
            assessment_date="2025-04-01",
            is_finalized=True,
            is_locked=True,
        )
        Question.objects.create(
            assessment=quiz3,
            clo=self.clo3,
            marks=Decimal("10"),
            description="Q3",
            bloom_level="C5",
        )

        presentation = Assessment.objects.create(
            course=self.course,
            batch=self.batch,
            semester=self.semester,
            instructor=self.instructor,
            title="Presentation",
            assessment_type="presentation",
            total_marks=Decimal("10"),
            weightage=Decimal("5"),
            assessment_date="2025-04-15",
            is_finalized=True,
            is_locked=True,
        )
        Question.objects.create(
            assessment=presentation,
            clo=self.clo1,
            marks=Decimal("10"),
            description="Pres Q",
            bloom_level="C6",
        )

        assignment1 = Assessment.objects.create(
            course=self.course,
            batch=self.batch,
            semester=self.semester,
            instructor=self.instructor,
            title="Assignment 1",
            assessment_type="assignment",
            total_marks=Decimal("10"),
            weightage=Decimal("5"),
            assessment_date="2025-04-20",
            is_finalized=True,
            is_locked=True,
        )
        Question.objects.create(
            assessment=assignment1,
            clo=self.clo2,
            marks=Decimal("10"),
            description="Assgn Q",
            bloom_level="C4",
        )

        midterm = Assessment.objects.create(
            course=self.course,
            batch=self.batch,
            semester=self.semester,
            instructor=self.instructor,
            title="Midterm",
            assessment_type="midterm",
            total_marks=Decimal("30"),
            weightage=Decimal("30"),
            assessment_date="2025-05-01",
            is_finalized=True,
            is_locked=True,
        )
        Question.objects.create(
            assessment=midterm,
            clo=self.clo1,
            marks=Decimal("15"),
            description="Mid Q1",
            bloom_level="C3",
        )
        Question.objects.create(
            assessment=midterm,
            clo=self.clo2,
            marks=Decimal("15"),
            description="Mid Q2",
            bloom_level="C4",
        )

        final = Assessment.objects.create(
            course=self.course,
            batch=self.batch,
            semester=self.semester,
            instructor=self.instructor,
            title="Final Exam",
            assessment_type="final",
            total_marks=Decimal("50"),
            weightage=Decimal("50"),
            assessment_date="2025-05-20",
            is_finalized=True,
            is_locked=True,
        )
        Question.objects.create(
            assessment=final,
            clo=self.clo1,
            marks=Decimal("25"),
            description="Final Q1",
            bloom_level="C5",
        )
        Question.objects.create(
            assessment=final,
            clo=self.clo2,
            marks=Decimal("15"),
            description="Final Q2",
            bloom_level="C4",
        )
        Question.objects.create(
            assessment=final,
            clo=self.clo3,
            marks=Decimal("10"),
            description="Final Q3",
            bloom_level="C6",
        )

        return [quiz1, quiz2, quiz3, presentation, assignment1, midterm, final]

    def test_retake_assessments_count_matches_original(self):
        """Retake must create exactly one assessment per original assessment."""
        original_assessments = self._create_original_assessments()
        expected_count = len(original_assessments)

        retake = CourseRetake.objects.create(
            student=self.student,
            failed_course=self.course,
            failed_batch=self.batch,
            current_batch=self.batch,
            attempt_number=1,
            status="ongoing",
            retake_teacher=self.instructor,
        )

        snapshot_data = _build_snapshot_data(retake)
        self.assertEqual(
            snapshot_data["total_assessments"],
            expected_count,
            f"Snapshot should contain {expected_count} assessments, got {snapshot_data['total_assessments']}",
        )

        _create_retake_assessments_from_snapshot(retake, snapshot_data)

        created_count = Assessment.objects.filter(course_retake=retake).count()
        self.assertEqual(
            created_count,
            expected_count,
            f"Expected {expected_count} retake assessments, but got {created_count}. "
            f"Bug: multiple same-type assessments were collapsed.",
        )

        created_types = list(
            Assessment.objects.filter(course_retake=retake)
            .order_by("assessment_type", "title")
            .values_list("assessment_type", "title")
        )
        print("Created retake assessments:")
        for atype, title in created_types:
            print(f"  {atype}: {title}")

        self.assertEqual(len(created_types), expected_count)

    def test_retake_preserves_quiz_sequence(self):
        """All three quizzes must be present with their distinct titles."""
        self._create_original_assessments()

        retake = CourseRetake.objects.create(
            student=self.student,
            failed_course=self.course,
            failed_batch=self.batch,
            current_batch=self.batch,
            attempt_number=1,
            status="ongoing",
            retake_teacher=self.instructor,
        )

        snapshot_data = _build_snapshot_data(retake)
        _create_retake_assessments_from_snapshot(retake, snapshot_data)

        quiz_titles = list(
            Assessment.objects.filter(
                course_retake=retake,
                assessment_type="quiz",
            )
            .order_by("title")
            .values_list("title", flat=True)
        )

        self.assertEqual(quiz_titles, ["Quiz 1", "Quiz 2", "Quiz 3"])

    def test_retake_preserves_clo_mapping_per_assessment(self):
        """Each retake assessment must have the same CLO mapping as the original."""
        original_assessments = self._create_original_assessments()

        retake = CourseRetake.objects.create(
            student=self.student,
            failed_course=self.course,
            failed_batch=self.batch,
            current_batch=self.batch,
            attempt_number=1,
            status="ongoing",
            retake_teacher=self.instructor,
        )

        snapshot_data = _build_snapshot_data(retake)
        _create_retake_assessments_from_snapshot(retake, snapshot_data)

        for original in original_assessments:
            original_clo_ids = set(
                original.questions.values_list("clo_id", flat=True)
            )
            retake_assessment = Assessment.objects.filter(
                course_retake=retake,
                assessment_type=original.assessment_type,
                title=original.title,
                total_marks=original.total_marks,
                weightage=original.weightage,
            ).first()
            self.assertIsNotNone(
                retake_assessment,
                f"Retake assessment not found for {original.assessment_type} '{original.title}'",
            )
            retake_clo_ids = set(
                retake_assessment.questions.values_list("clo_id", flat=True)
            )
            self.assertEqual(
                original_clo_ids,
                retake_clo_ids,
                f"CLO mapping mismatch for {original.title}: "
                f"original={original_clo_ids}, retake={retake_clo_ids}",
            )

    def test_retake_idempotent_on_re_save(self):
        """Re-running snapshot creation must not create duplicates."""
        self._create_original_assessments()

        retake = CourseRetake.objects.create(
            student=self.student,
            failed_course=self.course,
            failed_batch=self.batch,
            current_batch=self.batch,
            attempt_number=1,
            status="ongoing",
            retake_teacher=self.instructor,
        )

        snapshot_data = _build_snapshot_data(retake)
        _create_retake_assessments_from_snapshot(retake, snapshot_data)
        first_count = Assessment.objects.filter(course_retake=retake).count()

        _create_retake_assessments_from_snapshot(retake, snapshot_data)
        second_count = Assessment.objects.filter(course_retake=retake).count()

        self.assertEqual(
            first_count,
            second_count,
            f"Idempotency failed: first run created {first_count}, second run created {second_count}",
        )


if __name__ == "__main__":
    import unittest
    unittest.main()
