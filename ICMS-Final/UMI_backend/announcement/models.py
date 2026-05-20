import uuid
from django.db import models
from django.conf import settings

class Announcement(models.Model):
    TYPE_CHOICES = (
        ('announcement', 'Announcement'),
        ('datesheet', 'Date Sheet'),
        ('timetable', 'Time Table'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    content = models.TextField()

    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='announcement')

    file = models.FileField(upload_to='announcements/', null=True, blank=True)
    is_pinned=models.BooleanField(default=False)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='announcements'
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)