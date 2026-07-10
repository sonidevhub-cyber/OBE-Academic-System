
import uuid
from django.db import models
from django.utils import timezone
from decimal import Decimal


class SemesterCLOMasterCache(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    program = models.ForeignKey(
        'core.Program',
        on_delete=models.CASCADE,
        related_name='clo_master_caches'
    )
    batch = models.ForeignKey(
        'core.Batch',
        on_delete=models.CASCADE,
        related_name='clo_master_caches',
        null=True,
        blank=True
    )
    semester = models.ForeignKey(
        'core.Semester',
        on_delete=models.CASCADE,
        related_name='clo_master_caches'
    )
    is_fully_compiled = models.BooleanField(default=False)
    total_courses_expected = models.IntegerField(default=0)
    total_courses_finalized = models.IntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('program', 'batch', 'semester')
        ordering = ['-last_updated']

    def __str__(self):
        return f"CLo Master: {self.program} - {self.semester}"


class CourseCLOMasterEntry(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    master_cache = models.ForeignKey(
        SemesterCLOMasterCache,
        on_delete=models.CASCADE,
        related_name='course_entries'
    )
    course_session = models.ForeignKey(
        'obe.CourseSession',
        on_delete=models.CASCADE,
        related_name='clo_master_entries'
    )
    course = models.ForeignKey(
        'core.Course',
        on_delete=models.CASCADE,
        related_name='clo_master_entries'
    )
    clo = models.ForeignKey(
        'obe.CLO',
        on_delete=models.CASCADE,
        related_name='clo_master_entries'
    )
    student = models.ForeignKey(
        'students.Student',
        on_delete=models.CASCADE,
        related_name='clo_master_entries'
    )
    clo_score = models.DecimalField(max_digits=5, decimal_places=2)
    is_kpi_achieved = models.BooleanField()
    finalized_at = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('master_cache', 'course_session', 'clo', 'student')
        ordering = ['finalized_at']

    def __str__(self):
        return f"{self.student} - {self.clo}: {self.clo_score}%"
