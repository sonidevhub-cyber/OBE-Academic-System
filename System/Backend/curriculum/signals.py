from django.db.models.signals import post_save
from django.dispatch import receiver
from academic_structure.models import Batch
from .services import suggest_curriculum_for_new_batch

@receiver(post_save, sender=Batch)
def auto_suggest_curriculum(sender, instance, created, **kwargs):
    if created:
        suggest_curriculum_for_new_batch(batch=instance)
