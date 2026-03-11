from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Coordinator, CoordinatorDashboard

@receiver(post_save, sender=Coordinator)
def create_coordinator_dashboard(sender, instance, created, **kwargs):
    """Create dashboard when coordinator is created"""
    if created:
        CoordinatorDashboard.objects.get_or_create(coordinator=instance)

@receiver(post_save, sender=Coordinator)
def update_coordinator_dashboard(sender, instance, **kwargs):
    """Update dashboard metrics when coordinator is updated"""
    dashboard, created = CoordinatorDashboard.objects.get_or_create(coordinator=instance)
    if not created:
        dashboard.update_metrics()