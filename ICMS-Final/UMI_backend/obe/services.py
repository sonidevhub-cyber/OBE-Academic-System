from decimal import Decimal
from .models import (
    CLOGAMapping,
    CourseSession,
    CourseGAScore,
    GACQIRecord,
    GA
)
from django.db import transaction


def calculate_course_ga_score(course_session: CourseSession, ga: GA):
    """
    Calculate and save CourseGAScore for a specific GA in a course session.
    """
    # Get all active CLO-GA mappings for this course's curriculum
    mappings = CLOGAMapping.objects.filter(
        clo__course=course_session.course,
        ga=ga,
        is_active=True,
        clo__is_active=True
    )

    if not mappings.exists():
        return None

    total_score = Decimal('0.00')
    # Placeholder: In a real implementation, we'd get actual CLO attainment scores
    # For now, let's assume we have average CLO attainment
    for mapping in mappings:
        # Placeholder CLO attainment (replace with real data later)
        clo_attainment = Decimal('75.00')
        total_score += clo_attainment * mapping.weight

    total_score = round(total_score, 2)

    # Create or update CourseGAScore
    course_ga_score, created = CourseGAScore.objects.update_or_create(
        course_session=course_session,
        ga=ga,
        defaults={
            'score': total_score,
            'is_stale': False
        }
    )

    return course_ga_score


def calculate_all_course_ga_scores(course_session: CourseSession):
    """
    Calculate and save all CourseGAScores for a course session.
    """
    with transaction.atomic():
        # Get all active GAs for the program
        gqs = GA.objects.filter(
            program=course_session.course.program,
            is_active=True
        )

        scores = []
        for ga in gqs:
            score = calculate_course_ga_score(course_session, ga)
            if score:
                scores.append(score)

        return scores


def calculate_semester_ga_score(batch, semester, ga: GA):
    """
    Calculate Semester-End GA Score (early warning).
    """
    course_sessions = CourseSession.objects.filter(
        batch=batch,
        semester=semester,
        is_active=True,
        assessment_status='ASSESSMENT_DONE'
    )

    course_scores = CourseGAScore.objects.filter(
        course_session__in=course_sessions,
        ga=ga,
        is_stale=False
    )

    if not course_scores.exists():
        return None

    total_score = sum(cs.score for cs in course_scores)
    avg_score = round(total_score / len(course_scores), 2)

    return avg_score


def calculate_program_ga_attainment(batch, ga: GA):
    """
    Calculate Program-End Final GA Attainment (D_GA weighted by enrollment, then combined with I_GA).
    """
    # Placeholder: In real implementation, calculate D_GA and I_GA
    # For now, let's return a placeholder
    return Decimal('80.00')
