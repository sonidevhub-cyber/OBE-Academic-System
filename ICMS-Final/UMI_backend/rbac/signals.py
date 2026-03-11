from django.contrib.auth import get_user_model
from django.db.models.signals import post_migrate
from django.db.models.signals import post_save
from django.dispatch import receiver

from .services import ensure_base_roles, ensure_superuser_is_sac


User = get_user_model()


@receiver(post_migrate)
def seed_rbac_defaults(sender, **kwargs):
    """
    Seed baseline RBAC roles and permissions after migrations.
    Safe to run repeatedly because the service uses get_or_create.
    """
    ensure_base_roles()


@receiver(post_save, sender=User)
def sync_superuser_rbac_role(sender, instance, **kwargs):
    """
    Bootstrap the first system operator cleanly:
    every Django superuser is explicitly linked to SAC in RBAC.
    """
    ensure_superuser_is_sac(instance)
