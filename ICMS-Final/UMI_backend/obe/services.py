from decimal import Decimal
from .models import (
    CLOGAMapping,
    CourseSession,
    CourseGAScore,
    GACQIRecord,
    GA,
    CLO,
    StudentCLOScore
)
from django.db import transaction
from assessments.models import Assessment, Question, StudentQuestionMark
from students.models import Student
from core.models import Batch, Semester


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
            
        students = Student.objects.filter(batch=course_session.batch)
        enrolled_students_count = students.count()
        total_obtained = Decimal('0')
        student_marks = StudentQuestionMark.objects.filter(question__in=questions)
        total_obtained = sum(sm.marks_obtained for sm in student_marks)
        total_possible = total_marks * enrolled_students_count
        
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

    # Calculate enrolled students count
    enrolled_students = Student.objects.filter(batch=course_session.batch).count()

    # Create or update CourseGAScore
    course_ga_score, created = CourseGAScore.objects.update_or_create(
        course_session=course_session,
        ga=ga,
        defaults={
            'score': final_score,
            'enrolled_students': enrolled_students,
            'is_stale': False
        }
    )

    return course_ga_score


def calculate_all_course_ga_scores(course_session: CourseSession):
    """
    Calculate and save all CourseGAScores and StudentCLOScores for a course session.
    """
    with transaction.atomic():
        # Get all active GAs for the program
        gas = GA.objects.filter(
            program=course_session.course.program,
            is_active=True
        )

        scores = []
        for ga in gas:
            score = calculate_course_ga_score(course_session, ga)
            if score:
                scores.append(score)

        # Now calculate StudentCLOScores
        students = Student.objects.filter(batch=course_session.batch)
        # Get all CLOs for this course
        clos = CLO.objects.filter(
            course=course_session.course,
            is_active=True
        )
        # Get all assessments for this course session
        assessments = Assessment.objects.filter(
            course=course_session.course,
            batch=course_session.batch,
            semester=course_session.semester,
            is_finalized=True
        )
        
        for student in students:
            for clo in clos:
                questions = Question.objects.filter(
                    clo=clo,
                    assessment__in=assessments
                )
                total_marks = sum(q.marks for q in questions)
                if total_marks == 0:
                    continue
                    
                student_marks = StudentQuestionMark.objects.filter(
                    student=student,
                    question__in=questions
                )
                total_obtained = sum(sm.marks_obtained for sm in student_marks)
                attainment = (total_obtained / total_marks) * 100
                
                StudentCLOScore.objects.update_or_create(
                    student=student,
                    clo=clo,
                    course_session=course_session,
                    defaults={
                        'attainment': round(attainment, 2)
                    }
                )

        return scores


def calculate_ga_attainment_semester_cohort(batch: Batch, semester: Semester, ga: GA):
    """
    Calculate semester-wise cohort GA attainment: weighted average of course scores 
    using both credit hours and enrolled students (double weighted average)
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
    ).select_related('course_session', 'course_session__course')

    if not course_scores.exists():
        return None

    total_weighted_score = Decimal('0')
    total_student_credits = Decimal('0')

    for cs in course_scores:
        course = cs.course_session.course
        credits = Decimal(str(course.credit_hours))
        enrolled = Decimal(str(cs.enrolled_students))
        total_weighted_score += cs.score * credits * enrolled
        total_student_credits += credits * enrolled

    if total_student_credits == 0:
        return Decimal('0')

    return round(total_weighted_score / total_student_credits, 2)


def calculate_ga_attainment_cumulative_cohort(batch: Batch, ga: GA):
    """
    Calculate cumulative cohort GA attainment: all semesters using both 
    credit hours and enrolled students (double weighted average)
    """
    course_sessions = CourseSession.objects.filter(
        batch=batch,
        is_active=True,
        assessment_status='ASSESSMENT_DONE'
    )

    course_scores = CourseGAScore.objects.filter(
        course_session__in=course_sessions,
        ga=ga,
    ).select_related('course_session', 'course_session__course')

    if not course_scores.exists():
        return None

    total_weighted_score = Decimal('0')
    total_student_credits = Decimal('0')

    for cs in course_scores:
        course = cs.course_session.course
        credits = Decimal(str(course.credit_hours))
        enrolled = Decimal(str(cs.enrolled_students))
        total_weighted_score += cs.score * credits * enrolled
        total_student_credits += credits * enrolled

    if total_student_credits == 0:
        return Decimal('0')

    return round(total_weighted_score / total_student_credits, 2)


def calculate_ga_attainment_semester_student(student: Student, semester: Semester, ga: GA):
    """
    Calculate semester-wise student GA attainment: weighted sum of their CLO scores
    """
    # Get all course sessions for this student in this semester
    course_sessions = CourseSession.objects.filter(
        batch=student.batch,
        semester=semester,
        is_active=True,
        assessment_status='ASSESSMENT_DONE'
    )

    total_attainment = Decimal('0')
    total_weight = Decimal('0')

    for session in course_sessions:
        # Get CLO-GA mappings for this course
        mappings = CLOGAMapping.objects.filter(
            clo__course=session.course,
            ga=ga,
            is_active=True,
            clo__is_active=True
        )

        for mapping in mappings:
            # Get student's score on this CLO
            student_clo_score = StudentCLOScore.objects.filter(
                student=student,
                clo=mapping.clo,
                course_session=session
            ).first()

            if student_clo_score:
                total_attainment += student_clo_score.attainment * mapping.weight
                total_weight += mapping.weight

    if total_weight == 0:
        return Decimal('0')

    return round(total_attainment / total_weight, 2)


def calculate_ga_attainment_cumulative_student(student: Student, ga: GA):
    """
    Calculate cumulative student GA attainment: all semesters
    """
    ga_code = f'GA-{ga.order_number}'
    print("=== calculate_ga_attainment_cumulative_student called for student:", student.name, "ga:", ga_code)
    print("student.batch:", student.batch)
    course_sessions = CourseSession.objects.filter(
        batch=student.batch,
        is_active=True,
        assessment_status='ASSESSMENT_DONE'
    )
    print("course_sessions count:", course_sessions.count())
    print("course_sessions:", [f"{cs.course.code} - {cs.assessment_status}" for cs in course_sessions])

    total_attainment = Decimal('0')
    total_weight = Decimal('0')

    for session in course_sessions:
        mappings = CLOGAMapping.objects.filter(
            clo__course=session.course,
            ga=ga,
            is_active=True,
            clo__is_active=True
        )
        print(f"\nsession: {session.course.code}, mappings count: {mappings.count()}")
        print("mappings details:", [{"clo": (m.clo.code if hasattr(m.clo, 'code') else f"CLO-{m.clo.order_number}"), "weight": m.weight} for m in mappings])

        for mapping in mappings:
            # Check if clo has code field first
            clo_code = None
            if hasattr(mapping.clo, 'code'):
                clo_code = mapping.clo.code
            elif hasattr(mapping.clo, 'order_number'):
                clo_code = f"CLO-{mapping.clo.order_number}"
                
            student_clo_score = StudentCLOScore.objects.filter(
                student=student,
                clo=mapping.clo,
                course_session=session
            ).first()
            print(f"  mapping: {clo_code}, weight: {mapping.weight}")
            print(f"  student_clo_score found: {student_clo_score}")
            if student_clo_score:
                print(f"    attainment: {student_clo_score.attainment}")
                contribution = student_clo_score.attainment * mapping.weight
                print(f"    contribution to total: {contribution}")
                total_attainment += contribution
                total_weight += mapping.weight
                print(f"    current total_attainment: {total_attainment}, total_weight: {total_weight}")

    if total_weight == 0:
        print("total_weight 0, returning 0")
        return Decimal('0')

    result = round(total_attainment / total_weight, 2)
    print("returning result:", result)
    return result


def check_and_trigger_ga_cqi(batch: Batch, ga: GA, cqi_level: str, semester: int = None):
    """
    Check if GA attainment is below threshold and create GACQIRecord if needed
    NOTE: ONLY triggers for CUMULATIVE (Program End) — SEMESTER is early warning only!
    """
    # Only trigger for CUMULATIVE, never for SEMESTER
    if cqi_level != 'CUMULATIVE':
        return None

    attainment = calculate_ga_attainment_cumulative_cohort(batch, ga)

    if attainment is None:
        return None

    # Check if already has a non-fully-approved CQI (any cqi_level, since only CUMULATIVE now)
    existing_cqi = GACQIRecord.objects.filter(
        ga=ga,
        batch=batch,
        status__in=['PENDING', 'SENT_BACK']
    ).exists()

    if existing_cqi:
        return None

    # Check if below threshold
    if attainment < ga.kpi_threshold:
        cqi = GACQIRecord.objects.create(
            ga=ga,
            batch=batch,
            cqi_level=cqi_level,
            semester=None,
            attainment_value=attainment,
            kpi_threshold_at_trigger=ga.kpi_threshold,
            status='PENDING'
        )
        return cqi
    return None


def get_teacher_ga_context(course_id: str):
    """
    Get GA context and interim alerts for a teacher's course
    """
    from core.models import Course
    try:
        course = Course.objects.get(id=course_id)
    except Course.DoesNotExist:
        return {'error': 'Course not found'}

    # Get all GAs mapped to this course
    course_gas = set()
    course_clo_mappings = CLOGAMapping.objects.filter(
        clo__course=course,
        is_active=True
    ).select_related('ga')

    for mapping in course_clo_mappings:
        course_gas.add(mapping.ga)

    # Get previous course sessions (same batch)
    # First get all course sessions for this course
    course_sessions = CourseSession.objects.filter(
        course=course
    ).select_related('batch')

    # Group by batch
    batch_sessions = {}
    for session in course_sessions:
        if session.batch not in batch_sessions:
            batch_sessions[session.batch] = []
        batch_sessions[session.batch].append(session)

    # Now for each GA, get previous courses
    interim_alerts = []
    for ga in course_gas:
        ga_data = {
            'ga_code': f'GA-{ga.order_number}',
            'ga_title': ga.title,
            'previous_courses': []
        }

        for batch in batch_sessions:
            # Get all course sessions for this batch, previous semesters
            current_session = batch_sessions[batch][-1] if batch_sessions[batch] else None
            if not current_session or not current_session.semester:
                continue

            previous_sessions = CourseSession.objects.filter(
                batch=batch,
                semester__number__lt=current_session.semester.number,
                assessment_status='ASSESSMENT_DONE'
            ).select_related('course', 'semester')

            # For each previous session, check if it maps to this GA
            for prev_session in previous_sessions:
                has_mapping = CLOGAMapping.objects.filter(
                    clo__course=prev_session.course,
                    ga=ga,
                    is_active=True
                ).exists()

                if has_mapping:
                    # Get course GA score
                    course_ga_score = CourseGAScore.objects.filter(
                        course_session=prev_session,
                        ga=ga
                    ).first()

                    if course_ga_score:
                        status = 'ACHIEVED' if course_ga_score.score >= ga.kpi_threshold else 'BELOW_TARGET'
                        ga_data['previous_courses'].append({
                            'course_code': prev_session.course.code,
                            'semester': prev_session.semester.number if prev_session.semester else None,
                            'ga_score': float(course_ga_score.score),
                            'status': status
                        })

        interim_alerts.append(ga_data)

    return {
        'course_gas': [f'GA-{ga.order_number}' for ga in course_gas],
        'interim_alerts': interim_alerts
    }
