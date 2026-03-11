from django.core.management.base import BaseCommand
from academics.models import Fee, FeeStructure
from students.models import Student
from datetime import date, timedelta

class Command(BaseCommand):
    help = 'Assign fees to existing students based on department fee structures'

    def handle(self, *args, **options):
        # Get all students who don't have fee records
        students_without_fees = Student.objects.filter(
            department__isnull=False,
            semester__isnull=False
        ).exclude(
            fees__isnull=False
        ).distinct()

        created_count = 0
        skipped_count = 0

        for student in students_without_fees:
            try:
                # Check if there's an active fee structure for this department-semester
                fee_structure = FeeStructure.objects.filter(
                    department=student.department,
                    semester=student.semester,
                    is_active=True
                ).first()

                if fee_structure:
                    # Calculate due date (30 days from enrollment or today if no enrollment date)
                    due_date = student.enrollment_date + timedelta(days=30) if student.enrollment_date else date.today() + timedelta(days=30)

                    # Create fee record
                    Fee.objects.create(
                        student=student,
                        department=student.department,
                        semester=student.semester,
                        amount=fee_structure.amount,
                        due_date=due_date,
                        paid_amount=0,
                        status=Fee.UNPAID
                    )
                    created_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(f'Created fee record for student {student.name} ({student.registration_number}) - ${fee_structure.amount}')
                    )
                else:
                    skipped_count += 1
                    self.stdout.write(
                        self.style.WARNING(f'No active fee structure found for student {student.name} in {student.department.name} - {student.semester.name}')
                    )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'Error creating fee for student {student.name}: {e}')
                )

        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {created_count} fee records')
        )
        if skipped_count > 0:
            self.stdout.write(
                self.style.WARNING(f'Skipped {skipped_count} students due to missing fee structures')
            )

        total_students = Student.objects.filter(
            department__isnull=False,
            semester__isnull=False
        ).count()

        total_fees = Fee.objects.count()

        self.stdout.write(
            self.style.SUCCESS(f'Total students with department/semester: {total_students}')
        )
        self.stdout.write(
            self.style.SUCCESS(f'Total fee records: {total_fees}')
        )
