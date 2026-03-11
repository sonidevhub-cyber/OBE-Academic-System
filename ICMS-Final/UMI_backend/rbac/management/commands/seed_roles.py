from django.core.management.base import BaseCommand

from rbac.services import ensure_base_roles


class Command(BaseCommand):
    help = 'Seed default RBAC roles and permissions.'

    def handle(self, *args, **options):
        result = ensure_base_roles()
        created_roles = ', '.join(result['created_roles']) or 'none'
        created_permissions = ', '.join(result['created_permissions']) or 'none'

        self.stdout.write(self.style.SUCCESS('RBAC seed completed.'))
        self.stdout.write(f"Created roles: {created_roles}")
        self.stdout.write(f"Created permissions: {created_permissions}")
        self.stdout.write(
            f"SAC permission links created: {result['sac_permissions_synced']}"
        )
