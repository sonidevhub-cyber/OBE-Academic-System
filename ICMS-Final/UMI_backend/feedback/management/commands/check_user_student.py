from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from students.models import Student

User = get_user_model()

class Command(BaseCommand):
    help = 'Check if user has student record'

    def add_arguments(self, parser):
        parser.add_argument('user_id', type=int, help='User ID to check')

    def handle(self, *args, **options):
        user_id = options['user_id']
        
        try:
            user = User.objects.get(id=user_id)
            self.stdout.write(f"User found: {user.username} ({user.email})")
            
            try:
                student = Student.objects.get(user=user)
                self.stdout.write(f"Student found: {student.name} (ID: {student.student_id})")
            except Student.DoesNotExist:
                self.stdout.write(self.style.WARNING(f"No student record found for user {user.username}"))
                
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"User with ID {user_id} not found"))