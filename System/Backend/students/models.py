import uuid
from django.db import models
from django.conf import settings


class Student(models.Model):

    # STATUS_CHOICES = [
    #     ('active', 'Active'),
    #     ('alumni', 'Alumni'),
    # ]

    student_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    custom_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='student_profile')
    registration_number = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    department = models.ForeignKey(
        "core.Department", on_delete=models.SET_NULL, null=True, blank=True
    )
    batch = models.ForeignKey(
        "core.Batch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="profile_students"
    )
    is_frozen = models.BooleanField(default=False)
    frozen_at_semester = models.PositiveSmallIntegerField(null=True, blank=True)
    frozen_date = models.DateTimeField(null=True, blank=True)
    original_batch = models.ForeignKey(
        "core.Batch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="original_profile_students",
    )
    phone = models.CharField(max_length=20, blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    gender = models.CharField(max_length=20, blank=True, null=True)
    blood_group = models.CharField(max_length=10, blank=True, null=True)
    guardian_name = models.CharField(max_length=255, blank=True, null=True)
    guardian_contact = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to='students/', null=True, blank=True)
    exit_survey_submitted = models.BooleanField(default=False)
    exit_survey_submitted_at = models.DateTimeField(null=True, blank=True)
    is_late_submitter = models.BooleanField(default=False)
    # status = models.CharField(
    #     max_length=20,
    #     choices=STATUS_CHOICES,
    #     default='active',
    # )
    # is_active = models.BooleanField(default=True)
    
    def save(self, *args, **kwargs):
        if not self.custom_id:
            # Use registration_number as custom_id for students
            self.custom_id = self.registration_number
            
            # Also update the associated user's custom_id to match
            if self.user:
                self.user.custom_id = self.registration_number
                self.user.save(update_fields=['custom_id'])
        
        # Auto-set CS Department if not provided
        if not self.department:
            try:
                from core.models import Department
                self.department = Department.objects.get(code='CS', is_active=True)
            except Exception:
                pass

        if self.user:
            pass
                
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.custom_id})"
