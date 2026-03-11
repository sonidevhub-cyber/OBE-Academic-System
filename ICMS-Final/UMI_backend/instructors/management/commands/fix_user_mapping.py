from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from instructors.models import Instructor

User = get_user_model()

class Command(BaseCommand):
    help = 'Fix instructor user mapping for employee 0499515'

    def handle(self, *args, **options):
        try:
            # Find instructor with employee_id 0499515
            instructor = Instructor.objects.get(employee_id='0499515')
            self.stdout.write(f"Found instructor: {instructor.name}")
            
            # Find or create user with employee_id as username
            user, created = User.objects.get_or_create(
                username='0499515',
                defaults={
                    'email': 'awanmudasr004@gmail.com',
                    'role': 'instructor'
                }
            )
            
            if created:
                self.stdout.write(f"Created new user: {user.username}")
            else:
                self.stdout.write(f"Found existing user: {user.username}")
            
            # Link instructor to user
            old_user = instructor.user
            instructor.user = user
            instructor.save()
            
            self.stdout.write(f"Changed user from {old_user.username} to {user.username}")
            
            self.stdout.write(f"Successfully linked instructor {instructor.name} to user {user.username}")
            
        except Instructor.DoesNotExist:
            self.stdout.write("Instructor with employee_id 0499515 not found")
        except Exception as e:
            self.stdout.write(f"Error: {str(e)}")
            
        # Verify the change
        try:
            instructor = Instructor.objects.get(employee_id='0499515')
            self.stdout.write(f"Final check - Instructor linked to user: {instructor.user.username}")
        except:
            pass