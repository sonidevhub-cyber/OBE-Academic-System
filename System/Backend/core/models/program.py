import uuid
from django.db import models
from django.conf import settings


class Program(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    custom_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    department = models.ForeignKey(
        'Department',
        on_delete=models.CASCADE,
        related_name='programs',
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True, null=True)
    total_semesters = models.IntegerField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_programs',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.custom_id:
            self.custom_id = f"PRG-{self.code.upper()}"
        
        # Auto-set CS Department if not provided
        if not self.department:
            try:
                self.department = Department.objects.get(code='CS', is_active=True)
            except Department.DoesNotExist:
                pass
        
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.name} ({self.custom_id})"


# Import Department here to avoid circular import
from core.models.department import Department

