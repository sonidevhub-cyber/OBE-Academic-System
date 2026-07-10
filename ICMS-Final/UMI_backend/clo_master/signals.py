
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

        # Get curriculum version from course
        curriculum = CurriculumVersion.objects.filter(
            program=program,
            batch=batch
        ).first()

        # Get total courses expected in this semester for this program/curriculum
        expected_courses_count = 0
        if curriculum:
            # Use version_courses (through CurriculumVersionCourse) which has semester_no
            semester_courses = curriculum.version_courses.filter(
                semester_no=semester.number if semester else None,
                is_active=True
            )
            expected_courses_count = semester_courses.count()

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

        if not cache_created and master_cache.total_courses_expected == 0:
            master_cache.total_courses_expected = expected_courses_count

        # Deactivate existing entries for this course session first
        CourseCLOMasterEntry.objects.filter(
            master_cache=master_cache,
            course_session=instance
        ).update(is_active=False)

        # Get student CLO scores for this session
        student_clo_scores = StudentCLOScore.objects.filter(
            course_session=instance
        ).select_related('student', 'clo', 'clo__course')

        bulk_entries = []
        for score in student_clo_scores:
            kpi = score.clo.kpi_target
            is_achieved = score.attainment >= kpi
            bulk_entries.append(
                CourseCLOMasterEntry(
                    master_cache=master_cache,
                    course_session=instance,
                    course=score.clo.course,
                    clo=score.clo,
                    student=score.student,
                    clo_score=score.attainment,
                    is_kpi_achieved=is_achieved,
                    finalized_at=timezone.now()
                )
            )

        # Bulk create new entries
        if bulk_entries:
            CourseCLOMasterEntry.objects.bulk_create(bulk_entries)

        # Update master cache stats
        finalized_course_sessions = CourseCLOMasterEntry.objects.filter(
            master_cache=master_cache,
            is_active=True
        ).values_list('course_session_id', flat=True).distinct()
        final_count = finalized_course_sessions.count()

        master_cache.total_courses_finalized = final_count
        master_cache.is_fully_compiled = (
            master_cache.total_courses_finalized >= master_cache.total_courses_expected
        )
        master_cache.save()
