import uuid
from django.db import models
from django.db.models import Count


class Batch(models.Model):
    SESSION_CHOICES = [
        ('fall', 'Fall'),
        ('spring', 'Spring'),
    ]

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('graduated', 'Graduated'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    custom_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    program = models.ForeignKey(
        'core.Program',
        on_delete=models.CASCADE,
        related_name='batches',
    )
    name = models.CharField(max_length=50)
    session_type = models.CharField(
        max_length=10,
        choices=SESSION_CHOICES,
        default='fall',
    )
    start_year = models.IntegerField()
    end_year = models.IntegerField()
    current_semester = models.IntegerField(default=1)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
    )
    graduated_at = models.DateTimeField(null=True, blank=True)
    curriculum_version = models.ForeignKey(
        'curriculum.CurriculumVersion',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_batches'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    exit_survey_enabled = models.BooleanField(default=False)
    exit_survey_enabled_at = models.DateTimeField(null=True, blank=True)
    graduation_initiated = models.BooleanField(default=False)
    graduation_initiated_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.custom_id:
            session_prefix = 'F' if self.session_type == 'fall' else 'S'
            base_custom_id = f"BAT-{self.program.code.upper()}-{self.start_year}-{session_prefix}"
            
            # Check for uniqueness and append a counter if necessary
            counter = 0
            unique_custom_id = base_custom_id
            while Batch.objects.filter(custom_id=unique_custom_id).exists():
                counter += 1
                unique_custom_id = f"{base_custom_id}-{counter}"
            self.custom_id = unique_custom_id
        super().save(*args, **kwargs)

    class Meta:
        unique_together = ('program', 'name')
        ordering = ['-start_year']

    @property
    def is_program_end_ready(self):
        # Check if current_semester is equal to total_semesters of the program
        if self.current_semester != self.program.total_semesters:
            return False
        
        # Check if all courses in current and past semesters are assessment done
        from obe.models import CourseSession
        total_courses = CourseSession.objects.filter(
            batch=self,
            is_active=True,
            semester__number__lte=self.current_semester
        ).count()
        done_courses = CourseSession.objects.filter(
            batch=self,
            is_active=True,
            semester__number__lte=self.current_semester,
            assessment_status='ASSESSMENT_DONE'
        ).count()
        
        return total_courses == done_courses

    def __str__(self) -> str:
        return f"{self.name} ({self.custom_id})"