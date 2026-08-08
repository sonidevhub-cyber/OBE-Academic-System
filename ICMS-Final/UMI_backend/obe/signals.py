from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver
from django.db import transaction
from django.db import models
from django.utils import timezone
from decimal import Decimal

from assessments.models import Assessment, StudentQuestionMark
from .models import CourseSession, GAMasterCache, StudentGAEntry, CLOGAMapping, StudentCLOScore, GA
from students.models import Student
from .reporting import invalidate_cached_scores_for_course_session, invalidate_ga_reports_for_batch


def _invalidate_course_session_ga_cache(course_session: CourseSession):
    invalidate_cached_scores_for_course_session(course_session)
    invalidate_ga_reports_for_batch(course_session.batch)


@receiver(pre_save, sender=CourseSession)
def cache_previous_course_session_state(sender, instance, **kwargs):
    if not instance.pk:
        instance._previous_assessment_status = None
        instance._previous_allow_result_editing = None
        instance._previous_locked_at = None
        instance._previous_unlocked_by_id = None
        return

    previous = CourseSession.objects.filter(pk=instance.pk).values(
        "assessment_status",
        "allow_result_editing",
        "locked_at",
        "unlocked_by_id",
        "internals_locked",
        "internal_complete_awaiting_final",
        "final_submitted",
    ).first()
    instance._previous_assessment_status = previous["assessment_status"] if previous else None
    instance._previous_allow_result_editing = previous["allow_result_editing"] if previous else None
    instance._previous_locked_at = previous["locked_at"] if previous else None
    instance._previous_unlocked_by_id = previous["unlocked_by_id"] if previous else None
    instance._previous_internals_locked = previous["internals_locked"] if previous else None
    instance._previous_internal_complete_awaiting_final = previous["internal_complete_awaiting_final"] if previous else None
    instance._previous_final_submitted = previous["final_submitted"] if previous else None


@receiver(post_save, sender=CourseSession)
def invalidate_ga_cache_on_course_session_change(sender, instance, created, **kwargs):
    previous_status = getattr(instance, "_previous_assessment_status", None)
    previous_allow_result_editing = getattr(instance, "_previous_allow_result_editing", None)
    previous_locked_at = getattr(instance, "_previous_locked_at", None)
    previous_unlocked_by_id = getattr(instance, "_previous_unlocked_by_id", None)

    unlocked_or_edited = (
        previous_status == "ASSESSMENT_DONE"
        and (
            instance.assessment_status != "ASSESSMENT_DONE"
            or (previous_allow_result_editing is False and instance.allow_result_editing is True)
            or (previous_locked_at != instance.locked_at and previous_locked_at is not None)
            or (previous_unlocked_by_id != instance.unlocked_by_id and previous_unlocked_by_id is not None)
        )
    )

    if unlocked_or_edited:
        transaction.on_commit(lambda: _invalidate_course_session_ga_cache(instance))


@receiver(post_save, sender=CourseSession)
def update_semester_status_on_course_session_flags(sender, instance, created, **kwargs):
    if not instance.batch_id or not instance.semester_id:
        return

    changed = created or any([
        getattr(instance, "_previous_internals_locked", None) != instance.internals_locked,
        getattr(instance, "_previous_internal_complete_awaiting_final", None) != instance.internal_complete_awaiting_final,
        getattr(instance, "_previous_final_submitted", None) != instance.final_submitted,
    ])
    if not changed:
        return

    def _update():
        from assessments.workflows import update_semester_status_from_sessions
        update_semester_status_from_sessions(instance.batch, instance.semester)

    transaction.on_commit(_update)


@receiver(post_save, sender=CourseSession)
def update_ga_master_cache(sender, instance, created, **kwargs):
    """
    Signal that updates GA master cache when a CourseSession's assessment status
    changes to ASSESSMENT_DONE.
    """
    if instance.assessment_status != 'ASSESSMENT_DONE':
        return  # Only proceed if assessment is marked as done

    batch = instance.batch
    if not batch:
        return

    with transaction.atomic():
        # Get or create master cache
        master_cache, cache_created = GAMasterCache.objects.get_or_create(
            batch=batch,
            defaults={
                'total_courses_expected': 0,
                'total_courses_finalized': 0
            }
        )

        # First, calculate how many expected courses there are for batch's current semester
        # Only consider courses where semester number <= batch's current semester
        allowed_course_ids = []
        if batch.curriculum_version:
            allowed_course_ids = batch.curriculum_version.version_courses.filter(
                is_active=True
            ).values_list('course_id', flat=True)

        sessions_query = CourseSession.objects.filter(
            batch=batch,
            is_active=True,
            semester__number__lte=batch.current_semester,
        )
        if allowed_course_ids:
            sessions_query = sessions_query.filter(course_id__in=allowed_course_ids)
        master_cache.total_courses_expected = sessions_query.count()
        master_cache.save()

        # Delete all existing entries for this master cache to avoid unique constraint violations
        StudentGAEntry.objects.filter(master_cache=master_cache).delete()

        # Get all students or alumni in batch
        student_objs = Student.objects.filter(
            (models.Q(user__batch=batch) | models.Q(batch=batch)),
            user__role__in=['student', 'alumni'],
            user__is_active=True
        ).select_related('user')

        # Get all GAs for the program
        gas = GA.objects.filter(program=batch.program, is_active=True).order_by('order_number')

        # Get all finalized course sessions for this batch (for direct GA scores)
        cs_query = CourseSession.objects.filter(
            batch=batch,
            is_active=True,
            assessment_status='ASSESSMENT_DONE'
        )
        if allowed_course_ids:
            cs_query = cs_query.filter(course_id__in=allowed_course_ids)
        course_sessions = cs_query.select_related('course')
        session_ids = [cs.id for cs in course_sessions]

        # Get all mappings for these courses and GAs
        mappings = CLOGAMapping.objects.filter(
            clo__course__in=[cs.course_id for cs in course_sessions],
            ga__in=gas,
            is_active=True,
            clo__is_active=True
        ).select_related('clo', 'ga')

        # Group mappings by (course_id, ga_id)
        mappings_by_course_ga = {}
        for mapping in mappings:
            key = (mapping.clo.course_id, mapping.ga_id)
            if key not in mappings_by_course_ga:
                mappings_by_course_ga[key] = []
            mappings_by_course_ga[key].append(mapping)

        # Get all student CLO scores
        student_ids = [s.student_id for s in student_objs]
        student_clo_scores = StudentCLOScore.objects.filter(
            student_id__in=student_ids,
            course_session_id__in=session_ids,
            is_active=True,
        ).select_related('student', 'clo', 'course_session')

        # Group scores by (student_id, course_session_id, clo_id)
        scores_by_key = {}
        for score in student_clo_scores:
            key = (score.student_id, score.course_session_id, score.clo_id)
            scores_by_key[key] = score

        # Now compute GA for each student and each GA
        bulk_entries = []
        for student_obj in student_objs:
            for ga in gas:
                total_attainment = Decimal('0')
                total_weight = Decimal('0')

                for session in course_sessions:
                    key = (session.course_id, ga.id)
                    session_mappings = mappings_by_course_ga.get(key, [])

                    for mapping in session_mappings:
                        score_key = (student_obj.student_id, session.id, mapping.clo_id)
                        student_clo_score = scores_by_key.get(score_key)

                        if student_clo_score:
                            contribution = student_clo_score.attainment * mapping.weight
                            total_attainment += contribution
                            total_weight += mapping.weight

                if total_weight <= 0:
                    continue

                ga_attainment = round(total_attainment / total_weight, 2)
                is_kpi_achieved = float(ga_attainment) >= float(ga.kpi_threshold)

                bulk_entries.append(
                    StudentGAEntry(
                        master_cache=master_cache,
                        student=student_obj,
                        ga=ga,
                        ga_score=ga_attainment,
                        is_kpi_achieved=is_kpi_achieved
                    )
                )

        if bulk_entries:
            StudentGAEntry.objects.bulk_create(bulk_entries)

        # Update master cache's finalized courses count
        master_cache.total_courses_finalized = course_sessions.count()
        master_cache.is_fully_compiled = (
            master_cache.total_courses_finalized >= master_cache.total_courses_expected
        )
        master_cache.needs_recalculation = False
        master_cache.save()


@receiver(pre_save, sender=Assessment)
def cache_previous_assessment_state(sender, instance, **kwargs):
    if not instance.pk:
        instance._previous_is_finalized = None
        return

    instance._previous_is_finalized = (
        Assessment.objects.filter(pk=instance.pk)
        .values_list("is_finalized", flat=True)
        .first()
    )


@receiver(post_save, sender=Assessment)
def invalidate_ga_cache_on_assessment_change(sender, instance, created, **kwargs):
    previous_is_finalized = getattr(instance, "_previous_is_finalized", None)
    if previous_is_finalized is True and not instance.is_finalized:
        course_session = CourseSession.objects.filter(
            course=instance.course,
            batch=instance.batch,
            semester=instance.semester,
            is_active=True,
        ).first()
        if course_session is not None:
            transaction.on_commit(lambda: _invalidate_course_session_ga_cache(course_session))
        else:
            transaction.on_commit(lambda: invalidate_ga_reports_for_batch(instance.batch))


@receiver(post_save, sender=StudentQuestionMark)
def invalidate_ga_cache_on_mark_edit(sender, instance, **kwargs):
    assessment = instance.question.assessment
    if not assessment.is_finalized:
        return

    batch = assessment.batch
    if batch is None:
        return

    course_session = CourseSession.objects.filter(
        course=assessment.course,
        batch=assessment.batch,
        semester=assessment.semester,
        is_active=True,
    ).first()
    if course_session is not None:
        transaction.on_commit(lambda: _invalidate_course_session_ga_cache(course_session))
    else:
        transaction.on_commit(lambda: invalidate_ga_reports_for_batch(batch))


@receiver(post_delete, sender=StudentQuestionMark)
def invalidate_ga_cache_on_mark_delete(sender, instance, **kwargs):
    assessment = instance.question.assessment
    if not assessment.is_finalized or assessment.batch is None:
        return

    course_session = CourseSession.objects.filter(
        course=assessment.course,
        batch=assessment.batch,
        semester=assessment.semester,
        is_active=True,
    ).first()
    if course_session is not None:
        transaction.on_commit(lambda: _invalidate_course_session_ga_cache(course_session))
    else:
        transaction.on_commit(lambda: invalidate_ga_reports_for_batch(assessment.batch))
