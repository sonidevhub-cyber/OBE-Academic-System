from decimal import Decimal
from .models import (
    CLOGAMapping,
    CourseSession,
    CourseGAScore,
    GACQIRecord,
    GA,
    CLO,
    StudentCLOScore,
    CourseFeedbackGAScore,
    ExitSurveyGAScore,
    ExitSurveyResponse,
    W_DIRECT,
    W_CF,
    W_EXIT
)
from django.db import transaction
from django.db.models import Avg, Count, Sum
from assessments.models import Assessment, Question, StudentQuestionMark
from students.models import Student
from core.models import Batch, Semester
from django.utils import timezone


def calculate_course_ga_score(course_session: CourseSession, ga: GA):
    """
    Calculate and save CourseGAScore for a specific GA in a course session.
    """
    # Get the batch's curriculum version if available
    target_curriculum_version = None
    if course_session.batch and course_session.batch.curriculum_version:
        target_curriculum_version = course_session.batch.curriculum_version

    # Get all active CLO-GA mappings for this course's curriculum
    # Filter CLOs by target curriculum version if available
    mappings = CLOGAMapping.objects.filter(
        clo__course=course_session.course,
        ga=ga,
        is_active=True,
        clo__is_active=True
    )
    if target_curriculum_version:
        mappings = mappings.filter(clo__curriculum_version=target_curriculum_version)

    if not mappings.exists():
        return None

    total_score = Decimal('0.00')
    total_weight = Decimal('0.00')

    # Get students via User model, which has the correct batch
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user_students = User.objects.filter(batch=course_session.batch, role='student')
    students = [Student.objects.get(user=user) for user in user_students if hasattr(user, 'student_profile')]
    enrolled_students_count = len(students)

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

    # Create or update CourseGAScore
    course_ga_score, created = CourseGAScore.objects.update_or_create(
        course_session=course_session,
        ga=ga,
        defaults={
            'score': final_score,
            'enrolled_students': enrolled_students_count,
            'is_stale': False
        }
    )

    return course_ga_score


def calculate_all_course_ga_scores(course_session: CourseSession):
    """
    Calculate and save all CourseGAScores and StudentCLOScores for a course session.
    """
    with transaction.atomic():
        # Get the batch's curriculum version if available
        target_curriculum_version = None
        if course_session.batch and course_session.batch.curriculum_version:
            target_curriculum_version = course_session.batch.curriculum_version

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
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user_students = User.objects.filter(batch=course_session.batch, role='student')
        students = [Student.objects.get(user=user) for user in user_students if hasattr(user, 'student_profile')]
        # Get all CLOs for this course, filtered by curriculum version if available
        clos = CLO.objects.filter(
            course=course_session.course,
            is_active=True
        )
        if target_curriculum_version:
            clos = clos.filter(curriculum_version=target_curriculum_version)
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
    allowed_course_ids = []
    if batch.curriculum_version:
        allowed_course_ids = batch.curriculum_version.version_courses.filter(
            is_active=True
        ).values_list('course_id', flat=True)
        
    cs_query = CourseSession.objects.filter(
        batch=batch,
        semester=semester,
        is_active=True,
        assessment_status='ASSESSMENT_DONE'
    )
    if allowed_course_ids:
        cs_query = cs_query.filter(course_id__in=allowed_course_ids)
    course_sessions = cs_query

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
    allowed_course_ids = []
    if batch.curriculum_version:
        allowed_course_ids = batch.curriculum_version.version_courses.filter(
            is_active=True
        ).values_list('course_id', flat=True)
        
    cs_query = CourseSession.objects.filter(
        batch=batch,
        is_active=True,
        assessment_status='ASSESSMENT_DONE'
    )
    if allowed_course_ids:
        cs_query = cs_query.filter(course_id__in=allowed_course_ids)
    course_sessions = cs_query

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
    batch = student.user.batch
    allowed_course_ids = []
    if batch.curriculum_version:
        allowed_course_ids = batch.curriculum_version.version_courses.filter(
            is_active=True
        ).values_list('course_id', flat=True)
        
    cs_query = CourseSession.objects.filter(
        batch=batch,
        semester=semester,
        is_active=True,
        assessment_status='ASSESSMENT_DONE'
    )
    if allowed_course_ids:
        cs_query = cs_query.filter(course_id__in=allowed_course_ids)
    course_sessions = cs_query

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
    print("student.user.batch:", student.user.batch)
    batch = student.user.batch
    allowed_course_ids = []
    if batch.curriculum_version:
        allowed_course_ids = batch.curriculum_version.version_courses.filter(
            is_active=True
        ).values_list('course_id', flat=True)
        
    cs_query = CourseSession.objects.filter(
        batch=batch,
        is_active=True,
        assessment_status='ASSESSMENT_DONE'
    )
    if allowed_course_ids:
        cs_query = cs_query.filter(course_id__in=allowed_course_ids)
    course_sessions = cs_query
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
    """
    if cqi_level == 'SEMESTER' and semester is None:
        return None

    if cqi_level == 'CUMULATIVE':
        attainment = calculate_ga_attainment_cumulative_cohort(batch, ga)
    else:
        # SEMESTER level
        from core.models import Semester
        sem_obj = Semester.objects.filter(program=batch.program, number=semester).first()
        if not sem_obj:
            return None
        attainment = calculate_ga_attainment_semester_cohort(batch, sem_obj, ga)

    if attainment is None:
        return None

    # Check if already has a non-fully-approved CQI for this (ga, batch, cqi_level, semester)
    existing_cqi = GACQIRecord.objects.filter(
        ga=ga,
        batch=batch,
        cqi_level=cqi_level,
        semester=semester if cqi_level == 'SEMESTER' else None,
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
            semester=semester if cqi_level == 'SEMESTER' else None,
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


def calculate_weighted_ga_score(ga, batch):
    """
    Calculate weighted GA score using Direct, Course Feedback, and Exit Survey components
    with proper weight redistribution when components are missing.
    """
    # Get Direct score
    direct_score = None
    allowed_course_ids = []
    if batch.curriculum_version:
        allowed_course_ids = batch.curriculum_version.version_courses.filter(
            is_active=True
        ).values_list('course_id', flat=True)
        
    cs_query = CourseSession.objects.filter(
        batch=batch,
        is_active=True,
        assessment_status='ASSESSMENT_DONE'
    )
    if allowed_course_ids:
        cs_query = cs_query.filter(course_id__in=allowed_course_ids)
    course_sessions = cs_query

    course_scores = CourseGAScore.objects.filter(
        course_session__in=course_sessions,
        ga=ga
    )
    if course_scores.exists():
        total_weighted_score = Decimal('0')
        total_student_credits = Decimal('0')
        for cs in course_scores:
            course = cs.course_session.course
            credits = Decimal(str(course.credit_hours))
            enrolled = Decimal(str(cs.enrolled_students))
            total_weighted_score += cs.score * credits * enrolled
            total_student_credits += credits * enrolled
        if total_student_credits > 0:
            direct_score = round(total_weighted_score / total_student_credits, 2)
    
    # Get Course Feedback score
    cf_score = None
    cf_coverage = None
    cf_scores = CourseFeedbackGAScore.objects.filter(
        ga=ga,
        batch=batch,
        is_active=True,
        score__isnull=False
    )
    if cf_scores.exists():
        # Average CF scores across courses
        total_cf = Decimal('0')
        total_cf_coverage = Decimal('0')
        count = 0
        for cf in cf_scores:
            total_cf += cf.score
            if cf.coverage_percent:
                total_cf_coverage += cf.coverage_percent
            count += 1
        cf_score = round(total_cf / count, 2)
        cf_coverage = round(total_cf_coverage / count, 2)
    
    # Get Exit Survey score
    exit_score = None
    exit_coverage = None
    exit_ga_score = ExitSurveyGAScore.objects.filter(
        ga=ga,
        batch=batch,
        is_active=True,
        score__isnull=False
    ).first()
    if exit_ga_score:
        exit_score = exit_ga_score.score
        exit_coverage = exit_ga_score.coverage_percent
    
    # Calculate indirect score: average of CF and Exit if available
    indirect_score = None
    if cf_score is not None and exit_score is not None:
        indirect_score = round((cf_score + exit_score) / 2, 2)
    elif cf_score is not None:
        indirect_score = round(cf_score, 2)
    elif exit_score is not None:
        indirect_score = round(exit_score, 2)
        
    # Determine available components and their weights
    available = []
    if direct_score is not None:
        available.append(('direct', direct_score, W_DIRECT))
    if cf_score is not None and (cf_coverage is None or cf_coverage > 0):
        available.append(('cf', cf_score, W_CF))
    if exit_score is not None and (exit_coverage is None or exit_coverage > 0):
        available.append(('exit', exit_score, W_EXIT))
    
    # Calculate formula applied label
    formula_applied = 'no_data'
    if len(available) == 3:
        formula_applied = 'full'
    elif len(available) == 2:
        if available[0][0] == 'direct' and available[1][0] == 'cf':
            formula_applied = 'direct_cf_only'
        else:
            formula_applied = 'partial'
    elif len(available) == 1:
        if available[0][0] == 'direct':
            formula_applied = 'direct_only'
        else:
            formula_applied = 'partial'
    
    # Redistribute weights
    final_score = None
    breakdown = {}
    if len(available) > 0:
        total_available_weight = sum(w for _, _, w in available)
        if total_available_weight > 0:
            total_score = Decimal('0')
            for key, score, weight in available:
                normalized_weight = weight / total_available_weight
                total_score += score * normalized_weight
                breakdown[key] = {
                    'score': float(score),
                    'weight_used': float(normalized_weight),
                    'original_weight': float(weight)
                }
            final_score = round(total_score, 2)
    
    # Calculate coverage percentages
    coverage = {
        'direct': None,
        'cf': float(cf_coverage) if cf_coverage is not None else None,
        'exit': float(exit_coverage) if exit_coverage is not None else None
    }
    # Calculate direct coverage (percentage of courses with ASSESSMENT_DONE)
    if course_sessions.exists():
        total_courses = course_sessions.count()
        courses_with_ga = course_scores.values('course_session').distinct().count()
        coverage['direct'] = round((courses_with_ga / total_courses) * 100, 2)
    
    return {
        'final_score': float(final_score) if final_score is not None else None,
        'direct_score': float(direct_score) if direct_score is not None else None,
        'indirect_score': float(indirect_score) if indirect_score is not None else None,
        'course_feedback_score': float(cf_score) if cf_score is not None else None,
        'course_feedback_coverage': float(cf_coverage) if cf_coverage is not None else None,
        'exit_survey_score': float(exit_score) if exit_score is not None else None,
        'exit_survey_coverage': float(exit_coverage) if exit_coverage is not None else None,
        'formula_applied': formula_applied,
        'breakdown': breakdown,
        'coverage': coverage
    }


def calculate_ga_report(batch):
    """
    Calculate GA report for all active GAs in the batch's program.
    """
    gas = GA.objects.filter(program=batch.program, is_active=True)
    report_rows = []
    for ga in gas:
        weighted_result = calculate_weighted_ga_score(ga, batch)
        report_rows.append({
            'ga_id': str(ga.id),
            'ga_code': f'GA-{ga.order_number}',
            'ga_title': ga.title,
            'final_score': weighted_result['final_score'],
            'direct_score': weighted_result['direct_score'],
            'indirect_score': weighted_result['indirect_score'],
            'course_feedback_score': weighted_result['course_feedback_score'],
            'course_feedback_coverage': weighted_result['course_feedback_coverage'],
            'exit_survey_score': weighted_result['exit_survey_score'],
            'exit_survey_coverage': weighted_result['exit_survey_coverage'],
            'formula_applied': weighted_result['formula_applied'],
            'breakdown': weighted_result['breakdown'],
            'coverage': weighted_result['coverage']
        })
    return report_rows


def calculate_semester_ga_report(batch: Batch, semester: Semester):
    """
    Calculate a detailed GA report for a specific semester.
    Mirrors the finalized GA report structure but limits the direct and
    contributing-course calculations to the selected semester.
    """
    from feedback.models import FeedbackResponse
    from feedback.views import get_batch_version_courses
    from .serializers import GACQIRecordSerializer

    allowed_courses, _ = get_batch_version_courses(batch, semester.number)
    allowed_course_ids = list(allowed_courses.values_list(
        'course_id' if batch.curriculum_version else 'id',
        flat=True
    )) if allowed_courses.exists() else []

    responses = FeedbackResponse.objects.filter(batch=batch, semester=semester)
    if allowed_course_ids:
        responses = responses.filter(course_id__in=allowed_course_ids)

    grouped_responses = responses.values('course', 'clo').annotate(
        total=Sum('rating'),
        count=Count('id')
    )

    semester_attainment = {}
    for row in grouped_responses:
        if row['count'] and row['count'] > 0:
            percent = (Decimal(str(row['total'])) / (Decimal(str(row['count'])) * Decimal('5'))) * Decimal('100')
            semester_attainment[(row['course'], row['clo'])] = round(percent, 2)

    gas = GA.objects.filter(program=batch.program, is_active=True)
    reports = []
    total_eligible_students = Student.objects.filter(batch=batch).count()
    target_curriculum_version = batch.curriculum_version

    course_sessions = CourseSession.objects.filter(
        batch=batch,
        semester=semester,
        is_active=True,
        assessment_status='ASSESSMENT_DONE',
    )
    if allowed_course_ids:
        course_sessions = course_sessions.filter(course_id__in=allowed_course_ids)

    for ga in gas:
        direct_score = calculate_ga_attainment_semester_cohort(batch, semester, ga)

        contributing_courses = []
        cf_scores = []
        cf_coverages = []

        for session in course_sessions.select_related('course', 'semester'):
            score_obj = CourseGAScore.objects.filter(course_session=session, ga=ga).first()
            if not score_obj:
                continue

            mappings = CLOGAMapping.objects.filter(
                clo__course=session.course,
                ga=ga,
                is_active=True,
                clo__is_active=True,
            ).select_related('clo')
            if target_curriculum_version:
                mappings = mappings.filter(clo__curriculum_version=target_curriculum_version)

            total_weighted_score = Decimal('0')
            total_weight = Decimal('0')
            for mapping in mappings:
                attainment = semester_attainment.get((session.course.id, mapping.clo.id))
                if attainment is not None:
                    total_weighted_score += Decimal(str(attainment)) * mapping.weight
                    total_weight += mapping.weight

            course_feedback_score = None
            course_feedback_coverage = None
            if total_weight > 0:
                course_feedback_score = round(total_weighted_score / total_weight, 2)
                respondent_count = responses.filter(course_id=session.course_id).values('student').distinct().count()
                course_feedback_coverage = round(
                    (Decimal(str(respondent_count)) / Decimal(str(total_eligible_students))) * Decimal('100'),
                    2
                ) if total_eligible_students > 0 else Decimal('0')
                cf_scores.append(course_feedback_score)
                cf_coverages.append(course_feedback_coverage)

            contributing_courses.append({
                'course_code': session.course.code,
                'course_name': session.course.name,
                'course_ga_score': float(score_obj.score),
                'course_feedback_score': float(course_feedback_score) if course_feedback_score is not None else None,
                'enrolled_students': score_obj.enrolled_students,
                'semester': session.semester.number if session.semester else None,
                'credits': session.course.credit_hours,
            })

        cf_score = round(sum(cf_scores) / len(cf_scores), 2) if cf_scores else None
        cf_coverage = round(sum(cf_coverages) / len(cf_coverages), 2) if cf_coverages else None

        # Exit survey is batch-level; reuse the latest batch score so the
        # previous semester report still shows the same indirect component.
        calculate_exit_survey_ga_score(ga, batch)
        exit_ga_score = ExitSurveyGAScore.objects.filter(
            ga=ga,
            batch=batch,
            is_active=True,
            score__isnull=False
        ).first()
        exit_score = exit_ga_score.score if exit_ga_score else None
        exit_coverage = exit_ga_score.coverage_percent if exit_ga_score else None

        indirect_score = None
        if cf_score is not None and exit_score is not None:
            indirect_score = round((Decimal(str(cf_score)) + Decimal(str(exit_score))) / 2, 2)
        elif cf_score is not None:
            indirect_score = round(Decimal(str(cf_score)), 2)
        elif exit_score is not None:
            indirect_score = round(Decimal(str(exit_score)), 2)

        available = []
        if direct_score is not None:
            available.append(('direct', Decimal(str(direct_score)), W_DIRECT))
        if cf_score is not None:
            available.append(('cf', Decimal(str(cf_score)), W_CF))
        if exit_score is not None:
            available.append(('exit', Decimal(str(exit_score)), W_EXIT))

        formula_applied = 'no_data'
        if len(available) == 3:
            formula_applied = 'full'
        elif len(available) == 2:
            if available[0][0] == 'direct' and available[1][0] == 'cf':
                formula_applied = 'direct_cf_only'
            else:
                formula_applied = 'partial'
        elif len(available) == 1:
            if available[0][0] == 'direct':
                formula_applied = 'direct_only'
            else:
                formula_applied = 'partial'

        final_score = None
        breakdown = {}
        if available:
            total_available_weight = sum(w for _, _, w in available)
            if total_available_weight > 0:
                total_score = Decimal('0')
                for key, score, weight in available:
                    normalized_weight = weight / total_available_weight
                    total_score += score * normalized_weight
                    breakdown[key] = {
                        'score': float(score),
                        'weight_used': float(normalized_weight),
                        'original_weight': float(weight)
                    }
                final_score = round(total_score, 2)

        coverage = {
            'direct': None,
            'cf': float(cf_coverage) if cf_coverage is not None else None,
            'exit': float(exit_coverage) if exit_coverage is not None else None,
        }
        if course_sessions.exists():
            total_courses = course_sessions.count()
            courses_with_ga = len(contributing_courses)
            coverage['direct'] = round((courses_with_ga / total_courses) * 100, 2) if total_courses > 0 else None

        ga_cqi_records = []
        semester_cqis = GACQIRecord.objects.filter(
            batch=batch,
            ga=ga,
            cqi_level='SEMESTER',
            semester=semester.number,
        )
        for cqi in semester_cqis:
            ga_cqi_records.append(GACQIRecordSerializer(cqi).data)

        status_str = 'NOT_ASSESSED' if final_score is None else ('ACHIEVED' if float(final_score) >= float(ga.kpi_threshold) else 'BELOW_TARGET')

        reports.append({
            'ga_id': str(ga.id),
            'ga_code': f'GA-{ga.order_number}',
            'ga_title': ga.title,
            'ga_attainment': float(final_score) if final_score is not None else None,
            'direct_score': float(direct_score) if direct_score is not None else None,
            'indirect_score': float(indirect_score) if indirect_score is not None else None,
            'course_feedback_score': float(cf_score) if cf_score is not None else None,
            'course_feedback_coverage': float(cf_coverage) if cf_coverage is not None else None,
            'exit_survey_score': float(exit_score) if exit_score is not None else None,
            'exit_survey_coverage': float(exit_coverage) if exit_coverage is not None else None,
            'ga_kpi_threshold': float(ga.kpi_threshold),
            'status': status_str,
            'formula_applied': formula_applied,
            'breakdown': breakdown,
            'coverage': coverage,
            'contributing_courses': contributing_courses,
            'ga_cqi_records': ga_cqi_records,
        })

    return reports


def calculate_exit_survey_ga_score(ga, batch):
    """
    Calculate and save ExitSurveyGAScore for a GA and batch.
    """
    responses = ExitSurveyResponse.objects.filter(
        question__ga=ga,
        student__batch=batch,
        question__is_active=True
    )
    if not responses.exists():
        return None
    
    avg_rating = responses.aggregate(avg=Avg('rating_value'))['avg']
    score = round((Decimal(str(avg_rating)) / 5) * 100, 2)
    
    from django.contrib.auth import get_user_model
    User = get_user_model()
    total_eligible = User.objects.filter(batch=batch, role='student', is_active=True).count()
    respondent_count = responses.values('student').distinct().count()
    coverage_percent = round((Decimal(str(respondent_count)) / Decimal(str(total_eligible))) * 100, 2) if total_eligible > 0 else Decimal('0')
    
    exit_score, created = ExitSurveyGAScore.objects.update_or_create(
        ga=ga,
        batch=batch,
        defaults={
            'score': score,
            'coverage_percent': coverage_percent,
            'respondent_count': respondent_count,
            'total_eligible': total_eligible,
            'calculated_at': timezone.now()
        }
    )
    return exit_score
