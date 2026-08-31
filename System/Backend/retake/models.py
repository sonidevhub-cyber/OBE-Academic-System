import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import Max
from django.utils.translation import gettext_lazy as _


class CourseRetake(models.Model):
    ATTEMPT_CHOICES = (
        (1, "1st Attempt"),
        (2, "2nd Attempt"),
        (3, "3rd Attempt"),
    )

    STATUS_CHOICES = (
        ("ongoing", "Ongoing"),
        ("passed", "Passed"),
        ("failed_again", "Failed Again"),
        ("dropped", "Dropped"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False) 
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="retakes",
    )
    failed_course = models.ForeignKey(
        "core.Course",
        on_delete=models.CASCADE,
        related_name="retake_records",
    )
    failed_batch = models.ForeignKey(
        "core.Batch",
        on_delete=models.CASCADE,
        related_name="retakes_from_here",
    )
    current_batch = models.ForeignKey(
        "core.Batch",
        on_delete=models.CASCADE,
        related_name="retake_students",
    )
    retake_teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_retakes",
    )
    attempt_number = models.PositiveSmallIntegerField(choices=ATTEMPT_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="ongoing")
    # TODO: GA_REPORT_INTEGRATION - GA report queries should join through CourseRetake
    # and pick MAX(attempt_number) per (student, failed_course) where is_active=True.
    ga_score = models.ForeignKey(
        "obe.CourseGAScore",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="retake_source",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["student", "failed_course", "attempt_number"],
                name="unique_student_course_attempt",
            )
        ]
        indexes = [
            models.Index(fields=["student", "is_active"], name="retake_student_active_idx"),
            models.Index(fields=["retake_teacher", "is_active"], name="retake_teacher_active_idx"),
        ]
        ordering = ["student", "failed_course", "attempt_number"]

    def clean(self):
        super().clean()

        if self.attempt_number and self.attempt_number > 3:
            raise ValidationError({"attempt_number": _("Attempt number cannot exceed 3.")})

        if not self.student_id or not self.failed_course_id or not self.attempt_number:
            return

        # Check if there's already an active ongoing retake
        existing_active_ongoing = CourseRetake.objects.filter(
            student=self.student,
            failed_course=self.failed_course,
            is_active=True,
            status="ongoing"
        )
        if self.pk:
            existing_active_ongoing = existing_active_ongoing.exclude(pk=self.pk)
        
        if existing_active_ongoing.exists():
            raise ValidationError(
                _("Cannot create a new retake: there is already an active ongoing retake for this student and course.")
            )

        current_attempt = None
        if self.pk:
            current_attempt = (
                CourseRetake.objects.filter(pk=self.pk)
                .values_list("attempt_number", flat=True)
                .first()
            )

        # Only enforce sequencing when the attempt number is being introduced/changed.
        if current_attempt == self.attempt_number:
            return

        qs = CourseRetake.objects.filter(
            student=self.student,
            failed_course=self.failed_course,
        )
        if self.pk:
            qs = qs.exclude(pk=self.pk)

        previous_max = qs.aggregate(max_attempt=Max("attempt_number")).get("max_attempt") or 0
        expected_attempt = previous_max + 1

        if self.attempt_number != expected_attempt:
            raise ValidationError(
                {
                    "attempt_number": _(
                        f"Attempt number must be {expected_attempt} for this student and course."
                    )
                }
            )

    @transaction.atomic
    def save(self, *args, **kwargs):
        creating = self._state.adding
        self.full_clean()

        if creating and self.attempt_number > 1:
            CourseRetake.objects.filter(
                student=self.student,
                failed_course=self.failed_course,
                is_active=True,
            ).update(is_active=False)

        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student} - {self.failed_course} (Attempt {self.attempt_number})"


class ReportInvalidationLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False) 
    triggered_by_retake = models.ForeignKey(
        CourseRetake,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invalidation_logs",
    )
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="report_invalidation_logs",
    )
    affected_student_report = models.BooleanField(default=False)
    affected_batch_report = models.BooleanField(default=False)
    triggered_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-triggered_at"]
        indexes = [
            models.Index(fields=["student", "resolved_at"], name="retake_inv_student_idx"),
            models.Index(fields=["triggered_by_retake", "resolved_at"], name="retake_inv_retake_idx"),
        ]

    def __str__(self):
        return f"Invalidation for {self.student} at {self.triggered_at}"


class RetakeAssessmentSnapshot(models.Model):
    retake = models.OneToOneField(
        CourseRetake,
        on_delete=models.CASCADE,
        related_name="assessment_snapshot",
    )
    original_course_id = models.UUIDField()
    original_batch_id = models.UUIDField()
    original_semester_id = models.UUIDField()
    snapshot_data = models.JSONField()
    is_locked = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["retake", "is_locked"]),
        ]

    def __str__(self):
        return f"Snapshot for {self.retake}"        

