import uuid
from django.db import models
from django.db.models import Count
from django.utils import timezone


class Batch(models.Model):
    SESSION_CHOICES = [
        ('fall', 'Fall'),
        ('spring', 'Spring'),
    ]

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('graduated', 'Graduated'),
    ]

    GRADUATION_STATUS_CHOICES = [
        ("not_graduating", "Not Graduating"),
        ("in_progress", "In Progress"),
        ("graduated_partial", "Graduated Partial"),
        ("graduated_complete", "Graduated Complete"),
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
    alumni_feedback_enabled = models.BooleanField(default=False)
    alumni_feedback_enabled_at = models.DateTimeField(null=True, blank=True)
    alumni_feedback_due_at = models.DateTimeField(null=True, blank=True)
    graduation_status = models.CharField(
        max_length=20,
        choices=GRADUATION_STATUS_CHOICES,
        default="not_graduating",
    )

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
    def is_graduating_eligible(self):
        return self.current_semester == self.program.total_semesters

    @property
    def is_alumni_feedback_eligible(self):
        return self.status == 'graduated' and bool(self.graduated_at)

    @property
    def pending_exit_survey_count(self):
        from django.contrib.auth import get_user_model
        from students.models import Student
        User = get_user_model()
        
        # Get all students in this batch
        users_in_batch = User.objects.filter(batch=self, role='student')
        pending = 0
        
        for user in users_in_batch:
            # Check if user has a student profile
            try:
                student_profile = Student.objects.get(user=user)
                if not student_profile.exit_survey_submitted:
                    pending +=1
            except Student.DoesNotExist:
                # If no student profile, count as pending
                pending +=1
        
        return pending

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
