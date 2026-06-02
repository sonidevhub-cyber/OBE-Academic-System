import uuid
from django.db import models


class Course(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    custom_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    program = models.ForeignKey(
        'core.Program',
        on_delete=models.CASCADE,
        related_name='courses',
    )
    semester = models.ForeignKey(
        'core.Semester',
        on_delete=models.CASCADE,
        related_name='courses',
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=20)
    course_type = models.CharField(
        max_length=10,
        choices=[
            ('LECTURE', 'Lecture'),
            ('LAB', 'Lab'),
        ],
    )
    credit_hours = models.IntegerField(default=3)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    parent_course = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        related_name='lab_courses',
        null=True,
        blank=True,
    )

    def save(self, *args, **kwargs):
        if not self.custom_id:
            self.custom_id = f"CRS-{self.program.code.upper()}-{self.code.upper()}"
        super().save(*args, **kwargs)

    class Meta:
        unique_together = ('program', 'code')

    def __str__(self) -> str:
        return f"{self.name} ({self.custom_id})"