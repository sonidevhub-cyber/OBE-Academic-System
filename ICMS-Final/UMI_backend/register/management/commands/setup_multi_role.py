from django.core.management.base import BaseCommand
from django.db import transaction
from register.models import User

class Command(BaseCommand):
    help = 'Setup multi-role system for existing users'

    def handle(self, *args, **options):
        with transaction.atomic():
            users_updated = 0
            for user in User.objects.all():
                if not user.roles:
                    user.roles = [user.role] if user.role else []
                    user.active_role = user.role
                    user.save()
                    users_updated += 1
                    self.stdout.write(f"Updated user {user.username} with role {user.role}")
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'Multi-role system setup completed: {users_updated} users updated'
                )
            )