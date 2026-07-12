
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from django.db import models
from django.utils import timezone
from decimal import Decimal

from .models import CourseSession, GAMasterCache, StudentGAEntry, CLOGAMapping, StudentCLOScore, GA
from students.models import Student


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
            course_session_id__in=session_ids
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

                ga_attainment = Decimal('0')
                if total_weight > 0:
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
