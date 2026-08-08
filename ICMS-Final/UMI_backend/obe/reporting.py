from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.db.models import Count, Max, Q

from core.models import Batch
from retake.models import CourseRetake

from .models import (
    CourseGAScore,
    CourseSession,
    GA,
    GAMasterCache,
    GAReport,
    StudentCLOScore,
)


@dataclass(frozen=True)
class GAAuditRow:
    course_session_id: str
    course_code: str
    semester_number: int | None
    ga_id: str
    ga_code: str
    course_ga_score: Decimal | None
    is_locked: bool | None
    is_active: bool
    is_stale: bool | None
    has_assessment_data: bool
    included_in_average: bool
    assessment_status: str | None
    active_student_clo_score_count: int
    active_retake_student_count: int
    latest_retake_attempt_number: int | None
    latest_retake_status: str | None
    source_score_id: str | None


def get_batch_ga_sessions(
    batch: Batch,
    *,
    upto_semester: int | None = None,
    require_assessment_done: bool = False,
):
    from .services import get_effective_course_sessions

    sessions = get_effective_course_sessions(
        batch,
        upto_semester=upto_semester,
        require_assessment_done=require_assessment_done,
    )
    return sessions


def get_valid_batch_course_ga_scores(
    batch: Batch,
    *,
    ga_ids=None,
    upto_semester: int | None = None,
    require_assessment_done: bool = True,
):
    sessions = get_batch_ga_sessions(
        batch,
        upto_semester=upto_semester,
        require_assessment_done=require_assessment_done,
    )
    session_ids = [session.id for session in sessions]
    queryset = CourseGAScore.objects.filter(
        course_session_id__in=session_ids,
        is_active=True,
        is_stale=False,
        course_session__is_active=True,
        course_session__batch__is_active=True,
        course_session__course__is_active=True,
    ).filter(
        Q(course_session__semester__isnull=True)
        | Q(course_session__semester__is_active=True)
    )
    if ga_ids is not None:
        queryset = queryset.filter(ga_id__in=ga_ids)
    return queryset.select_related(
        'course_session',
        'course_session__course',
        'course_session__semester',
        'ga',
    )


def get_valid_course_ga_scores(
    batch: Batch,
    ga: GA,
    *,
    upto_semester: int | None = None,
    require_assessment_done: bool = True,
):
    return get_valid_batch_course_ga_scores(
        batch,
        ga_ids=[ga.id],
        upto_semester=upto_semester,
        require_assessment_done=require_assessment_done,
    )


def ga_report_has_stale_contributors(
    batch: Batch,
    ga: GA,
    *,
    upto_semester: int | None = None,
    require_assessment_done: bool = True,
):
    sessions = get_batch_ga_sessions(
        batch,
        upto_semester=upto_semester,
        require_assessment_done=require_assessment_done,
    )
    session_ids = [session.id for session in sessions]
    return CourseGAScore.objects.filter(
        course_session_id__in=session_ids,
        ga=ga,
        is_active=True,
        is_stale=True,
    ).exists()


def invalidate_ga_reports_for_batch(batch: Batch, *, ga: GA | None = None):
    queryset = GAReport.objects.filter(batch=batch)
    if ga is not None:
        queryset = queryset.filter(ga=ga)

    queryset.update(needs_recalculation=True, is_locked=False)
    GAMasterCache.objects.filter(batch=batch).update(needs_recalculation=True)


def invalidate_ga_reports_for_course_session(course_session: CourseSession):
    invalidate_ga_reports_for_batch(
        course_session.batch,
        ga=None,
    )


def invalidate_cached_scores_for_course_session(course_session: CourseSession):
    CourseGAScore.objects.filter(course_session=course_session).update(
        is_stale=True,
        is_active=False,
    )
    StudentCLOScore.objects.filter(course_session=course_session).update(
        is_active=False,
    )


def build_ga_audit_rows(
    batch: Batch,
    ga: GA,
    *,
    upto_semester: int | None = None,
    require_assessment_done: bool = True,
):
    sessions = get_batch_ga_sessions(
        batch,
        upto_semester=upto_semester,
        require_assessment_done=False,
    )
    session_ids = [session.id for session in sessions]
    scores = CourseGAScore.objects.filter(
        course_session_id__in=session_ids,
        ga=ga,
        course_session__is_active=True,
        course_session__batch__is_active=True,
        course_session__course__is_active=True,
    ).select_related('course_session', 'course_session__course', 'course_session__semester', 'ga')
    score_by_session_id = {score.course_session_id: score for score in scores}

    retake_rows = (
        CourseRetake.objects.filter(
            current_batch=batch,
            failed_course_id__in=[session.course_id for session in sessions],
            is_active=True,
        )
        .values('failed_course_id')
        .annotate(
            latest_attempt=Max('attempt_number'),
            active_retake_student_count=Count('student_id', distinct=True),
        )
    )
    retake_meta_by_course = {
        row['failed_course_id']: row for row in retake_rows
    }
    active_student_clo_counts = {
        row['course_session_id']: row['count']
        for row in (
            StudentCLOScore.objects.filter(
                course_session_id__in=session_ids,
                is_active=True,
            )
            .values('course_session_id')
            .annotate(count=Count('id'))
        )
    }

    rows: list[GAAuditRow] = []
    for session in sessions:
        score = score_by_session_id.get(session.id)
        retake_meta = retake_meta_by_course.get(session.course_id, {})
        has_assessment_data = bool(
            score
            and score.is_active
            and not score.is_stale
            and session.assessment_status == 'ASSESSMENT_DONE'
        )
        rows.append(
            GAAuditRow(
                course_session_id=str(session.id),
                course_code=session.course.code,
                semester_number=session.semester.number if session.semester else None,
                ga_id=str(ga.id),
                ga_code=f'GA-{ga.order_number}',
                course_ga_score=score.score if score else None,
                is_locked=score.locked if score else None,
                is_active=session.is_active,
                is_stale=score.is_stale if score else None,
                has_assessment_data=has_assessment_data,
                included_in_average=has_assessment_data,
                assessment_status=session.assessment_status,
                active_student_clo_score_count=active_student_clo_counts.get(session.id, 0),
                active_retake_student_count=retake_meta.get('active_retake_student_count', 0),
                latest_retake_attempt_number=retake_meta.get('latest_attempt'),
                latest_retake_status=(
                    CourseRetake.objects.filter(
                        current_batch=batch,
                        failed_course_id=session.course_id,
                        is_active=True,
                    )
                    .order_by('-attempt_number')
                    .values_list('status', flat=True)
                    .first()
                ),
                source_score_id=str(score.id) if score else None,
            )
        )

    return rows
