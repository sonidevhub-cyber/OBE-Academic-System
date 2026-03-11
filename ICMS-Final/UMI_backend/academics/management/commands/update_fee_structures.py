from django.core.management.base import BaseCommand
from academics.models import FeeStructure, Department, Semester

class Command(BaseCommand):
    help = 'Update all FeeStructure records to have amount 30000'

    def handle(self, *args, **options):
        # Update all existing FeeStructure records to 30000
        updated_count = FeeStructure.objects.update(amount=30000.00)
        self.stdout.write(
            self.style.SUCCESS(f'Successfully updated {updated_count} existing FeeStructure records to $30,000')
        )

        # Create FeeStructure records for any department-semester combinations that don't have one
        departments = Department.objects.all()
        created_count = 0

        for department in departments:
            semesters = Semester.objects.filter(department=department)
            for semester in semesters:
                fee_structure, created = FeeStructure.objects.get_or_create(
                    department=department,
                    semester=semester,
                    defaults={
                        'amount': 30000.00,
                        'description': f'Fee structure for {department.name} - {semester.name}'
                    }
                )
                if created:
                    created_count += 1

        if created_count > 0:
            self.stdout.write(
                self.style.SUCCESS(f'Created {created_count} new FeeStructure records with $30,000')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS('All department-semester combinations already have FeeStructure records')
            )

        total_count = FeeStructure.objects.count()
        self.stdout.write(
            self.style.SUCCESS(f'Total FeeStructure records: {total_count} (all set to $30,000)')
        )
