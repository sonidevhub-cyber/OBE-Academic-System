from __future__ import annotations
import logging

from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from assessments.models import Assessment, Question, StudentAssessment

from .invalidation_service import sync_retake_reports_from_assessment
from .models import CourseRetake, RetakeAssessmentSnapshot

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=Assessment)
def cache_assessment_finalized_state(sender, instance, **kwargs):
    if not instance.pk:
        instance._previous_is_finalized = False
        return

    instance._previous_is_finalized = (
        Assessment.objects.filter(pk=instance.pk)
        .values_list("is_finalized", flat=True)
        .first()
        or False
    )


@receiver(post_save, sender=Assessment)
def sync_retake_after_assessment_save(sender, instance, created, **kwargs):
    was_finalized = getattr(instance, "_previous_is_finalized", False)
    logger.info(f"[Retake Signals] Assessment {instance.id} ({instance.title}) - type: {instance.assessment_type}, is_finalized: {instance.is_finalized}, was_finalized: {was_finalized}, course_retake: {instance.course_retake_id}")
    
    if not instance.is_finalized or was_finalized:
        logger.info(f"[Retake Signals] Skipping assessment {instance.id} (not newly finalized)")
        return

    logger.info(f"[Retake Signals] Triggering sync for assessment {instance.id}")
    transaction.on_commit(lambda: sync_retake_reports_from_assessment(instance))


@receiver(post_save, sender=StudentAssessment)
def sync_retake_after_student_assessment_save(sender, instance, **kwargs):
    assessment = instance.assessment
    logger.info(f"[Retake Signals] StudentAssessment {instance.id} - assessment_type: {assessment.assessment_type}, is_finalized: {assessment.is_finalized}")
    
    if assessment.assessment_type.strip().lower() != "final" or not assessment.is_finalized:
        logger.info(f"[Retake Signals] Skipping StudentAssessment {instance.id} (not final or not finalized)")
        return

    logger.info(f"[Retake Signals] Triggering sync for StudentAssessment {instance.id}")
    transaction.on_commit(lambda: sync_retake_reports_from_assessment(assessment, student_id=instance.student_id))


def _build_snapshot_data(retake):
    from assessments.models import Assessment

    original_assessments = list(
        Assessment.objects.filter(
            course=retake.failed_course,
            batch=retake.failed_batch,
            course_retake__isnull=True,
            is_finalized=True,
        )
        .order_by("assessment_type", "id")
        .prefetch_related("questions__clo")
        .select_related("semester", "instructor")
    )

    snapshot_assessments = []
    for assessment in original_assessments:
        questions = list(
            assessment.questions.all().select_related("clo")
        )
        snapshot_assessments.append({
            "original_assessment_id": str(assessment.id),
            "title": assessment.title,
            "assessment_type": assessment.assessment_type,
            "total_marks": float(assessment.total_marks),
            "weightage": float(assessment.weightage),
            "assessment_date": assessment.assessment_date.strftime("%Y-%m-%d") if assessment.assessment_date else None,
            "semester_id": str(assessment.semester_id) if assessment.semester_id else None,
            "instructor_id": str(assessment.instructor_id) if assessment.instructor_id else None,
            "is_finalized": assessment.is_finalized,
            "questions": [
                {
                    "original_question_id": str(q.id),
                    "description": q.description,
                    "bloom_level": q.bloom_level,
                    "marks": float(q.marks),
                    "clo_id": str(q.clo_id) if q.clo_id else None,
                    "clo_code": f"CLO-{q.clo.order_number}" if q.clo else None,
                }
                for q in questions
            ],
        })

    return {
        "assessments": snapshot_assessments,
        "total_assessments": len(snapshot_assessments),
        "created_at": retake.created_at.isoformat(),
    }


def _create_retake_assessments_from_snapshot(retake, snapshot_data):
    instructor = getattr(retake, "retake_teacher", None)
    if not instructor:
        for ass_data in snapshot_data.get("assessments", []):
            if ass_data.get("instructor_id"):
                from django.contrib.auth import get_user_model
                User = get_user_model()
                try:
                    instructor = User.objects.get(id=ass_data["instructor_id"])
                except User.DoesNotExist:
                    pass
                break

    if not instructor:
        logger.warning(f"[Retake Signals] No instructor found for retake {retake.id}. Skipping assessment creation.")
        return

    for ass_data in snapshot_data.get("assessments", []):
        existing = Assessment.objects.filter(
            course_retake=retake,
            assessment_type=ass_data["assessment_type"],
            title=ass_data["title"],
            total_marks=ass_data["total_marks"],
            weightage=ass_data["weightage"],
        ).first()
        if existing:
            continue

        assessment = Assessment.objects.create(
            course=retake.failed_course,
            batch=retake.failed_batch,
            semester_id=ass_data.get("semester_id"),
            instructor=instructor,
            title=ass_data["title"],
            assessment_type=ass_data["assessment_type"],
            total_marks=ass_data["total_marks"],
            weightage=ass_data["weightage"],
            assessment_date=ass_data.get("assessment_date"),
            is_finalized=False,
            is_locked=False,
            course_retake=retake,
        )

        question_objects = []
        for q_data in ass_data.get("questions", []):
            question_objects.append(Question(
                assessment=assessment,
                description=q_data["description"],
                bloom_level=q_data.get("bloom_level", ""),
                marks=q_data["marks"],
                clo_id=q_data.get("clo_id"),
            ))
        Question.objects.bulk_create(question_objects)

    created_count = Assessment.objects.filter(course_retake=retake).count()
    expected_count = len(snapshot_data.get("assessments", []))
    if created_count != expected_count:
        logger.error(
            f"[Retake Signals] Mismatch for retake {retake.id}: "
            f"expected {expected_count} assessments, created {created_count}. "
            f"Check for duplicate-type assessments in original course."
        )
    else:
        logger.info(
            f"[Retake Signals] Successfully created {created_count} retake assessments for retake {retake.id}"
        )


@receiver(post_save, sender="retake.CourseRetake")
def build_retake_assessment_snapshot(sender, instance, created, **kwargs):
    snapshot = RetakeAssessmentSnapshot.objects.filter(retake=instance).first()

    if not snapshot:
        snapshot_data = _build_snapshot_data(instance)
        snapshot = RetakeAssessmentSnapshot.objects.create(
            retake=instance,
            original_course_id=instance.failed_course_id,
            original_batch_id=instance.failed_batch_id,
            original_semester_id=getattr(instance.failed_batch, "current_semester", None),
            snapshot_data=snapshot_data,
            is_locked=True,
        )
    else:
        snapshot_data = snapshot.snapshot_data

    _create_retake_assessments_from_snapshot(instance, snapshot_data)
