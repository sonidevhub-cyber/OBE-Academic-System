from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from students.models import Student
from datetime import date

User = get_user_model()

@receiver(post_save, sender=User)
def create_student_profile(sender, instance, created, **kwargs):
    if created and hasattr(instance, 'role') and instance.role == "student":
        # Check if student already exists
        if not Student.objects.filter(email=instance.email).exists():
            Student.objects.create(
                name=f"{instance.first_name} {instance.last_name}".strip() or instance.username,
                email=instance.email,
                phone="00000000000",
                date_of_birth=date(2000, 1, 1),
                first_name=instance.first_name,
                last_name=instance.last_name,
                password=instance.password,
            )