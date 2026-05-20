import uuid
from django.db import models

class Program(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.code})"

class Batch(models.Model):
    SESSION_CHOICES = [
        ('Fall', 'Fall'),
        ('Spring', 'Spring'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name='batches')
    name = models.CharField(max_length=255) # e.g. BSCS-2022
    session_type = models.CharField(max_length=10, choices=SESSION_CHOICES)
    current_semester = models.IntegerField(default=1)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.session_type})"


class Semester(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name='obe_semesters'
    )
    number = models.IntegerField()
    name = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('program', 'number')
        ordering = ['number']

    def __str__(self):
        return f"{self.program.name} - {self.name}"


class Course(models.Model):
    COURSE_TYPE_CHOICES = [
        ('theory', 'Theory'),
        ('lab', 'Lab'),
    ]
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name='obe_courses'
    )
    semester = models.ForeignKey(
        Semester,
        on_delete=models.CASCADE,
        related_name='courses'
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=20)
    description = models.TextField(
        blank=True, null=True
    )
    course_type = models.CharField(
        max_length=10,
        choices=COURSE_TYPE_CHOICES
    )
    credit_hours = models.IntegerField(default=3)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        unique_together = ('program', 'code')
        ordering = ['code']

    def __str__(self):
        return f"{self.code} - {self.name}"
