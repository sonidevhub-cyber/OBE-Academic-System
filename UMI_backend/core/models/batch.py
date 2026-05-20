import uuid
from django.db import models


class Batch(models.Model):
    SESSION_CHOICES = [
        ('fall', 'Fall'),
        ('spring', 'Spring'),
    ]

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('graduated', 'Graduated'),
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
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.custom_id:
            session_prefix = 'F' if self.session_type == 'fall' else 'S'
            self.custom_id = f"BAT-{self.program.code.upper()}-{self.start_year}-{session_prefix}"
        super().save(*args, **kwargs)

    class Meta:
        unique_together = ('program', 'name')
        ordering = ['-start_year']

    def __str__(self) -> str:
        return f"{self.name} ({self.custom_id})"

