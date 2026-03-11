from django.db import models
from hods.models import HOD

class HODFeedbackControl(models.Model):
    hod = models.OneToOneField(HOD, on_delete=models.CASCADE, related_name="feedback_control")
    is_allowed = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.hod.user.username} - Allowed: {self.is_allowed}"