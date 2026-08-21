# feedback/models.py

from django.db import models
from students.models import Student
from core.models import Course
from core.models import Batch, Semester
from obe.models import CLO


class FeedbackSession(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE)
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE)

    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.course} - {self.batch}"


class FeedbackResponse(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    clo = models.ForeignKey(CLO, on_delete=models.CASCADE)

    rating = models.IntegerField()  # 1–5

    batch = models.ForeignKey(Batch, on_delete=models.CASCADE)
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE)

    created_at = models.DateTimeField(auto_now_add=True)


class IndirectCLOAttainment(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    clo = models.ForeignKey(CLO, on_delete=models.CASCADE)

    batch = models.ForeignKey(Batch, on_delete=models.CASCADE)
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE)

    attained_percentage = models.FloatField()

    class Meta:
        unique_together = ['course', 'clo', 'batch', 'semester']
from django.db import models

class FeedbackControl(models.Model):
    enabled = models.BooleanField(default=False)

    def __str__(self):
        return f"Feedback Enabled: {self.enabled}"   
from django.conf import settings

class FeedbackCQI(models.Model):

    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("IMPLEMENTED", "Implemented"),
    ]

    SOURCE_CHOICES = [
        ("INSTRUCTOR", "Instructor"),
        ("COORDINATOR", "Coordinator"),
    ]

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE
    )

    clo = models.ForeignKey(
        CLO,
        on_delete=models.CASCADE
    )

    batch = models.ForeignKey(
        Batch,
        on_delete=models.CASCADE
    )

    semester = models.ForeignKey(
        Semester,
        on_delete=models.CASCADE
    )

    source = models.CharField(
        max_length=20,
        choices=SOURCE_CHOICES
    )

    root_cause = models.TextField()

    remedial_action = models.TextField()

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="PENDING"
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    implemented_batch = models.ForeignKey(
        Batch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="implemented_feedback_cqi"
    )

    def __str__(self):
        return f"{self.course} - {self.clo}"         