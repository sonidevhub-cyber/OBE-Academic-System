

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from django.utils import timezone

from obe.models import CourseSession, StudentCLOScore
from curriculum.models import CurriculumVersion
from .models import SemesterCLOMasterCache, CourseCLOMasterEntry


@receiver(post_save, sender=CourseSession)
def append_course_to_clo_master(sender, instance, created, **kwargs):
    """
    Signal that updates clo master cache when a CourseSession's assessment status
    changes to ASSESSMENT_DONE (locked).
    """
    if instance.assessment_status != 'ASSESSMENT_DONE':
        return  # Only proceed if assessment is marked as done

    with transaction.atomic():
        program = instance.course.program
        batch = instance.batch
        semester = instance.semester
        course = instance.course

        if not program or not batch or not semester or not course:
            return

        # Get curriculum version from BATCH (batch.curriculum_version, not from curriculum.batch)
        curriculum = batch.curriculum_version

        # Get total courses expected in this semester for this program/curriculum
        expected_courses_count = 0
        valid_course_ids = []
        if curriculum:
            # Use version_courses (through CurriculumVersionCourse) which has semester_no
            semester_courses = curriculum.version_courses.filter(
                semester_no=semester.number if semester else None,
                is_active=True
            ).select_related('course')
            expected_courses_count = semester_courses.count()
            valid_course_ids = [cvc.course.id for cvc in semester_courses]

            # Check if this course is actually in the curriculum version's valid courses
            if course.id not in valid_course_ids:
                return  # Don't add this course if it's not in the curriculum for this semester
        # If no curriculum version, proceed without valid course check

        # Get or create master cache
        master_cache, cache_created = SemesterCLOMasterCache.objects.get_or_create(
            program=program,
            batch=batch,
            semester=semester,
            defaults={
                'total_courses_expected': expected_courses_count,
                'total_courses_finalized': 0
            }
        )

        # Update expected courses count if necessary
        if master_cache.total_courses_expected != expected_courses_count:
            master_cache.total_courses_expected = expected_courses_count

        # Get student CLO scores for this session
        student_clo_scores = StudentCLOScore.objects.filter(
            course_session=instance
        ).select_related('student', 'clo', 'clo__course')

        seen_entry_keys = set()
        for score in student_clo_scores:
            kpi = score.clo.kpi_target
            is_achieved = score.attainment >= kpi
            entry_key = (score.clo_id, score.student_id)
            seen_entry_keys.add(entry_key)

            CourseCLOMasterEntry.objects.update_or_create(
                master_cache=master_cache,
                course_session=instance,
                clo=score.clo,
                student=score.student,
                defaults={
                    'course': score.clo.course,
                    'clo_score': score.attainment,
                    'is_kpi_achieved': is_achieved,
                    'finalized_at': timezone.now(),
                    'is_active': True,
                }
            )

        # Mark stale rows for this session as inactive so the master keeps the
        # latest snapshot without leaving orphaned historical values visible.
        for existing_entry in CourseCLOMasterEntry.objects.filter(
            master_cache=master_cache,
            course_session=instance,
        ).select_related("clo", "student"):
            if (existing_entry.clo_id, existing_entry.student_id) not in seen_entry_keys:
                existing_entry.is_active = False
                existing_entry.save(update_fields=["is_active"])

        # Update master cache stats (only count valid courses)
        finalized_entries_query = CourseCLOMasterEntry.objects.filter(
            master_cache=master_cache,
            is_active=True
        )
        if valid_course_ids:
            finalized_entries_query = finalized_entries_query.filter(course__id__in=valid_course_ids)
        finalized_course_sessions = finalized_entries_query.values_list('course_session_id', flat=True).distinct()
        final_count = finalized_course_sessions.count()

        master_cache.total_courses_finalized = final_count
        master_cache.is_fully_compiled = (
            master_cache.total_courses_finalized >= master_cache.total_courses_expected
        )
        master_cache.save()
