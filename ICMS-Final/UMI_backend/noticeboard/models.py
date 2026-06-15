from django.db import models
from django.conf import settings

class Notice(models.Model):

    NOTICE_TYPES = [
        ('announcement', 'Announcement'),
        ('datesheet', 'Date Sheet'),
        ('timetable', 'Time Table'),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    notice_type = models.CharField(
        max_length=20,
        choices=NOTICE_TYPES
    )

    file = models.FileField(upload_to='notices/', null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title