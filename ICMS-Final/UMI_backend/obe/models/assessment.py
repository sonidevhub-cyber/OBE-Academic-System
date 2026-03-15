from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from academics.models import Course
from .clo import CLO


class Assessment(models.Model):
    ASSESSMENT_TYPES = [
        ("quiz", "Quiz"),
        ("assignment", "Assignment"),
        ("midterm", "Mid-term Exam"),
        ("final", "Final Exam"),
        ("project", "Project"),
        ("presentation", "Presentation"),
        ("lab", "Lab Work"),
    ]

    assessment_id = models.AutoField(primary_key=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="obe_assessments")
    title = models.CharField(max_length=200)
    assessment_type = models.CharField(max_length=20, choices=ASSESSMENT_TYPES)
    total_marks = models.FloatField(validators=[MinValueValidator(0.01)])
    weightage = models.FloatField(
        default=1,
        validators=[MinValueValidator(0.0), MaxValueValidator(100.0)],
        help_text="Weightage in percentage (0-100).",
    )
    assessment_date = models.DateField()
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_obe_assessments",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-assessment_date", "title"]

    def __str__(self):
        return f"{self.course.code} - {self.title}"


class AssessmentCLOMapping(models.Model):
    assessment = models.ForeignKey(
        Assessment,
        on_delete=models.CASCADE,
        related_name="clo_mappings",
    )
    clo = models.ForeignKey(
        CLO,
        on_delete=models.CASCADE,
        related_name="assessment_mappings",
    )
    weightage = models.FloatField(
        default=1,
        validators=[MinValueValidator(0.0), MaxValueValidator(100.0)],
        help_text="Weightage in percentage (0-100).",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["assessment", "clo"],
                name="unique_assessment_clo_mapping",
            )
        ]

    def __str__(self):
        return f"{self.assessment} -> {self.clo}"


class StudentAssessment(models.Model):
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="obe_assessments",
    )
    assessment = models.ForeignKey(
        Assessment,
        on_delete=models.CASCADE,
        related_name="student_results",
    )
    obtained_marks = models.FloatField(validators=[MinValueValidator(0.0)])
    evaluated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="evaluated_obe_assessments",
    )
    evaluated_at = models.DateTimeField(auto_now_add=True)
    remarks = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["student", "assessment"],
                name="unique_student_assessment",
            )
        ]

    def __str__(self):
        return f"{self.student} - {self.assessment}"
