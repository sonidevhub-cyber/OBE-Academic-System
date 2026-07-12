
from __future__ import annotations
import logging

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from assessments.models import Assessment, CourseThreshold, StudentAssessment   
from assessments.services.clo_service import CLOService
from core.models import Semester
from obe.models import CourseGAScore, CourseSession, GACQIRecord, GAReport, GAMasterCache
from obe.services import calculate_all_course_ga_scores, calculate_ga_report
from clo_master.signals import append_course_to_clo_master  # Import directly call the signal handler

from .models import CourseRetake, ReportInvalidationLog

logger = logging.getLogger(__name__)


def get_active_retake_for_assessment(assessment: Assessment, student_id=None) -> CourseRetake | None:
    logger.info(f"[Retake Invalidation] get_active_retake_for_assessment called - assessment_id: {assessment.id}, student_id: {student_id}, assessment.course_retake_id: {assessment.course_retake_id}")

    # First check if the assessment itself is linked to a retake.
    # This is the most reliable source because the assessment was created for
    # that exact retake record.
    if assessment.course_retake and assessment.course_retake.is_active:
        logger.info(f"[Retake Invalidation] Found assessment-linked retake: {assessment.course_retake.id}")
        return assessment.course_retake

    if not assessment.course_id or not assessment.batch_id:
        return None

    queryset = CourseRetake.objects.filter(
        failed_course_id=assessment.course_id,
        current_batch_id=assessment.batch_id,
        is_active=True,
    )
    if student_id is not None:
        queryset = queryset.filter(student_id=student_id)
    retake = queryset.select_related("student", "failed_course", "current_batch", "ga_score").order_by("-attempt_number").first()
    logger.info(f"[Retake Invalidation] Queries retakes, found: {retake.id if retake else None}")
    return retake


def _student_passed_retake(assessment: Assessment, student_assessment: StudentAssessment) -> bool:
    threshold_obj = CourseThreshold.objects.filter(
        course=assessment.course,
        semester=assessment.semester,
    ).first()
    threshold = threshold_obj.threshold if threshold_obj else Decimal('50')       
    total_marks = Decimal(str(assessment.total_marks or 0))
    if total_marks <= 0:
        return False
    percentage = (Decimal(str(student_assessment.marks_obtained or 0)) / total_marks) * 100
    return percentage >= Decimal(str(threshold))


def flag_reports_for_student(retake: CourseRetake, student_id):
    logger.info(f"[Retake Invalidation] flag_reports_for_student called for retake: {retake.id}, student_id: {student_id}")
    batch = retake.current_batch
    program = batch.program if batch else None

    if batch:
        GAReport.objects.filter(batch=batch).update(needs_recalculation=True)   
        GAMasterCache.objects.filter(batch=batch).update(needs_recalculation=True)

    if batch and program:
        GACQIRecord.objects.filter(batch=batch, ga__program=program, is_active=True).update(needs_recalculation=True)

    log = ReportInvalidationLog.objects.filter(
        triggered_by_retake=retake,
        student_id=student_id,
        resolved_at__isnull=True,
    ).first()

    if log is None:
        log = ReportInvalidationLog.objects.create(
            triggered_by_retake=retake,
            student_id=student_id,
            affected_student_report=True,
            affected_batch_report=True,
        )
    else:
        log.affected_student_report = True
        log.affected_batch_report = True
        log.save(update_fields=["affected_student_report", "affected_batch_report"])

    return log


def resolve_invalidation_logs(*, retake: CourseRetake | None = None, student_id=None, batch=None):
    logger.info(f"[Retake Invalidation] resolve_invalidation_logs called")       
    queryset = ReportInvalidationLog.objects.filter(resolved_at__isnull=True)   
    if retake is not None:
        queryset = queryset.filter(triggered_by_retake=retake)
    if student_id is not None:
        queryset = queryset.filter(student_id=student_id)
    if batch is not None:
        queryset = queryset.filter(triggered_by_retake__current_batch=batch)    

    queryset.update(resolved_at=timezone.now())


def sync_retake_reports_from_assessment(assessment: Assessment, student_id=None):
    logger.info(f"[Retake Invalidation] sync_retake_reports_from_assessment called - assessment_id: {assessment.id}, type: {assessment.assessment_type}, is_finalized: {assessment.is_finalized}, student_id: {student_id}")

    if assessment.assessment_type.strip().lower() != "final" or not assessment.is_finalized:
        logger.info(f"[Retake Invalidation] Not a finalized final assessment - skipping")
        return None

    student_assessment_qs = StudentAssessment.objects.filter(assessment=assessment).select_related("student")
    if student_id is not None:
        student_assessment_qs = student_assessment_qs.filter(student_id=student_id)

    logger.info(f"[Retake Invalidation] Found {student_assessment_qs.count()} student assessments")

    processed_retake = None
    for student_assessment in student_assessment_qs:
        logger.info(f"[Retake Invalidation] Processing student_assessment: {student_assessment.id}, student_id: {student_assessment.student_id}")
        retake = get_active_retake_for_assessment(assessment, student_assessment.student_id)
        if not retake:
            logger.info(f"[Retake Invalidation] No active retake found - skipping")
            continue

        logger.info(f"[Retake Invalidation] Found retake: {retake.id} for student {student_assessment.student_id}")

        target_batch = retake.current_batch or assessment.batch
        target_semester = Semester.objects.filter(
            program=target_batch.program,
            number=target_batch.current_semester,
        ).first()
        if target_semester is None:
            target_semester = assessment.semester

        target_semester_id = target_semester.id if target_semester else assessment.semester_id
        target_course_id = retake.failed_course_id or assessment.course_id

        with transaction.atomic():
            flag_reports_for_student(retake, student_assessment.student_id)   

            # Rebuild the retake's CLO/GA chain using the existing calculation flow.
            logger.info(f"[Retake Invalidation] Generating student CLO report") 
            CLOService.generate_student_report(
                course_id=target_course_id,
                batch_id=target_batch.id,
                semester_id=target_semester_id,
                course_retake=retake,
            )

            # Step 1: Get/create CourseSession without finalizing first
            logger.info(f"[Retake Invalidation] Updating/creating CourseSession (without finalizing first)")
            course_session, _ = CourseSession.objects.update_or_create(
                course_id=target_course_id,
                batch_id=target_batch.id,
                semester_id=target_semester_id,
                defaults={
                    "instructor": assessment.instructor,
                    "is_active": True,
                    "allow_result_editing": False,
                },
            )

            # Step 2: Calculate GA scores first (creates StudentCLOScore, CourseGAScore)
            logger.info(f"[Retake Invalidation] Calculating course GA scores")  
            calculate_all_course_ga_scores(course_session)

            # Step 3: Now set CourseSession to ASSESSMENT_DONE and save
            logger.info(f"[Retake Invalidation] Setting CourseSession to ASSESSMENT_DONE")
            course_session.assessment_done = True
            course_session.assessment_status = "ASSESSMENT_DONE"
            course_session.save()

            # Step 4: Manually trigger CLO and GA master cache updates (since we changed order)
            logger.info(f"[Retake Invalidation] Updating CLO Master")
            append_course_to_clo_master(None, course_session, False)
            logger.info(f"[Retake Invalidation] Updating GA Master Cache")
            from obe.signals import update_ga_master_cache
            update_ga_master_cache(None, course_session, False)

            logger.info(f"[Retake Invalidation] Calculating GA report")
            calculate_ga_report(target_batch)

            summary_ga_score = (
                CourseGAScore.objects.filter(course_session=course_session)
                .select_related("ga")
                .order_by("ga__order_number")
                .first()
            )
            logger.info(f"[Retake Invalidation] Summary GA score: {summary_ga_score.id if summary_ga_score else None}")

            retake.ga_score = summary_ga_score
            retake.status = "passed" if _student_passed_retake(assessment, student_assessment) else "failed_again"
            retake.save(update_fields=["ga_score", "status", "updated_at"])
            logger.info(
                f"[Retake Invalidation] Updated retake ga_score and status -> {retake.status}"
            )

            GAReport.objects.filter(batch=target_batch).update(needs_recalculation=False)
            GAMasterCache.objects.filter(batch=target_batch).update(needs_recalculation=False)
            GACQIRecord.objects.filter(batch=target_batch, ga__program=assessment.course.program).update(
                needs_recalculation=False
            )

            resolve_invalidation_logs(retake=retake, student_id=student_assessment.student_id, batch=target_batch)
            processed_retake = retake

    return processed_retake
