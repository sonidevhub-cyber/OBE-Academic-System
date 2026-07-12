from __future__ import annotations
import logging

from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from assessments.models import Assessment, StudentAssessment

from .invalidation_service import sync_retake_reports_from_assessment

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
