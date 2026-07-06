
from django.core.management.base import BaseCommand
from core.models import Batch
from django.contrib.auth import get_user_model
from students.models import Student
import uuid

User = get_user_model()


class Command(BaseCommand):
    help = "Add 20 students to every active batch"

    def handle(self, *args, **options):
        # Get all active batches
        active_batches = Batch.objects.filter(is_active=True)

        if not active_batches.exists():
            self.stdout.write(self.style.WARNING("No active batches found!"))
            return

        for batch in active_batches:
            self.stdout.write(
                self.style.NOTICE(f"Adding 20 students to batch: {batch.name} ({batch.custom_id})")
            )

            # Get count of existing students for registration number uniqueness
            existing_students_in_batch = User.objects.filter(
                batch=batch, role="student"
            ).count()

            for i in range(1, 21):
                student_num = existing_students_in_batch + i
                registration_number = f"{batch.custom_id}-{student_num}"
                email = f"student_{student_num}_{uuid.uuid4().hex[:8]}@eduobe.edu"
                full_name = f"Student {student_num} ({batch.name})"

                try:
                    # Create user
                    user = User.objects.create_user(
                        email=email,
                        full_name=full_name,
                        role="student",
                        batch=batch,
                        current_semester=batch.current_semester,
                    )

                    # Create student profile
                    Student.objects.create(
                        user=user,
                        registration_number=registration_number,
                        name=full_name,
                        department=batch.program,
                        batch=batch,
                    )

                    self.stdout.write(
                        self.style.SUCCESS(f"  Created: {full_name} (reg: {registration_number})")
                    )
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f"  Failed to create student {student_num}: {e}")
                    )

        self.stdout.write(
            self.style.SUCCESS("Done! Students added to all active batches.")
        )

