
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from django.contrib.auth import get_user_model
from students.models import Student
from core.models import Batch
from decimal import Decimal

User = get_user_model()

print("=== Simulating AlumniDashboardView ===")
# Let's use the first alumni user
alumni_users = User.objects.filter(role="alumni", is_active=True)
if alumni_users:
    user = alumni_users.first()
    print(f"Using user {user.full_name}")
    
    try:
        student = Student.objects.get(user=user)
        print(f"Found student: {student}")
    except Student.DoesNotExist:
        print("No student profile for this user")
        # Let's try to find any student
        student = Student.objects.filter(is_active=True).first()
        user = student.user if student else None
        if not user:
            print("No students found, exiting")
            exit()
        print(f"Using student {student} instead")
    
    print("\n--- Step 1: Get batch and program ---")
    batch = student.batch or getattr(user, 'batch', None) or getattr(user, 'original_batch', None)
    print(f"Batch: {batch} (id: {batch.id if batch else None})")
    program = batch.program if batch else None
    print(f"Program: {program} (id: {program.id if program else None})")
    
    print("\n--- Step 2: Simulate what dashboard returns ---")
    dashboard_data = {
        "name": student.name,
        "roll_no": student.registration_number,
        "batch_id": str(batch.id) if batch else None,
        "batch": batch.name if batch else "N/A",
        "program_id": str(program.id) if program else None,
        "program": program.name if program else "N/A",
        "graduation_year": "",
        "cgpa": 0.0,
        "completed_courses": 0,
        "current_employer": "",
        "designation": "",
        "transcripts": []
    }
    print("Dashboard data:", dashboard_data)
    
else:
    print("No alumni users found")
