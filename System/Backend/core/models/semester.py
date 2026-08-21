import uuid
from django.db import models
from django.conf import settings


class Semester(models.Model):
    STATUS_ONGOING = 'ONGOING'
    STATUS_AWAITING_EXTERNAL_RESULT = 'AWAITING_EXTERNAL_RESULT'
    STATUS_RESULT_RECEIVED = 'RESULT_RECEIVED'
    STATUS_FINALIZED = 'FINALIZED'

    STATUS_CHOICES = [
        (STATUS_ONGOING, 'Ongoing'),
        (STATUS_AWAITING_EXTERNAL_RESULT, 'Awaiting External Result'),
        (STATUS_RESULT_RECEIVED, 'Result Received'),
        (STATUS_FINALIZED, 'Finalized'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program = models.ForeignKey(
        'core.Program',
        on_delete=models.CASCADE,
        related_name='semesters',
    )
    number = models.IntegerField()
    name = models.CharField(max_length=50)
    status = models.CharField(
        max_length=32,
        choices=STATUS_CHOICES,
        default=STATUS_ONGOING,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('program', 'number')
        ordering = ['number']

    def __str__(self) -> str:
        return f"{self.program.code} - {self.name}"

