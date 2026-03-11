from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from instructors.models import Instructor

User = get_user_model()

class Command(BaseCommand):
    def handle(self, *args, **options):
        # Get the correct user
        user = User.objects.get(username='0499515')
        self.stdout.write(f"User: {user.username} (ID: {user.id})")
        
        # Get instructor
        instructor = Instructor.objects.get(employee_id='0499515')
        self.stdout.write(f"Instructor: {instructor.name} (ID: {instructor.id})")
        self.stdout.write(f"Current user_id: {instructor.user_id}")
        
        # Force update
        instructor.user_id = user.id
        instructor.save()
        
        # Verify
        instructor.refresh_from_db()
        self.stdout.write(f"Updated user_id: {instructor.user_id}")
        self.stdout.write(f"User username: {instructor.user.username}")