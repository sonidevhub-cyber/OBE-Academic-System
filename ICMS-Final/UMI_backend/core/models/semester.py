import uuid
from django.db import models
from django.conf import settings


class Semester(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program = models.ForeignKey(
        'core.Program',
        on_delete=models.CASCADE,
        related_name='semesters',
    )
    number = models.IntegerField()
    name = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('program', 'number')
        ordering = ['number']

    def __str__(self) -> str:
        return f"{self.program.code} - {self.name}"

