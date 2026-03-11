from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from instructors.models import Instructor
from academics.models import Timetable

User = get_user_model()

class Command(BaseCommand):
    help = 'Check and fix instructor-user mapping'

    def handle(self, *args, **options):
        self.stdout.write("Checking instructor-user mappings...")
        
        # Show all users
        users = User.objects.all()
        self.stdout.write(f"Total users: {users.count()}")
        for user in users:
            self.stdout.write(f"  User: {user.username} (email: {user.email}, role: {getattr(user, 'role', 'N/A')})")
        
        # Show all instructors
        instructors = Instructor.objects.all()
        self.stdout.write(f"\nTotal instructors: {instructors.count()}")
        for instructor in instructors:
            user_email = instructor.user.email if instructor.user else 'No user linked'
            self.stdout.write(f"  Instructor: {instructor.name} (Employee: {instructor.employee_id}) -> User: {user_email}")
        
        # Show timetable assignments
        timetables = Timetable.objects.all()
        self.stdout.write(f"\nTotal timetable entries: {timetables.count()}")
        for tt in timetables[:5]:  # Show first 5
            self.stdout.write(f"  {tt.course.name} -> Instructor: {tt.instructor.name} (ID: {tt.instructor.id})")
        
        # Check for instructor with employee_id matching common test cases
        test_employee_ids = ['0874089', '0499515']
        for emp_id in test_employee_ids:
            try:
                instructor = Instructor.objects.get(employee_id=emp_id)
                user_info = f"User: {instructor.user.email}" if instructor.user else "No user linked"
                timetable_count = Timetable.objects.filter(instructor=instructor).count()
                self.stdout.write(f"\nInstructor {emp_id}: {instructor.name} -> {user_info} (Timetables: {timetable_count})")
            except Instructor.DoesNotExist:
                self.stdout.write(f"\nInstructor with employee_id {emp_id} not found")