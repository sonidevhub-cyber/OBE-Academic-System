from django.core.management.base import BaseCommand
from django.db import transaction
from django.apps import apps

class Command(BaseCommand):
    help = 'Migrate existing HOD data from register and instructors apps to hods app'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting HOD data migration...'))
        
        try:
            # Get models
            HODRegistrationRequest = apps.get_model('hods', 'HODRegistrationRequest')
            HOD = apps.get_model('hods', 'HOD')
            
            # Try to get old models if they exist
            try:
                OldHODRegistrationRequest = apps.get_model('register', 'HODRegistrationRequest')
                old_requests = OldHODRegistrationRequest.objects.all()
                
                with transaction.atomic():
                    for old_request in old_requests:
                        # Check if already migrated
                        if not HODRegistrationRequest.objects.filter(
                            email=old_request.email,
                            employee_id=old_request.employee_id
                        ).exists():
                            HODRegistrationRequest.objects.create(
                                name=old_request.name,
                                email=old_request.email,
                                employee_id=old_request.employee_id,
                                phone=old_request.phone,
                                department=old_request.department,
                                designation=old_request.designation,
                                experience_years=old_request.experience_years,
                                specialization=old_request.specialization,
                                password=old_request.password,
                                status=old_request.status,
                                requested_at=old_request.requested_at,
                                reviewed_at=old_request.reviewed_at,
                                reviewed_by=old_request.reviewed_by,
                                rejection_reason=old_request.rejection_reason,
                                hod_request_status=old_request.hod_request_status,
                            )
                            self.stdout.write(
                                self.style.SUCCESS(f'Migrated HOD request: {old_request.name}')
                            )
                
                self.stdout.write(
                    self.style.SUCCESS(f'Successfully migrated {old_requests.count()} HOD registration requests')
                )
                
            except LookupError:
                self.stdout.write(
                    self.style.WARNING('No old HODRegistrationRequest model found in register app')
                )
            
            # Try to migrate HOD records from instructors app
            try:
                OldHOD = apps.get_model('instructors', 'HOD')
                old_hods = OldHOD.objects.all()
                
                with transaction.atomic():
                    for old_hod in old_hods:
                        # Check if already migrated
                        if not HOD.objects.filter(
                            email=old_hod.email,
                            employee_id=old_hod.employee_id
                        ).exists():
                            HOD.objects.create(
                                user=old_hod.user,
                                employee_id=old_hod.employee_id,
                                name=old_hod.name,
                                email=old_hod.email,
                                phone=old_hod.phone,
                                department=old_hod.department,
                                designation=old_hod.designation,
                                hire_date=old_hod.hire_date,
                                date_of_birth=old_hod.date_of_birth,
                                gender=old_hod.gender,
                                specialization=old_hod.specialization,
                                experience_years=old_hod.experience_years,
                                image=old_hod.image,
                                is_active=old_hod.is_active,
                                created_at=old_hod.created_at,
                                updated_at=old_hod.updated_at,
                            )
                            self.stdout.write(
                                self.style.SUCCESS(f'Migrated HOD record: {old_hod.name}')
                            )
                
                self.stdout.write(
                    self.style.SUCCESS(f'Successfully migrated {old_hods.count()} HOD records')
                )
                
            except LookupError:
                self.stdout.write(
                    self.style.WARNING('No old HOD model found in instructors app')
                )
            
            self.stdout.write(self.style.SUCCESS('HOD data migration completed successfully!'))
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Migration failed: {str(e)}')
            )