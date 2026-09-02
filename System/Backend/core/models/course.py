import uuid
from django.db import models
from django.core.exceptions import ValidationError


class Course(models.Model):
    OFFERING_COMPULSORY = 'COMPULSORY'
    OFFERING_ELECTIVE = 'ELECTIVE'
    OFFERING_SELECTIVE = 'SELECTIVE'

    OFFERING_TYPE_CHOICES = [
        (OFFERING_COMPULSORY, 'Compulsory'),
        (OFFERING_ELECTIVE, 'Elective'),
        (OFFERING_SELECTIVE, 'Selective'),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

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

    offering_type = models.CharField(
        max_length=15,
        choices=OFFERING_TYPE_CHOICES,
        default=OFFERING_COMPULSORY,
    )

    elective_group = models.ForeignKey(
        'electives.ElectiveGroup',
        on_delete=models.SET_NULL,
        related_name='courses',
        null=True,
        blank=True,
    )

    selective_group = models.ForeignKey(
        'electives.SelectiveGroup',
        on_delete=models.SET_NULL,
        related_name='courses',
        null=True,
        blank=True,
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

    def clean(self):
        if self.offering_type != self.OFFERING_ELECTIVE and self.elective_group_id is not None:
            raise ValidationError({
                'elective_group': 'elective_group can only be set when offering_type is ELECTIVE'
            })

        if self.offering_type != self.OFFERING_SELECTIVE and self.selective_group_id is not None:
            raise ValidationError({
                'selective_group': 'selective_group can only be set when offering_type is SELECTIVE'
            })

        if self.offering_type == self.OFFERING_ELECTIVE and self.selective_group_id is not None:
            raise ValidationError({
                'selective_group': 'selective_group must not be set when offering_type is ELECTIVE'
            })

        if self.offering_type == self.OFFERING_SELECTIVE and self.elective_group_id is not None:
            raise ValidationError({
                'elective_group': 'elective_group must not be set when offering_type is SELECTIVE'
            })

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.code})"

    class Meta:
        unique_together = ('program', 'code')