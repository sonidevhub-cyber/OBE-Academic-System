from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import HODRegistrationRequest

@receiver([post_save, post_delete], sender=HODRegistrationRequest)
def hod_request_changed(sender, instance=None, **kwargs):
    # Signal handler for HOD registration request changes
    # WebSocket functionality can be added later if needed
    pass