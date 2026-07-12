from __future__ import annotations

from django.db import transaction

from assessments.services.clo_service import CLOService
from core.models import Semester
from obe.models import CourseSession, GAReport
from obe.services import calculate_all_course_ga_scores, calculate_ga_report
from clo_master.signals import append_course_to_clo_master

from .models import CourseRetake


def recalculate_reports_for_retake_queryset(retake_queryset, semester_id=None):
    """
    Rebuild CLO and GA report data for all unique active retake course sessions
    represented by the given queryset.
    """
    retake_pairs = (
        retake_queryset.filter(is_active=True)
        .values("current_batch_id", "failed_course_id")
        .distinct()
    )

    processed = []

    for pair in retake_pairs:
        retake = (
            CourseRetake.objects.filter(
                is_active=True,
                current_batch_id=pair["current_batch_id"],
                failed_course_id=pair["failed_course_id"],
            )
            .select_related("failed_course", "current_batch", "student")
            .order_by("-attempt_number")
            .first()
        )
        if not retake:
            continue

        course_session = None
        if semester_id:
            course_session = CourseSession.objects.filter(
                course=retake.failed_course,
                batch=retake.current_batch,
                semester_id=semester_id,
            ).first()
        else:
            semester = Semester.objects.filter(
                program=retake.current_batch.program,
                number=retake.current_batch.current_semester,
            ).first()
            if semester:
                course_session = CourseSession.objects.filter(
                    course=retake.failed_course,
                    batch=retake.current_batch,
                    semester=semester,
                ).first()
        if not course_session and not semester_id:
            course_session = CourseSession.objects.filter(
                course=retake.failed_course,
                batch=retake.current_batch,
            ).order_by("-created_at").first()
        if not course_session:
            continue

        with transaction.atomic():
            CLOService.generate_student_report(
                course_id=retake.failed_course.id,
                batch_id=retake.current_batch.id,
                semester_id=course_session.semester_id if course_session.semester else None,
                course_retake=retake,
            )

            course_session.assessment_status = "ASSESSMENT_DONE"
            course_session.assessment_done = True
            course_session.save()

            calculate_all_course_ga_scores(course_session)
            append_course_to_clo_master(None, course_session, False)

            GAReport.objects.filter(
                batch=retake.current_batch,
                ga__program=retake.current_batch.program,
            ).update(needs_recalculation=True, is_locked=False)
            calculate_ga_report(retake.current_batch)

        processed.append(retake)

    return processed
