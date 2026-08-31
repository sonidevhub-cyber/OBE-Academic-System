import uuid
from decimal import Decimal
from django.utils import timezone
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
    W_EXIT,
    PEO,
    GAPEOMapping,
    get_peo_indirect_score,
    get_flexible_peo_indirect_score,
    GAReport
)
from .reporting import (
    ga_report_has_stale_contributors,
    get_valid_course_ga_scores,
    invalidate_ga_reports_for_batch,
)
from django.db import transaction, models
from django.db.models import Avg, Count, Sum, Max, Q
from assessments.models import Assessment, Question, StudentQuestionMark
from students.models import Student
from core.models import Batch, Semester


def _get_effective_course_sessions_for_batch(batch: Batch, *, require_assessment_done: bool = False):
    """
    Return the latest effective session per course code for a batch.
    """
    return get_effective_course_sessions(
        batch,
        require_assessment_done=require_assessment_done,
    )


def _get_course_ga_score_queryset(batch: Batch, ga: GA):
    return get_valid_course_ga_scores(
        batch,
        ga,
        require_assessment_done=True,
    )


def get_students_for_batch(batch: Batch):
    """
    Return students that should count toward a batch report.

    Cohort reports are anchored to the batch where course-session assessment
    data was recorded, not the student's current/live batch. This preserves a
    frozen student's pre-rejoin work in the original cohort after their live
    batch changes. If no course-session scores exist yet, fall back to current
    membership so in-progress rosters still render before marks are entered.
    """
    scored_student_ids = StudentCLOScore.objects.filter(
        course_session__batch=batch,
        course_session__is_active=True,
        is_active=True,
    ).values_list('student_id', flat=True).distinct()

    if scored_student_ids.exists():
        return (
            Student.objects.filter(student_id__in=scored_student_ids, user__is_active=True)
            .select_related('user', 'batch', 'original_batch')
            .distinct()
        )

    return (
        Student.objects.filter(
            Q(user__batch=batch)
            | Q(batch=batch)
            | Q(original_batch=batch, is_frozen=True)
            | Q(retakes__current_batch=batch, retakes__is_active=True),
            user__is_active=True,
        )
        .select_related('user', 'batch', 'original_batch')
        .distinct()
    )


def get_effective_course_sessions(
    batch: Batch,
    *,
    semester: Semester | None = None,
    upto_semester: int | None = None,
    require_assessment_done: bool = False,
):
    """
    Return one effective course session per course code for a batch.

    Retake flows can leave multiple sessions around for the same course code.
    For reporting we want the latest effective session, even if it is still in
    progress, so the UI can show the current semester row with zero placeholders.
    When multiple rows exist for the same timestamp window, a finalized session
    wins over an unfinished one.
    """
    sessions = CourseSession.objects.filter(batch=batch, is_active=True)
    if semester is not None:
        sessions = sessions.filter(semester=semester)
    elif upto_semester is not None:
        sessions = sessions.filter(semester__number__lte=upto_semester)

    if require_assessment_done:
        sessions = sessions.filter(assessment_status='ASSESSMENT_DONE')

    sessions = sessions.select_related('course', 'semester').order_by(
        'course__code',
        'semester__number',
        'created_at',
        'id',
    )

    def _session_rank(session):
        return (
            session.semester.number if session.semester else 0,
            session.created_at,
            1 if session.assessment_status == 'ASSESSMENT_DONE' else 0,
            session.id,
        )

    effective_sessions = {}
    for session in sessions:
        course_code = (session.course.code or str(session.course_id)).strip().upper()
        current = effective_sessions.get(course_code)
        if current is None or _session_rank(session) >= _session_rank(current):
            effective_sessions[course_code] = session

    return list(effective_sessions.values())


def calculate_course_ga_score(course_session: CourseSession, ga: GA, assessment_types=None, report_status="FINAL"):
    """
    Calculate and save CourseGAScore for a specific GA in a course session.
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[calculate_course_ga_score] Starting for course_session={course_session.id}, course={course_session.course.code}, batch={course_session.batch.name}, ga=GA-{ga.order_number}")

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
        logger.debug(
            f"[calculate_course_ga_score] No CLO-GA mappings found for "
            f"course_session={course_session.id}, course={course_session.course.code}, ga=GA-{ga.order_number}; returning None"
        )
        return None

    total_score = Decimal('0.00')
    total_weight = Decimal('0.00')

    students = list(get_students_for_batch(course_session.batch))
    enrolled_students_count = len(students)
    logger.info(f"[calculate_course_ga_score] Found {enrolled_students_count} enrolled students")

    # Pre-fetch all active retakes for this course and either failed_batch OR current_batch
    from retake.models import CourseRetake
    student_retakes = {}
    retake_qs = CourseRetake.objects.filter(
        failed_course=course_session.course,
        is_active=True
    ).filter(
        Q(failed_batch=course_session.batch) | Q(current_batch=course_session.batch)
    ).select_related('student')
    logger.info(f"[calculate_course_ga_score] Found {retake_qs.count()} active retakes")
    for retake in retake_qs:
        if retake.student_id not in student_retakes:
            student_retakes[retake.student_id] = []
        student_retakes[retake.student_id].append(retake)
    
    # Get latest retake per student
    latest_retake_per_student = {}
    for student_id, retakes in student_retakes.items():
        latest_retake_per_student[student_id] = max(retakes, key=lambda r: r.attempt_number)
    
    # Get all active CLOs for the course, filtered by curriculum version if available
    from collections import defaultdict
    all_clos = CLO.objects.filter(course=course_session.course, is_active=True)
    if target_curriculum_version:
        all_clos = all_clos.filter(curriculum_version=target_curriculum_version)
    clos_by_order = defaultdict(list)
    for clo in all_clos:
        clos_by_order[clo.order_number].append(clo)

    for mapping in mappings:
        # Get clo order number!
        clo_order = mapping.clo.order_number
        
        # Now, find all clos with that order number!
        clo_list = clos_by_order.get(clo_order, [])
        
        # Find which CLO in this order number is linked to original questions!
        original_clo = None
        total_marks = 0
        original_questions = []
        for clo in clo_list:
            oqs = Question.objects.filter(
                clo=clo,
                assessment__course=course_session.course,
                assessment__batch=course_session.batch,
                assessment__semester=course_session.semester,
                assessment__is_finalized=True,
                assessment__course_retake__isnull=True
            )
            if assessment_types is not None:
                oqs = oqs.filter(assessment__assessment_type__in=assessment_types)
            if oqs.exists():
                original_clo = clo
                original_questions = oqs
                total_marks = sum(q.marks for q in original_questions)
                break
        
        retake_assessments = Assessment.objects.filter(
            course_retake__failed_course=course_session.course,
            course_retake__is_active=True,
            course_retake__current_batch=course_session.batch,
            is_finalized=True,
        )
        retake_questions = Question.objects.filter(clo__in=clo_list, assessment__in=retake_assessments)
        retake_total = sum(q.marks for q in retake_questions)

        if not original_clo or total_marks == 0:
            if retake_questions.exists() and retake_total > 0:
                original_clo = clo_list[0]
                total_marks = retake_total
            else:
                continue
            
        total_obtained = Decimal('0')
        contributor_count = 0
        
        # For each student, use retake marks if available
        for student in students:
            latest_retake = latest_retake_per_student.get(student.student_id)
            logger.debug(f"[calculate_course_ga_score] Processing student={student.student_id} has_latest_retake={bool(latest_retake)}")
            
            if latest_retake:
                logger.debug(f"[calculate_course_ga_score] retake_questions count={retake_questions.count()} for clo_list order={clo_order}")
                if retake_questions.exists():
                    # Use retake's marks
                    student_marks = StudentQuestionMark.objects.filter(
                        student=student,
                        question__in=retake_questions
                    )
                    logger.debug(f"[calculate_course_ga_score] student_marks count={student_marks.count()}")
                    if student_marks.exists():
                        contributor_count += 1
                    student_total = sum(sm.marks_obtained for sm in student_marks)
                    
                    # Scale to original total
                    if retake_total > 0:
                        student_total_scaled = (student_total / retake_total) * total_marks
                    else:
                        student_total_scaled = 0
                    logger.debug(f"[calculate_course_ga_score] Using retake marks: total={student_total}, retake_total={retake_total}, scaled={student_total_scaled}")
                else:
                    # Fallback to original
                    student_marks = StudentQuestionMark.objects.filter(
                        student=student,
                        question__in=original_questions,
                        course_retake__isnull=True
                    )
                    if student_marks.exists():
                        contributor_count += 1
                    student_total_scaled = sum(sm.marks_obtained for sm in student_marks)
                    logger.debug(f"[calculate_course_ga_score] Using original marks (no retake questions): total={student_total_scaled}")
            else:
                # No retake, use original
                student_marks = StudentQuestionMark.objects.filter(
                    student=student,
                    question__in=original_questions,
                    course_retake__isnull=True
                )
                if student_marks.exists():
                    contributor_count += 1
                student_total_scaled = sum(sm.marks_obtained for sm in student_marks)
                logger.debug(f"[calculate_course_ga_score] No retake, using original marks: total={student_total_scaled}")
                
            total_obtained += student_total_scaled
        
        total_possible = total_marks * contributor_count if contributor_count > 0 else Decimal('0')
        
        if total_possible > 0:
            clo_attainment = (total_obtained / total_possible) * 100
        else:
            clo_attainment = None
            
        if clo_attainment is not None:
            total_score += Decimal(clo_attainment) * mapping.weight
            total_weight += mapping.weight

    if total_weight > 0:
        final_score = round(total_score / total_weight, 2)
    else:
        final_score = None

    # Create or update CourseGAScore only when there is real assessment data.
    if final_score is None:
        CourseGAScore.objects.filter(course_session=course_session, ga=ga).update(
            is_active=False,
            is_stale=True,
        )
        return None

    course_ga_score, created = CourseGAScore.objects.update_or_create(
        course_session=course_session,
        ga=ga,
        defaults={
            'score': final_score,
            'enrolled_students': enrolled_students_count,
            'is_stale': False,
            'is_active': True,
            'report_status': report_status,
            'locked': report_status == "FINAL",
        }
    )

    return course_ga_score


def calculate_all_course_ga_scores(course_session: CourseSession, assessment_types=None, report_status="FINAL"):
    """
    Calculate and save all CourseGAScores and StudentCLOScores for a course session.
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[calculate_all_course_ga_scores] Starting for course_session={course_session.id}, course={course_session.course.code}")

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

        ga_ids = list(gas.values_list('id', flat=True))
        mapped_ga_ids = set(
            CLOGAMapping.objects.filter(
                clo__course=course_session.course,
                ga_id__in=ga_ids,
                is_active=True,
                clo__is_active=True,
            )
            .values_list('ga_id', flat=True)
            .distinct()
        )
        if target_curriculum_version:
            mapped_ga_ids = set(
                CLOGAMapping.objects.filter(
                    clo__course=course_session.course,
                    ga_id__in=ga_ids,
                    is_active=True,
                    clo__is_active=True,
                    clo__curriculum_version=target_curriculum_version,
                )
                .values_list('ga_id', flat=True)
                .distinct()
            )

        if not mapped_ga_ids:
            logger.warning(
                f"[calculate_all_course_ga_scores] No CLO-GA mappings found for "
                f"course_session={course_session.id}, course={course_session.course.code}; "
                f"skipping GA score recalculation"
            )

        scores = []
        for ga in gas.filter(id__in=mapped_ga_ids):
            logger.info(f"[calculate_all_course_ga_scores] Processing ga=GA-{ga.order_number}")
            score = calculate_course_ga_score(course_session, ga, assessment_types=assessment_types, report_status=report_status)
            if score:
                scores.append(score)
                logger.info(f"[calculate_all_course_ga_scores] Added ga score={score.score} for ga=GA-{ga.order_number}")

        # Now calculate StudentCLOScores
        students = list(get_students_for_batch(course_session.batch))
        logger.info(f"[calculate_all_course_ga_scores] Found {len(students)} students for StudentCLOScore calculation")

        # Get all active CLOs for this course, filtered by the batch's curriculum version
        all_clos = CLO.objects.filter(
            course=course_session.course,
            is_active=True
        )
        if course_session.batch and course_session.batch.curriculum_version:
            all_clos = all_clos.filter(
                curriculum_version=course_session.batch.curriculum_version
            )
        # Get all assessments for this course session
        assessments = Assessment.objects.filter(
            course=course_session.course,
            batch=course_session.batch,
            semester=course_session.semester,
            is_finalized=True
        )
        if assessment_types is not None:
            assessments = assessments.filter(assessment_type__in=assessment_types)
        logger.info(f"[calculate_all_course_ga_scores] Found {assessments.count()} finalized assessments")
        
        # Group all CLOs by order number
        from collections import defaultdict
        clos_by_order = defaultdict(list)
        for clo in all_clos:
            clos_by_order[clo.order_number].append(clo)
        
        # Pre-fetch retakes for all students in this batch/course!
        from retake.models import CourseRetake
        student_retakes = {}
        retake_qs = CourseRetake.objects.filter(
            failed_course=course_session.course,
            is_active=True
        ).filter(
            Q(failed_batch=course_session.batch) | Q(current_batch=course_session.batch)
        ).select_related('student')
        logger.info(f"[calculate_all_course_ga_scores] Found {retake_qs.count()} retakes for StudentCLOScore calculation")
        for retake in retake_qs:
            if retake.student_id not in student_retakes:
                student_retakes[retake.student_id] = []
            student_retakes[retake.student_id].append(retake)
        
        # Get latest retake per student
        latest_retake_per_student = {}
        for student_id, retakes in student_retakes.items():
            latest_retake_per_student[student_id] = max(retakes, key=lambda r: r.attempt_number)
        
        # For each order number, determine appropriate CLOs:
        for order_number, clo_list in clos_by_order.items():
            pass
        
        for student in students:
            # Get latest active retake for this student and course if exists
            latest_retake = latest_retake_per_student.get(student.student_id)
            
            for order_number, clo_list in clos_by_order.items():
                logger.debug(f"[calculate_all_course_ga_scores] Processing order_number={order_number}")
                # Step Find which CLO in this order number has original questions
                original_clo = None
                total_marks = 0
                for clo in clo_list:
                    original_questions = Question.objects.filter(
                        clo=clo,
                        assessment__in=assessments,
                        assessment__course_retake__isnull=True
                    )
                    if original_questions.exists():
                        original_clo = clo
                        total_marks = sum(q.marks for q in original_questions)
                        logger.debug(f"[calculate_all_course_ga_scores] Found original_clo={original_clo.id}, total_marks={total_marks}")
                        break
                
                if not original_clo or total_marks == 0:
                    if latest_retake:
                        retake_assessments = Assessment.objects.filter(
                            course_retake=latest_retake,
                            is_finalized=True
                        )
                        retake_questions = Question.objects.filter(clo__in=clo_list, assessment__in=retake_assessments)
                        retake_total = sum(q.marks for q in retake_questions)
                        if retake_questions.exists() and retake_total > 0:
                            original_clo = clo_list[0]
                            total_marks = retake_total
                        else:
                            logger.debug(f"[calculate_all_course_ga_scores] No original_clo found for order_number={order_number}, skipping")
                            continue
                    else:
                        logger.debug(f"[calculate_all_course_ga_scores] No original_clo found for order_number={order_number}, skipping")
                        continue
                
                # Calculate student's obtained marks
                if latest_retake:
                    logger.debug(f"[calculate_all_course_ga_scores] Student={student.student_id} has retake, checking retake questions")
                    # Check retake questions for this order number (any CLO in clo_list)
                    retake_assessments = Assessment.objects.filter(
                        course_retake=latest_retake,
                        is_finalized=True
                    )
                    logger.debug(f"[calculate_all_course_ga_scores] retake_assessments count={retake_assessments.count()}")
                    retake_questions = Question.objects.filter(clo__in=clo_list, assessment__in=retake_assessments)
                    logger.debug(f"[calculate_all_course_ga_scores] retake_questions count={retake_questions.count()}")
                    
                    if retake_questions.exists():
                        # Use retake's marks
                        student_marks = StudentQuestionMark.objects.filter(
                            student=student,
                            question__in=retake_questions
                        )
                        logger.debug(f"[calculate_all_course_ga_scores] student_marks count={student_marks.count()}")
                        has_student_data = student_marks.exists()
                        student_total = sum(sm.marks_obtained for sm in student_marks)
                        retake_total = sum(q.marks for q in retake_questions)
                        
                        if retake_total > 0:
                            attainment = (student_total / retake_total) * 100
                        else:
                            attainment = 0
                        logger.debug(f"[calculate_all_course_ga_scores] Using retake marks: student_total={student_total}, retake_total={retake_total}, attainment={attainment}")
                    else:
                        # Fallback to original marks
                        logger.debug(f"[calculate_all_course_ga_scores] No retake questions, falling back to original")
                        original_questions = Question.objects.filter(
                            clo=original_clo,
                            assessment__in=assessments,
                            assessment__course_retake__isnull=True
                        )
                        student_marks = StudentQuestionMark.objects.filter(
                            student=student,
                            question__in=original_questions,
                            course_retake__isnull=True
                        )
                        has_student_data = student_marks.exists()
                        total_obtained = sum(sm.marks_obtained for sm in student_marks)
                        attainment = (total_obtained / total_marks) * 100
                        logger.debug(f"[calculate_all_course_ga_scores] Using original marks: total_obtained={total_obtained}, attainment={attainment}")
                else:
                    # No retake, use original marks
                    logger.debug(f"[calculate_all_course_ga_scores] Student={student.student_id} no retake, using original marks")
                    original_questions = Question.objects.filter(
                        clo=original_clo,
                        assessment__in=assessments,
                        assessment__course_retake__isnull=True
                    )
                    student_marks = StudentQuestionMark.objects.filter(
                        student=student,
                        question__in=original_questions,
                        course_retake__isnull=True
                    )
                    has_student_data = student_marks.exists()
                    total_obtained = sum(sm.marks_obtained for sm in student_marks)
                    attainment = (total_obtained / total_marks) * 100
                    logger.debug(f"[calculate_all_course_ga_scores] Using original marks: total_obtained={total_obtained}, attainment={attainment}")

                if not has_student_data:
                    StudentCLOScore.objects.filter(
                        student=student,
                        clo=original_clo,
                        course_session=course_session,
                    ).update(is_active=False)
                    continue

                logger.info(f"[calculate_all_course_ga_scores] Creating StudentCLOScore for student={student.student_id}, clo={original_clo.id}, attainment={round(attainment, 2)}")
                StudentCLOScore.objects.update_or_create(
                    student=student,
                    clo=original_clo,
                    course_session=course_session,
                    defaults={
                        'attainment': round(attainment, 2),
                        'is_active': True,
                    }
                )

        # Any retake or mark edit that recalculates a course session should
        # invalidate locked GA reports for the same batch so the next GA view
        # can rebuild from the refreshed CourseGAScore rows.
        GAReport.objects.filter(
            ga__program=course_session.course.program,
            batch=course_session.batch,
            is_locked=True,
        ).update(is_locked=False)

        return scores


def calculate_ga_attainment_semester_cohort(batch: Batch, semester: Semester, ga: GA):
    """
    Calculate semester-wise cohort GA attainment: weighted average of course scores 
    using both credit hours and enrolled students (double weighted average)
    """
    course_sessions = _get_effective_course_sessions_for_batch(
        batch,
        require_assessment_done=True,
    )
    if batch.curriculum_version:
        allowed_course_ids = {
            str(course_id)
            for course_id in batch.curriculum_version.version_courses.filter(
                is_active=True
            ).values_list('course_id', flat=True)
        }
        course_sessions = [
            session for session in course_sessions
            if str(session.course_id) in allowed_course_ids
        ]

    course_scores = _get_course_ga_score_queryset(batch, ga).filter(
        course_session__semester=semester,
    )

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
        return None

    return round(total_weighted_score / total_student_credits, 2)


def calculate_ga_attainment_cumulative_cohort(batch: Batch, ga: GA):
    """
    Calculate cumulative cohort GA attainment: all semesters using both 
    credit hours and enrolled students (double weighted average)
    """
    course_scores = _get_course_ga_score_queryset(batch, ga)

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
        return None

    return round(total_weighted_score / total_student_credits, 2)


def calculate_ga_attainment_semester_student(student: Student, semester: Semester, ga: GA, batch: Batch | None = None):
    """
    Calculate semester-wise student GA attainment: weighted sum of their CLO scores
    """
    # Use the batch from the report context when provided.
    # This matters for retake students who may still belong to their original batch.
    batch = batch or getattr(student.user, 'batch', None) or getattr(student, 'batch', None)
    if batch is None:
        return None

    course_sessions = _get_effective_course_sessions_for_batch(
        batch,
        require_assessment_done=True,
    )
    if batch.curriculum_version:
        allowed_course_ids = {
            str(course_id)
            for course_id in batch.curriculum_version.version_courses.filter(
                is_active=True
            ).values_list('course_id', flat=True)
        }
        course_sessions = [
            session for session in course_sessions
            if str(session.course_id) in allowed_course_ids
        ]
    course_sessions = [session for session in course_sessions if session.semester_id == semester.id]

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
                course_session=session,
                is_active=True,
            ).first()

            if student_clo_score:
                total_attainment += student_clo_score.attainment * mapping.weight
                total_weight += mapping.weight

    if total_weight == 0:
        return None

    return round(total_attainment / total_weight, 2)


def calculate_ga_attainment_cumulative_student(student: Student, ga: GA, batch: Batch | None = None):
    """
    Calculate cumulative student GA attainment: all semesters
    """
    batch = batch or getattr(student.user, 'batch', None) or getattr(student, 'batch', None)
    if batch is None:
        return None

    course_sessions = _get_effective_course_sessions_for_batch(
        batch,
        require_assessment_done=True,
    )
    if batch.curriculum_version:
        allowed_course_ids = {
            str(course_id)
            for course_id in batch.curriculum_version.version_courses.filter(
                is_active=True
            ).values_list('course_id', flat=True)
        }
        course_sessions = [
            session for session in course_sessions
            if str(session.course_id) in allowed_course_ids
        ]
    course_sessions = [
        session for session in course_sessions
        if (
            session.semester_id
            and session.semester.number <= batch.current_semester
        )
    ]

    # Fetch all relevant mappings in one query and group by course session
    session_ids = [cs.id for cs in course_sessions]
    mappings = CLOGAMapping.objects.filter(
        clo__course__in=[cs.course_id for cs in course_sessions],
        ga=ga,
        is_active=True,
        clo__is_active=True
    ).select_related('clo')
    
    # Group mappings by course_id for quick lookup
    mappings_by_course = {}
    for mapping in mappings:
        course_id = mapping.clo.course_id
        if course_id not in mappings_by_course:
            mappings_by_course[course_id] = []
        mappings_by_course[course_id].append(mapping)
    
    # Fetch all student CLO scores in one query for these sessions and student
    student_clo_scores = StudentCLOScore.objects.filter(
        student=student,
        course_session_id__in=session_ids,
        is_active=True,
    ).select_related('clo', 'course_session')  # Pre-fetch related objects
    
    # Create a dictionary to look up scores quickly
    scores_by_key = {}
    for score in student_clo_scores:
        key = (score.course_session_id, score.clo_id)
        scores_by_key[key] = score

    total_attainment = Decimal('0')
    total_weight = Decimal('0')

    for session in course_sessions:
        session_mappings = mappings_by_course.get(session.course_id, [])
        
        for mapping in session_mappings:
            key = (session.id, mapping.clo_id)
            student_clo_score = scores_by_key.get(key)
            
            if student_clo_score:
                total_attainment += Decimal(str(student_clo_score.attainment)) * Decimal(str(mapping.weight))
                total_weight += Decimal(str(mapping.weight))

    if total_weight == 0:
        return None

    return round(total_attainment / total_weight, 2)


def check_and_trigger_ga_cqi(batch: Batch, ga: GA, cqi_level: str = 'CUMULATIVE', semester: int = None):
    """
    Check cumulative GA attainment and create or refresh a GA-CQI record if needed.
    """
    if cqi_level != 'CUMULATIVE':
        return None

    ga_result = calculate_weighted_ga_score(ga, batch, force_recalculate=True)
    attainment = ga_result['final_score']

    if attainment is None:
        return None

    cqi_filter = {
        'ga': ga,
        'batch': batch,
        'cqi_level': 'CUMULATIVE',
        'semester__isnull': True,
    }
    existing_cqi = GACQIRecord.objects.filter(**cqi_filter).order_by('-updated_at').first()
    if existing_cqi:
        updated = False
        if existing_cqi.attainment_value != attainment:
            existing_cqi.attainment_value = attainment
            updated = True
        if existing_cqi.kpi_threshold_at_trigger != ga.kpi_threshold:
            existing_cqi.kpi_threshold_at_trigger = ga.kpi_threshold
            updated = True
        if existing_cqi.status in {'NOT_TRIGGERED', 'PENDING_HOD_INPUT', 'PENDING'}:
            existing_cqi.status = 'OPEN'
            updated = True
        if updated:
            existing_cqi.save()
        return existing_cqi

    if attainment < ga.kpi_threshold:
        cqi = GACQIRecord.objects.create(
            ga=ga,
            batch=batch,
            cqi_level='CUMULATIVE',
            semester=None,
            attainment_value=attainment,
            kpi_threshold_at_trigger=ga.kpi_threshold,
            status='OPEN'
        )
        return cqi
    return None


def get_teacher_ga_context(course_id: str, batch_id: str = None):
    """
    Get GA context and interim alerts for a teacher's course
    """
    from core.models import Course, Batch, Semester
    try:
        course = Course.objects.get(id=course_id)
    except Course.DoesNotExist:
        return {'error': 'Course not found'}

    current_batch = None
    if batch_id:
        try:
            current_batch = Batch.objects.select_related('program', 'curriculum_version').get(id=batch_id)
        except Batch.DoesNotExist:
            return {'error': 'Batch not found'}

    # Get all active CLO-GA mappings for this course
    course_clo_mappings = CLOGAMapping.objects.filter(
        clo__course=course,
        is_active=True
    ).select_related('ga')

    if current_batch and current_batch.curriculum_version:
        filtered_course_clo_mappings = course_clo_mappings.filter(
            clo__curriculum_version=current_batch.curriculum_version
        )
        if filtered_course_clo_mappings.exists():
            course_clo_mappings = filtered_course_clo_mappings

    ga_to_clos = {}
    for mapping in course_clo_mappings.select_related('clo', 'ga'):
        ga_bucket = ga_to_clos.setdefault(mapping.ga_id, {
            'ga': mapping.ga,
            'clos': []
        })
        ga_bucket['clos'].append(mapping.clo)

    interim_alerts = []
    for ga_entry in ga_to_clos.values():
        ga = ga_entry['ga']
        ga_code = f'GA-{ga.order_number}'
        mapped_clos = sorted(
            ga_entry['clos'],
            key=lambda clo: clo.order_number
        )

        warning_record = None
        previous_score = None
        source_semester_no = None
        is_cumulative = False
        
        if current_batch:
            # First check cumulative GACQIRecord
            warning_record = GACQIRecord.objects.filter(
                ga=ga,
                batch=current_batch,
                cqi_level='CUMULATIVE',
                status__in=['SAVED', 'EXPORTED', 'FULLY_APPROVED', 'PENDING', 'SENT_BACK'],
                is_active=True
            ).order_by('-saved_at', '-updated_at').select_related('saved_by_hod').first()

            if warning_record and warning_record.attainment_value is not None:
                previous_score = float(warning_record.attainment_value)
                is_cumulative = True
            else:
                # Check GAReport for cumulative
                gar_report = GAReport.objects.filter(
                    ga=ga,
                    batch=current_batch
                ).first()
                if gar_report and gar_report.final_score is not None:
                    previous_score = float(gar_report.final_score)
                    is_cumulative = True
                else:
                    # Check semester-wise GACQIRecords
                    latest_semester_no = current_batch.current_semester or None
                    completed_latest = (
                        CourseSession.objects.filter(
                            batch=current_batch,
                            is_active=True,
                            assessment_status='ASSESSMENT_DONE',
                            semester__number__isnull=False
                        )
                        .aggregate(latest=Max('semester__number'))
                        .get('latest')
                    )
                    if completed_latest:
                        latest_semester_no = max(latest_semester_no or 0, completed_latest)

                    if latest_semester_no and latest_semester_no > 1:
                        for candidate_semester_no in range(latest_semester_no - 1, 0, -1):
                            candidate_semester = Semester.objects.filter(
                                program=current_batch.program,
                                number=candidate_semester_no
                            ).first()
                            if not candidate_semester:
                                continue

                            warning_record = GACQIRecord.objects.filter(
                                ga=ga,
                                batch=current_batch,
                                cqi_level='SEMESTER',
                                semester=candidate_semester_no,
                                status__in=['SAVED', 'EXPORTED', 'FULLY_APPROVED', 'PENDING', 'SENT_BACK'],
                                is_active=True
                            ).order_by('-saved_at', '-updated_at').select_related('saved_by_hod').first()

                            if warning_record and warning_record.attainment_value is not None:
                                previous_score = float(warning_record.attainment_value)
                            else:
                                candidate_score = calculate_ga_attainment_semester_cohort(current_batch, candidate_semester, ga)
                                if candidate_score is not None:
                                    previous_score = float(candidate_score)
                                    warning_record = None

                            if previous_score is not None and previous_score < float(ga.kpi_threshold):
                                source_semester_no = candidate_semester_no
                                break

                            previous_score = None
                            warning_record = None

        if previous_score is None or previous_score >= float(ga.kpi_threshold):
            continue

        issue_statement = None
        if warning_record and warning_record.issue_statement:
            issue_statement = warning_record.issue_statement
        elif is_cumulative:
            batch_label = current_batch.custom_id or current_batch.name or str(current_batch.id)
            issue_statement = (
                f"{batch_label} cumulative attainment recorded {previous_score:.2f}% in {ga_code} "
                f"({ga.title}), below the {float(ga.kpi_threshold):.2f}% target."
            )
        elif source_semester_no:
            batch_label = current_batch.custom_id or current_batch.name or str(current_batch.id)
            issue_statement = (
                f"{batch_label} semester {source_semester_no} recorded {previous_score:.2f}% in {ga_code} "
                f"({ga.title}), below the {float(ga.kpi_threshold):.2f}% target."
            )

        remedy_text = None
        if warning_record:
            remedy_text = (
                warning_record.remedy_text
                or warning_record.hod_action_plan
                or warning_record.remedial_plan
                or None
            )

        ga_data = {
            'ga_code': ga_code,
            'ga_title': ga.title,
            'previous_courses': [],
            'mapped_clos': [
                {
                    'clo_id': str(clo.id),
                    'clo_code': f'CLO-{clo.order_number}',
                    'clo_title': clo.title,
                    'bloom_level': clo.bloom_level
                }
                for clo in mapped_clos
            ],
            'previous_batch': {
                'id': str(current_batch.id) if current_batch else None,
                'name': current_batch.name if current_batch else None,
                'custom_id': current_batch.custom_id if current_batch else None
            } if current_batch else None,
            'source_semester': {
                'number': source_semester_no,
                'name': f'Semester {source_semester_no}'
            } if source_semester_no else None,
            'issue_statement': issue_statement,
            'attainment_value': previous_score,
            'saved_at': warning_record.saved_at.isoformat() if warning_record and warning_record.saved_at else None,
            'cqi_level': warning_record.cqi_level if warning_record else (
                'CUMULATIVE' if is_cumulative else 'SEMESTER'
            ),
            'cqi_status': warning_record.status if warning_record else None,
            'hod_action_plan': warning_record.hod_action_plan if warning_record else None,
            'remedial_plan': warning_record.remedial_plan if warning_record else None,
            'recommended_remedy': remedy_text
        }

        if mapped_clos:
            ga_data['previous_courses'].append({
                'course_code': course.code,
                'semester': source_semester_no,
                'ga_score': previous_score,
                'status': 'BELOW_TARGET'
            })

        interim_alerts.append(ga_data)

    return {
        'course_gas': [f'GA-{entry["ga"].order_number}' for entry in ga_to_clos.values()],
        'interim_alerts': interim_alerts
    }


def calculate_weighted_ga_score(ga, batch, force_recalculate=False):
    """
    Calculate weighted GA score using Direct, Course Feedback, and Exit Survey components
    with proper weight redistribution when components are missing.
    If a locked GAReport exists, return it instead of recalculating.
    """
    # Check for existing locked report first
    existing_report = GAReport.objects.filter(ga=ga, batch=batch, is_locked=True).first()
    if (
        existing_report
        and not force_recalculate
        and not existing_report.needs_recalculation
        and not ga_report_has_stale_contributors(batch, ga, require_assessment_done=True)
    ):
        return {
            'final_score': float(existing_report.final_score) if existing_report.final_score is not None else None,
            'direct_score': float(existing_report.direct_score) if existing_report.direct_score is not None else None,
            'indirect_score': float(existing_report.indirect_score) if existing_report.indirect_score is not None else None,
            'course_feedback_score': float(existing_report.course_feedback_score) if existing_report.course_feedback_score is not None else None,
            'course_feedback_coverage': float(existing_report.course_feedback_coverage) if existing_report.course_feedback_coverage is not None else None,
            'exit_survey_score': float(existing_report.exit_survey_score) if existing_report.exit_survey_score is not None else None,
            'exit_survey_coverage': float(existing_report.exit_survey_coverage) if existing_report.exit_survey_coverage is not None else None,
            'formula_applied': existing_report.formula_applied,
            'breakdown': existing_report.breakdown,
            'coverage': existing_report.coverage
        }
    
    # Get Direct score
    direct_score = None
    course_sessions = _get_effective_course_sessions_for_batch(
        batch,
        require_assessment_done=True,
    )
    if batch.curriculum_version:
        allowed_course_ids = {
            str(course_id)
            for course_id in batch.curriculum_version.version_courses.filter(
                is_active=True
            ).values_list('course_id', flat=True)
        }
        course_sessions = [
            session for session in course_sessions
            if str(session.course_id) in allowed_course_ids
        ]

    course_scores = get_valid_course_ga_scores(
        batch,
        ga,
        require_assessment_done=True,
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
    if course_sessions:
        total_courses = len(course_sessions)
        courses_with_ga = course_scores.values('course_session').distinct().count()
        coverage['direct'] = round((courses_with_ga / total_courses) * 100, 2)
    
    result = {
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
    
    # Save the result to GAReport
    GAReport.objects.update_or_create(
        ga=ga,
        batch=batch,
        defaults={
            'direct_score': Decimal(str(result['direct_score'])) if result['direct_score'] is not None else None,
            'indirect_score': Decimal(str(result['indirect_score'])) if result['indirect_score'] is not None else None,
            'course_feedback_score': Decimal(str(result['course_feedback_score'])) if result['course_feedback_score'] is not None else None,
            'course_feedback_coverage': Decimal(str(result['course_feedback_coverage'])) if result['course_feedback_coverage'] is not None else None,
            'exit_survey_score': Decimal(str(result['exit_survey_score'])) if result['exit_survey_score'] is not None else None,
            'exit_survey_coverage': Decimal(str(result['exit_survey_coverage'])) if result['exit_survey_coverage'] is not None else None,
            'final_score': Decimal(str(result['final_score'])) if result['final_score'] is not None else None,
            'formula_applied': result['formula_applied'],
            'breakdown': result['breakdown'],
            'coverage': result['coverage'],
            'needs_recalculation': False,
            # Only lock if we have a final score? Or let it be unlocked by default?
            # Let's keep it unlocked by default for now, so it can be recalculated until manually locked
            # 'is_locked': True if result['final_score'] is not None else False
        }
    )
    
    return result


def calculate_ga_report(batch, force_recalculate=False):
    """
    Calculate GA report for all active GAs in the batch's program.
    Locks reports if the batch is program end ready.
    Optimized to use existing GAReports whenever possible.
    """
    gas = GA.objects.filter(program=batch.program, is_active=True)
    
    # Bulk fetch existing GAReports to minimize queries
    existing_reports = GAReport.objects.filter(ga__in=gas, batch=batch).prefetch_related('ga')
    report_map = {str(report.ga_id): report for report in existing_reports}
    
    report_rows = []
    gas_to_lock = []
    
    for ga in gas:
        ga_id_str = str(ga.id)
        existing_report = report_map.get(ga_id_str)
        
        if (
            existing_report
            and not force_recalculate
            and existing_report.is_locked
            and not existing_report.needs_recalculation
            and not ga_report_has_stale_contributors(batch, ga, require_assessment_done=True)
        ):
            # Use locked existing report
            weighted_result = {
                'final_score': float(existing_report.final_score) if existing_report.final_score is not None else None,
                'direct_score': float(existing_report.direct_score) if existing_report.direct_score is not None else None,
                'indirect_score': float(existing_report.indirect_score) if existing_report.indirect_score is not None else None,
                'course_feedback_score': float(existing_report.course_feedback_score) if existing_report.course_feedback_score is not None else None,
                'course_feedback_coverage': float(existing_report.course_feedback_coverage) if existing_report.course_feedback_coverage is not None else None,
                'exit_survey_score': float(existing_report.exit_survey_score) if existing_report.exit_survey_score is not None else None,
                'exit_survey_coverage': float(existing_report.exit_survey_coverage) if existing_report.exit_survey_coverage is not None else None,
                'formula_applied': existing_report.formula_applied,
                'breakdown': existing_report.breakdown,
                'coverage': existing_report.coverage
            }
        else:
            # Calculate and save the result
            weighted_result = calculate_weighted_ga_score(ga, batch, force_recalculate=force_recalculate)
            
        report_rows.append({
            'ga_id': ga_id_str,
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
        
        # Collect GAs to lock later
        if batch.is_program_end_ready:
            gas_to_lock.append(ga.id)
            
    # Lock all relevant reports at once (bulk update)
    if gas_to_lock:
            GAReport.objects.filter(ga_id__in=gas_to_lock, batch=batch).update(is_locked=True, needs_recalculation=False)
        
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
            percent = ((Decimal(str(row['total'])) - Decimal(str(row['count']))) / (Decimal(str(row['count'])) * Decimal('4'))) * Decimal('100')
            semester_attainment[(row['course'], row['clo'])] = round(percent, 2)

    gas = GA.objects.filter(program=batch.program, is_active=True)
    reports = []
    total_eligible_students = get_students_for_batch(batch).count()
    target_curriculum_version = batch.curriculum_version

    course_sessions = get_effective_course_sessions(
        batch,
        semester=semester,
        require_assessment_done=False,
    )
    if allowed_course_ids:
        allowed_course_ids = {str(course_id) for course_id in allowed_course_ids}
        course_sessions = [
            session for session in course_sessions
            if str(session.course_id) in allowed_course_ids
        ]

    enrolled_students_count = get_students_for_batch(batch).count()

    for ga in gas:
        direct_score = calculate_ga_attainment_semester_cohort(batch, semester, ga)

        contributing_courses = []
        cf_scores = []
        cf_coverages = []
        assessed_course_count = 0

        for session in course_sessions:
            score_obj = CourseGAScore.objects.filter(
                course_session=session,
                ga=ga,
                is_active=True,
                is_stale=False,
            ).first()
            if score_obj:
                assessed_course_count += 1

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
                'course_ga_score': float(score_obj.score) if score_obj else None,
                'course_feedback_score': float(course_feedback_score) if course_feedback_score is not None else None,
                'enrolled_students': score_obj.enrolled_students if score_obj else enrolled_students_count,
                'semester': session.semester.number if session.semester else None,
                'credits': session.course.credit_hours,
                'assessment_status': session.assessment_status,
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
        if course_sessions:
            total_courses = len(course_sessions)
            coverage['direct'] = round((assessed_course_count / total_courses) * 100, 2) if total_courses > 0 else None

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
        # Exit survey is a cohort-level source; anchor it to the survey cycle's
        # batch rather than the student's current/live batch after rejoin.
        cycle__batch=batch,
        question__is_active=True
    )
    if not responses.exists():
        return None
    
    avg_rating = responses.aggregate(avg=Avg('rating_value'))['avg']
    score = round(((Decimal(str(avg_rating)) - Decimal('1')) / Decimal('4')) * 100, 2)
    
    from django.contrib.auth import get_user_model
    User = get_user_model()
    total_eligible = get_students_for_batch(batch).count()
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


def calculate_peo_report(peo, batch=None, peo_snapshot=None):
    """
    Calculate PEO report:
        - Direct (80%): Weighted sum of GA reports using GA-PEO mappings
        - Indirect (20%): Alumni survey responses for this PEO
        - If no indirect data, redistribute weight to 100% direct
    """
    snapshot_mappings = peo_snapshot.get('ga_mappings', []) if peo_snapshot else None
    if snapshot_mappings is None:
        mappings = GAPEOMapping.objects.filter(
            peo=peo,
            is_active=True
        ).select_related('ga')
    else:
        mappings = snapshot_mappings

    if snapshot_mappings is None:
        if not mappings.exists():
            return None
    elif not mappings:
        return None
    
    # Calculate Direct score: weighted average of GA reports
    total_weighted_direct = Decimal('0')
    total_weight = Decimal('0')
    contributing_gas = []
    
    for mapping in mappings:
        if peo_snapshot:
            try:
                ga = GA.objects.get(id=mapping['ga_id'], is_active=True)
            except GA.DoesNotExist:
                continue
            weight = Decimal(str(mapping.get('weight') or '0'))
        else:
            ga = mapping.ga
            weight = mapping.weight

        # Get GA's final score using calculate_weighted_ga_score
        ga_result = calculate_weighted_ga_score(ga, batch) if batch else None
        if ga_result and ga_result['final_score'] is not None:
            total_weighted_direct += Decimal(str(ga_result['final_score'])) * weight
            total_weight += weight
            contributing_gas.append({
                'ga_id': str(ga.id),
                'ga_code': f'GA-{ga.order_number}',
                'ga_title': ga.title,
                'ga_score': ga_result['final_score'],
                'weight': float(weight)
            })
    
    direct_score = None
    if total_weight > 0:
        direct_score = round(total_weighted_direct / total_weight, 2)
    
    # Calculate Indirect score: get_flexible_peo_indirect_score (handles Alumni + Employer)
    indirect_score = None
    indirect_sources = []
    if batch:
        peo_id = peo_snapshot.get('id') if peo_snapshot else peo.id
        indirect_data = get_flexible_peo_indirect_score(peo_id, batch.id)
        if indirect_data['overall'] is not None:
            indirect_score = Decimal(str(indirect_data['overall']))
            indirect_sources = indirect_data['sources']
    
    # Define weights (direct:80%, indirect:20%)
    W_PEO_DIRECT = Decimal('80.00')
    W_PEO_INDIRECT = Decimal('20.00')
    
    # Determine available components and their weights
    available = []
    if direct_score is not None:
        available.append(('direct', direct_score, W_PEO_DIRECT))
    if indirect_score is not None:
        available.append(('indirect', indirect_score, W_PEO_INDIRECT))
    
    formula_applied = 'no_data'
    if len(available) == 2:
        formula_applied = 'full'
    elif len(available) == 1:
        if available[0][0] == 'direct':
            formula_applied = 'direct_only'
        else:
            formula_applied = 'indirect_only'
    
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
    
    return {
        'peo_id': str(peo_snapshot.get('id') if peo_snapshot else peo.id),
        'peo_code': peo_snapshot.get('code') if peo_snapshot else f'PO-{peo.order_number}',
        'peo_title': peo_snapshot.get('title') if peo_snapshot else peo.title,
        'peo_description': peo_snapshot.get('description') if peo_snapshot else peo.description,
        'final_score': float(final_score) if final_score is not None else None,
        'direct_score': float(direct_score) if direct_score is not None else None,
        'indirect_score': float(indirect_score) if indirect_score is not None else None,
        'formula_applied': formula_applied,
        'breakdown': breakdown,
        'contributing_gas': contributing_gas,
        'indirect_sources': indirect_sources
    }


def calculate_all_peo_reports(batch):
    """
    Calculate PEO reports for the PEO framework locked to this batch.
    """
    snapshot_peos = (batch.peo_snapshot or {}).get('peos') or []
    report_rows = []
    if snapshot_peos:
        for peo_snapshot in snapshot_peos:
            peo_result = calculate_peo_report(None, batch, peo_snapshot=peo_snapshot)
            if peo_result:
                report_rows.append(peo_result)
        return report_rows

    peos = PEO.objects.filter(program=batch.program, is_active=True)
    for peo in peos:
        peo_result = calculate_peo_report(peo, batch)
        if peo_result:
            report_rows.append(peo_result)
    return report_rows


# ---------------------------------------------------------------------------
# Employer Survey: Tokenized one-time-link distribution & submission
# ---------------------------------------------------------------------------

def generate_employer_survey_tokens_for_cycle(employer_cycle_id: str):
    """
    For a given EmployerSurveyCycle, seed EmployerSurveyResponse rows
    (each with a unique one-time-use UUID response_token) for every
    alumni employment record captured in the linked AlumniSurveyCycle
    (or the sibling active alumni cycle of the same survey_window)
    that has a non-empty employer contact.

    Returns summary counts: { created, skipped_duplicate, missing_email }
    """
    from .models import (
        EmployerSurveyCycle,
        EmployerSurveyResponse,
        AlumniSurveyCycle,
        AlumniSurveyResponse,
        AlumniSurveySubmission,
    )
    from django.db import transaction

    cycle = EmployerSurveyCycle.objects.select_related("batch", "linked_alumni_cycle").get(
        id=employer_cycle_id, is_active=True
    )
    batch = cycle.batch
    survey_window = cycle.survey_window

    alumni_cycle = cycle.linked_alumni_cycle
    if alumni_cycle is None:
        alumni_cycle = AlumniSurveyCycle.objects.filter(
            batch=batch, survey_window=survey_window, is_active=True
        ).order_by("-created_at").first()

    employer_seeds: list[dict] = []

    if alumni_cycle is not None:
        sub_rows = AlumniSurveySubmission.objects.filter(
            cycle=alumni_cycle, is_active=True
        ).exclude(
            models.Q(employer_contact_email__isnull=True) | models.Q(employer_contact_email="")
        ).select_related("student", "student__user").values(
            "id", "student_id", "organization_name", "current_designation",
            "employer_contact_name", "employer_contact_email", "student__user__full_name",
        )
        for r in sub_rows:
            employer_seeds.append({
                "alumni_submission_id": r["id"],
                "student_id": r["student_id"],
                "employer_email": (r["employer_contact_email"] or "").strip().lower(),
                "employer_contact_name": r.get("employer_contact_name"),
                "employer_organization": r.get("organization_name"),
                "employee_designation": r.get("current_designation"),
                "employee_name": r.get("student__user__full_name"),
            })

        if not employer_seeds:
            resp_rows = AlumniSurveyResponse.objects.filter(
                cycle=alumni_cycle, is_active=True,
                employment_status__in=["EMPLOYED", "SELF_EMPLOYED"],
            ).exclude(
                organization_name__isnull=True
            ).exclude(
                organization_name=""
            ).select_related("student", "student__user").values(
                "student_id", "employment_status", "organization_name",
                "current_designation", "student__user__full_name",
            ).distinct()
            for r in resp_rows:
                employer_seeds.append({
                    "alumni_submission_id": None,
                    "student_id": r["student_id"],
                    "employer_email": "",
                    "employer_organization": r.get("organization_name"),
                    "employee_designation": r.get("current_designation"),
                    "employee_name": r.get("student__user__full_name"),
                })

    created = 0
    skipped_duplicate = 0
    missing_email = 0

    with transaction.atomic():
        for seed in employer_seeds:
            if not seed["employer_email"]:
                missing_email += 1
                continue
            defaults = {
                "alumni_survey_submission_id": seed["alumni_submission_id"],
                "employer_contact_name": seed.get("employer_contact_name"),
                "employer_organization": seed.get("employer_organization"),
                "employer_designation": seed.get("employee_designation"),
                "employee_name_at_org": seed.get("employee_name"),
            }
            obj, was_created = EmployerSurveyResponse.objects.get_or_create(
                cycle=cycle,
                employer_email=seed["employer_email"],
                alumni_student_id=seed["student_id"],
                defaults=defaults,
            )
            if was_created:
                created += 1
            else:
                skipped_duplicate += 1

    return {
        "cycle_id": str(cycle.id),
        "created": created,
        "skipped_duplicate": skipped_duplicate,
        "missing_email": missing_email,
        "total_seeds": len(employer_seeds),
    }


def build_employer_survey_public_link(response_token, request=None, frontend_base_url=None):
    """
    Build the public (non-authenticated) URL that an employer opens to
    submit feedback. The link is one-time-use because the token is
    invalidated on successful submit.

    Accepts either a Django HttpRequest (to derive scheme/host) or an
    explicit frontend_base_url string like "https://eduobe.example.com".
    """
    token_str = str(response_token)
    if not frontend_base_url:
        try:
            from django.conf import settings
            frontend_base_url = getattr(settings, "FRONTEND_BASE_URL", None)
        except Exception:
            frontend_base_url = None
    if frontend_base_url:
        base = frontend_base_url.rstrip("/")
        return f"{base}/employer/survey/{token_str}"
    if request is not None:
        scheme = request.scheme
        host = request.get_host()
        return f"{scheme}://{host}/employer/survey/{token_str}"
    return f"/employer/survey/{token_str}"


def _send_employer_survey_email(employer_response, public_link, program_name=None):
    """
    Thin email wrapper. Uses Django's send_mail when available; otherwise
    logs the intent to stdout so the operator can plug in a real backend.
    Does NOT throw — failures are captured so the batch keeps running.
    """
    import logging
    logger = logging.getLogger(__name__)
    subject = f"EduOBE Employer Feedback Request — {program_name or 'Program'}"
    body = (
        "Dear Employer,\n\n"
        f"Your feedback about the graduate '{employer_response.employee_name_at_org or 'this graduate'}' "
        f"at '{employer_response.employer_organization or 'your organization'}' helps our program improve.\n\n"
        f"Please complete this short anonymous survey (5-min):\n  {public_link}\n\n"
        "This link is valid for one submission only.\n\n"
        "Thank you,\nEduOBE Office"
    )
    try:
        from django.core.mail import send_mail
        from django.conf import settings
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@eduobe.local")
        recipient = employer_response.employer_email
        send_mail(subject, body, from_email, [recipient], fail_silently=False)
        return True
    except Exception as exc:  # noqa: BLE001 — email backend may be missing in dev
        logger.warning("Employer survey email skipped for %s: %s", employer_response.employer_email, exc)
        logger.info("EMAIL INTENT: to=%s | link=%s", employer_response.employer_email, public_link)
        return False


def dispatch_employer_survey_emails(employer_cycle_id: str, request=None, frontend_base_url=None):
    """
    For every pending EmployerSurveyResponse in the cycle whose token has
    not been sent yet, mark token_sent_at and deliver the one-time link
    via email. Returns summary counts.
    """
    from .models import EmployerSurveyResponse

    pending = list(EmployerSurveyResponse.objects.filter(
        cycle_id=employer_cycle_id,
        token_sent_at__isnull=True,
        submitted_at__isnull=True,
        is_active=True,
    ).select_related("cycle", "cycle__batch", "cycle__batch__program"))

    sent = 0
    failed = 0
    program_name = None
    for resp in pending:
        if program_name is None and resp.cycle.batch.program:
            program_name = resp.cycle.batch.program.name
        link = build_employer_survey_public_link(
            resp.response_token, request=request, frontend_base_url=frontend_base_url
        )
        ok = _send_employer_survey_email(resp, link, program_name=program_name)
        if ok:
            resp.token_sent_at = timezone.now()
            resp.save(update_fields=["token_sent_at"])
            sent += 1
        else:
            failed += 1
    return {
        "cycle_id": str(employer_cycle_id),
        "sent": sent,
        "failed": failed,
        "total_pending": len(pending),
    }


def submit_employer_survey_by_token(
    response_token: str,
    answers_payload: list[dict],
    additional_feedback: str | None = None,
):
    """
    Public (non-auth) submission path for Employer Survey.

    answers_payload = [
        {"question_id": "<uuid>", "score": 1..5},
        ...
    ]

    Validates token single-use, then creates one EmployerSurveyAnswer per
    scored question, records submitted_at, and invalidates the token.
    General questions (peo=null) are accepted but excluded from scoring.
    """
    from .models import EmployerSurveyResponse, EmployerSurveyAnswer, SurveyQuestion
    from django.db import transaction

    resp = EmployerSurveyResponse.objects.filter(
        response_token=response_token
    ).select_related("cycle").first()
    if resp is None:
        raise LookupError("Survey link is not recognized.")

    has_recorded_answers = resp.answers.filter(is_active=True).exists()
    if has_recorded_answers and resp.token_used_at is not None:
        raise PermissionError("This survey link has already been used.")
    if has_recorded_answers and resp.submitted_at is not None:
        raise PermissionError("This survey has already been submitted.")
    if has_recorded_answers and not resp.is_active:
        raise PermissionError("This survey link is no longer active.")

    cycle_qs = SurveyQuestion.objects.filter(
        survey_type="EMPLOYER",
        is_active=True,
    )
    if resp.cycle and resp.cycle.batch and resp.cycle.batch.program:
        cycle_qs = cycle_qs.filter(
            models.Q(program=resp.cycle.batch.program) | models.Q(program__isnull=True)
        )
    valid_questions = {str(q.id): q for q in cycle_qs}

    with transaction.atomic():
        bulk_answers = []
        for entry in answers_payload:
            qid = entry.get("question_id")
            score = entry.get("score")
            selected_option_label = entry.get("selected_option_label")
            text_answer = entry.get("text_answer")
            if qid is None:
                continue
            try:
                qid_uuid = str(uuid.UUID(str(qid)))
            except (ValueError, AttributeError):
                continue
            question = valid_questions.get(qid_uuid)
            if question is None:
                continue

            answer_kwargs = {
                "response": resp,
                "question_id": qid_uuid,
                "score": None,
                "selected_option_label": None,
                "text_answer": None,
            }
            if question.question_type == "TEXT":
                cleaned_text = str(text_answer or "").strip()
                if not cleaned_text:
                    continue
                answer_kwargs["text_answer"] = cleaned_text
            else:
                try:
                    score_int = int(score)
                except (TypeError, ValueError):
                    score_int = None
                cleaned_label = str(selected_option_label or "").strip()
                if score_int is None and not cleaned_label:
                    continue
                answer_kwargs["score"] = score_int if score_int and score_int > 0 else None
                answer_kwargs["selected_option_label"] = cleaned_label or None

            if (
                answer_kwargs["score"] is None
                and answer_kwargs["selected_option_label"] is None
                and answer_kwargs["text_answer"] is None
            ):
                continue
            bulk_answers.append(EmployerSurveyAnswer(**answer_kwargs))

        if bulk_answers:
            EmployerSurveyAnswer.objects.bulk_create(bulk_answers, ignore_conflicts=True)

        resp.submitted_at = timezone.now()
        resp.token_used_at = timezone.now()
        resp.is_active = False
        resp.additional_feedback = str(additional_feedback or "").strip() or None
        resp.save(update_fields=["submitted_at", "token_used_at", "is_active", "additional_feedback", "updated_at"])

    return {
        "response_id": str(resp.id),
        "answers_recorded": len(bulk_answers),
        "submitted_at": resp.submitted_at.isoformat(),
    }


def mark_alumni_survey_submission_from_legacy(alumni_cycle_id: str):
    """
    One-shot migration helper: for every student that already has legacy
    AlumniSurveyResponse rows in a given cycle, create a corresponding
    AlumniSurveySubmission header row (without flexible answers) so that
    the new flexible scoring pipeline can recognize the student count
    when the Coordinator later migrates questions to SurveyQuestion.
    """
    from .models import AlumniSurveyCycle, AlumniSurveyResponse, AlumniSurveySubmission
    from django.db import transaction

    cycle = AlumniSurveyCycle.objects.get(id=alumni_cycle_id)
    per_student = AlumniSurveyResponse.objects.filter(
        cycle=cycle, is_active=True
    ).values(
        "student_id", "employment_status", "organization_name", "current_designation"
    ).distinct()

    created = 0
    existing = 0
    with transaction.atomic():
        for row in per_student:
            _, was_created = AlumniSurveySubmission.objects.get_or_create(
                cycle=cycle,
                student_id=row["student_id"],
                defaults={
                    "employment_status": row.get("employment_status"),
                    "organization_name": row.get("organization_name"),
                    "current_designation": row.get("current_designation"),
                },
            )
            if was_created:
                created += 1
            else:
                existing += 1
    return {"cycle_id": str(cycle.id), "created": created, "existing": existing}
