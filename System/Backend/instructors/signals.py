from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import Instructor

User = get_user_model()

@receiver(post_save, sender=User)
def create_instructor_profile(sender, instance, created, **kwargs):
    if created and instance.role.lower() == 'instructor':
        Instructor.objects.get_or_create(
            user=instance,
            email=instance.email,
            defaults={
                'name': instance.full_name,
                'designation': getattr(instance, 'designation', 'Instructor') or 'Instructor',
                'phone': getattr(instance, 'phone', '') or '',
            }
        )

@receiver(post_save, sender=User)
def save_instructor_profile(sender, instance, **kwargs):
    if instance.role.lower() == 'instructor':
        instructor, created = Instructor.objects.get_or_create(
            user=instance,
            email=instance.email,
            defaults={
                'name': instance.full_name,
                'designation': getattr(instance, 'designation', 'Instructor') or 'Instructor',
                'phone': getattr(instance, 'phone', '') or '',
            }
        )
        if not created:
            instructor.name = instance.full_name
            instructor.email = instance.email
            instructor.designation = getattr(instance, 'designation', 'Instructor') or 'Instructor'
            instructor.phone = getattr(instance, 'phone', '') or ''
            instructor.save()
