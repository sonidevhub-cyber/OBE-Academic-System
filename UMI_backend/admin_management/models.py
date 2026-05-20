from django.db import models
from django.conf import settings

class AdminProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='admin_profile')
    employee_id = models.CharField(max_length=50, unique=True)
    phone = models.CharField(max_length=20, blank=True)
    image = models.ImageField(upload_to='admin_profiles/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.full_name} ({self.employee_id})"
