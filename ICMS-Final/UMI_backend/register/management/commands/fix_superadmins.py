from django.core.management.base import BaseCommand
from register.models import User
from rbac.services import ensure_superuser_is_sac

class Command(BaseCommand):
    help = "Normalize Django superusers and explicitly assign them the SAC RBAC role."

    def handle(self, *args, **options):
        qs = User.objects.filter(is_superuser=True)
        count = 0
        for u in qs:
            changed = False
            if u.role != 'super_admin':
                u.role = 'super_admin'
                changed = True
            if u.active_role != 'super_admin':
                u.active_role = 'super_admin'
                changed = True
            if not u.is_staff:
                u.is_staff = True
                changed = True
            if changed:
                u.save()
            ensure_superuser_is_sac(u)
            count += 1
        self.stdout.write(self.style.SUCCESS(f'Normalized {count} superuser(s) to SAC.'))
