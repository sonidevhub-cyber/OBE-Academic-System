from decimal import Decimal
from .models import (
    CLOGAMapping,
    CourseSession,
    CourseGAScore,
    GACQIRecord,
    GA,
    CLO
)
from django.db import transaction
from assessments.models import Assessment, Question, StudentQuestionMark
from students.models import Student


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
    total_weight = Decimal('0.00')

    for mapping in mappings:
        # Calculate real CLO attainment
        clo = mapping.clo
        
        # Get Assessments and Questions for this course, batch, semester
        assessments = Assessment.objects.filter(
            course=course_session.course,
            batch=course_session.batch,
            semester=course_session.semester,
            is_finalized=True
        )
        questions = Question.objects.filter(clo=clo, assessment__in=assessments)
        
        total_marks = sum(q.marks for q in questions)
        if total_marks == 0:
            continue
            
        students = Student.objects.filter(user__batch=course_session.batch)
        total_obtained = Decimal('0')
        student_marks = StudentQuestionMark.objects.filter(question__in=questions)
        total_obtained = sum(sm.marks_obtained for sm in student_marks)
        total_possible = total_marks * students.count()
        
        if total_possible > 0:
            clo_attainment = (total_obtained / total_possible) * 100
        else:
            clo_attainment = Decimal('0')
            
        total_score += Decimal(clo_attainment) * mapping.weight
        total_weight += mapping.weight

    if total_weight > 0:
        final_score = round(total_score / total_weight, 2)
    else:
        final_score = Decimal('0')

    # Create or update CourseGAScore
    course_ga_score, created = CourseGAScore.objects.update_or_create(
        course_session=course_session,
        ga=ga,
        defaults={
            'score': final_score,
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
    Calculate Program-End Final GA Attainment.
    """
    # Get all course sessions for this batch
    course_sessions = CourseSession.objects.filter(batch=batch, is_active=True, assessment_status='ASSESSMENT_DONE')
    
    total_score = Decimal('0')
    count = 0
    
    for cs in course_sessions:
        score_obj = CourseGAScore.objects.filter(course_session=cs, ga=ga, is_stale=False).first()
        if score_obj:
            total_score += score_obj.score
            count += 1
    
    if count > 0:
        return round(total_score / count, 2)
    else:
        return Decimal('0')
