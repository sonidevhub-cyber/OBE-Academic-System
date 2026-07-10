
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from django.contrib.auth import get_user_model
from students.models import Student
from core.models import Batch, Program

User = get_user_model()

print("=== Checking Alumni Users ===")
alumni_users = User.objects.filter(role="alumni", is_active=True)
print(f"Found {len(alumni_users)} alumni users:")
for user in alumni_users:
    print(f"\n  - User ID: {user.id}")
    print(f"    Full name: {user.full_name}")
    print(f"    Email: {user.email}")
    print(f"    Batch: {user.batch}")
    print(f"    Original batch: {user.original_batch}")
    print(f"    Program: {user.program_id}")
    
    # Check student profile
    try:
        student = Student.objects.get(user=user)
        print(f"    Student profile found: {student.registration_number}")
        print(f"    Student batch: {student.batch}")
    except Student.DoesNotExist:
        print(f"    No student profile found for this user")


print("\n=== Testing AlumniDashboardView logic ===")
# Let's pick the first alumni user if any
if alumni_users:
    user = alumni_users.first()
    print(f"Testing with user {user.username}")
    
    try:
        student = Student.objects.get(user=user)
        batch = student.batch or user.batch or user.original_batch
        program = batch.program if batch else None
        print(f"  Student: {student}")
        print(f"  Batch: {batch}")
        print(f"  Program: {program}")
    except Student.DoesNotExist:
        print("  No student profile")
else:
    print("No alumni users found, let's check all users:")
    all_users = User.objects.filter(is_active=True)
    for user in all_users:
        print(f"  - {user.username}, role: {user.role}, program: {user.program_id}, batch: {user.batch_id}")
