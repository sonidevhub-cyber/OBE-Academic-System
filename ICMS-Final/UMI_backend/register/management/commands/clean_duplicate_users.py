from django.core.management.base import BaseCommand
from django.db import transaction, models
from register.models import User
from instructors.models import Instructor
from students.models import Student

class Command(BaseCommand):
    help = 'Clean duplicate users by email, keeping one per email'

    def handle(self, *args, **options):
        # Find duplicate emails
        duplicates = User.objects.values('email').annotate(count=models.Count('id')).filter(count__gt=1)

        for dup in duplicates:
            email = dup['email']
            users = User.objects.filter(email=email).order_by('date_joined')  # Keep oldest

            # Prefer user with instructor profile, then student, then oldest
            keep_user = None
            for user in users:
                if hasattr(user, 'instructor_profile'):
                    keep_user = user
                    break
                elif hasattr(user, 'student_profile'):
                    keep_user = user
                    break
            if not keep_user:
                keep_user = users.first()

            # Delete others
            users.exclude(id=keep_user.id).delete()

            self.stdout.write(f'Cleaned duplicates for {email}, kept user {keep_user.username}')

        self.stdout.write('Duplicate user cleanup completed.')
