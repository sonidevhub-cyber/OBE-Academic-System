from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from assessments.models import Assessment, INTERNAL_ASSESSMENT_TYPES
from assessments.services.clo_service import CLOService
from core.models import Batch, Semester
from obe.models import CourseGAScore, CourseSession
from obe.services import calculate_all_course_ga_scores


READ_ONLY_SEMESTER_STATUSES = {
    Semester.STATUS_RESULT_RECEIVED,
    Semester.STATUS_FINALIZED,
}


def get_course_session(course_id, batch, semester):
    return CourseSession.objects.filter(
        course_id=course_id,
        batch=batch,
        semester=semester,
        is_active=True,
    ).first()


def sync_course_session_workflow_from_assessments(course_session: CourseSession | None):
    if not course_session:
        return None

    final_exists = Assessment.objects.filter(
        course=course_session.course,
        batch=course_session.batch,
        semester=course_session.semester,
        assessment_type="final",
        is_finalized=True,
        course_retake__isnull=True,
    ).exists()

    if not final_exists:
        update_fields = []
        if course_session.final_submitted:
            course_session.final_submitted = False
            update_fields.append("final_submitted")
        if course_session.assessment_done:
            course_session.assessment_done = False
            update_fields.append("assessment_done")
        if course_session.assessment_status == "ASSESSMENT_DONE":
            course_session.assessment_status = "ONGOING"
            update_fields.append("assessment_status")
        if course_session.internal_complete_awaiting_final:
            course_session.internal_complete_awaiting_final = False
            update_fields.append("internal_complete_awaiting_final")
        if update_fields:
            course_session.save(update_fields=update_fields)
        return course_session

    update_fields = []
    if not course_session.final_submitted:
        course_session.final_submitted = True
        update_fields.append("final_submitted")
    if course_session.internal_complete_awaiting_final:
        course_session.internal_complete_awaiting_final = False
        update_fields.append("internal_complete_awaiting_final")
    if not course_session.assessment_done:
        course_session.assessment_done = True
        update_fields.append("assessment_done")
    if course_session.assessment_status != "ASSESSMENT_DONE":
        course_session.assessment_status = "ASSESSMENT_DONE"
        update_fields.append("assessment_status")

    if update_fields:
        course_session.save(update_fields=update_fields)

    return course_session


def derive_batch_semester_status(batch: Batch, semester: Semester) -> str:
    if semester.status == Semester.STATUS_FINALIZED:
        return Semester.STATUS_FINALIZED

    sessions = list(CourseSession.objects.filter(batch=batch, semester=semester, is_active=True))
    if not sessions:
        if semester.status == Semester.STATUS_FINALIZED:
            return Semester.STATUS_FINALIZED
        return Semester.STATUS_ONGOING

    sessions = [sync_course_session_workflow_from_assessments(session) for session in sessions]

    if any(not session.final_submitted for session in sessions):
        if all(session.internal_complete_awaiting_final for session in sessions):
            return Semester.STATUS_AWAITING_EXTERNAL_RESULT
        return Semester.STATUS_ONGOING

    return Semester.STATUS_RESULT_RECEIVED


def get_permitted_actions(status_value: str) -> dict:
    return {
        "can_allocate_courses": status_value == Semester.STATUS_ONGOING,
        "can_reassign_instructors": status_value in {
            Semester.STATUS_ONGOING,
            Semester.STATUS_AWAITING_EXTERNAL_RESULT,
        },
        "can_create_assessments": status_value == Semester.STATUS_ONGOING,
        "can_create_final_assessment": status_value in {
            Semester.STATUS_ONGOING,
            Semester.STATUS_AWAITING_EXTERNAL_RESULT,
        },
        "is_read_only": status_value in READ_ONLY_SEMESTER_STATUSES,
    }


def validate_semester_write_allowed(
    *,
    semester: Semester | None,
    batch: Batch | None,
    assessment_type: str | None = None,
    course_session: CourseSession | None = None,
):
    if not semester or not batch:
        return

    effective_status = derive_batch_semester_status(batch, semester)
    if effective_status in READ_ONLY_SEMESTER_STATUSES:
        raise ValidationError("This semester is read-only because results have been received or finalized.")

    normalized_type = (assessment_type or "").strip().lower()
    if effective_status == Semester.STATUS_AWAITING_EXTERNAL_RESULT and normalized_type != "final":
        raise ValidationError("This semester is awaiting external results. Only Final assessment entry is allowed.")

    if course_session and course_session.internals_locked and normalized_type != "final":
        raise ValidationError("Internals are locked for this course. Only the Final assessment can be submitted.")


def _run_course_report_calculation(course_session: CourseSession, report_status: str):
    CLOService.generate_student_report(
        course_id=course_session.course_id,
        batch_id=course_session.batch_id,
        semester_id=course_session.semester_id,
        assessment_types=None if report_status == "FINAL" else INTERNAL_ASSESSMENT_TYPES,
        report_status=report_status,
        lock_attainment=(report_status == "FINAL"),
    )
    scores = calculate_all_course_ga_scores(
        course_session,
        assessment_types=None if report_status == "FINAL" else INTERNAL_ASSESSMENT_TYPES,
        report_status=report_status,
    )
    if report_status == "FINAL":
        CourseGAScore.objects.filter(course_session=course_session).update(locked=True)
    return scores


def update_semester_status_from_sessions(batch: Batch, semester: Semester):
    status_value = derive_batch_semester_status(batch, semester)
    if semester.status != status_value:
        semester.status = status_value
        semester.save(update_fields=["status"])
    return status_value


@transaction.atomic
def lock_internal_assessments(course_session: CourseSession):
    if course_session.semester and course_session.batch:
        validate_semester_write_allowed(
            semester=course_session.semester,
            batch=course_session.batch,
            course_session=course_session,
            assessment_type="quiz",
        )

    internal_assessments = Assessment.objects.filter(
        course=course_session.course,
        batch=course_session.batch,
        semester=course_session.semester,
        assessment_type__in=INTERNAL_ASSESSMENT_TYPES,
        course_retake__isnull=True,
    )

    if not internal_assessments.exists():
        raise ValidationError("Create and submit at least one internal assessment before locking internals.")

    pending = internal_assessments.filter(is_finalized=False)
    if pending.exists():
        titles = ", ".join(pending.values_list("title", flat=True)[:5])
        raise ValidationError(f"All internal assessments must be submitted before locking. Pending: {titles}")

    internal_assessments.update(is_locked=True)
    course_session.internals_locked = True
    course_session.internal_complete_awaiting_final = True
    course_session.final_submitted = False
    course_session.locked_at = course_session.locked_at or timezone.now()

    _run_course_report_calculation(course_session, "PROVISIONAL")

    course_session.save(update_fields=[
        "internals_locked",
        "internal_complete_awaiting_final",
        "final_submitted",
        "locked_at",
        "assessment_done",
        "assessment_status",
    ])
    update_semester_status_from_sessions(course_session.batch, course_session.semester)

    from clo_master.signals import append_course_to_clo_master

    append_course_to_clo_master(None, course_session, False)
    return course_session


def mark_final_submitted_from_assessment(assessment: Assessment):
    if assessment.course_retake_id or assessment.assessment_type != "final" or not assessment.is_finalized:
        return None

    course_session = get_course_session(assessment.course_id, assessment.batch, assessment.semester)
    if not course_session:
        return None

    _run_course_report_calculation(course_session, "FINAL")
    course_session = sync_course_session_workflow_from_assessments(course_session)

    from clo_master.signals import append_course_to_clo_master

    append_course_to_clo_master(None, course_session, False)
    update_semester_status_from_sessions(assessment.batch, assessment.semester)
    return course_session
