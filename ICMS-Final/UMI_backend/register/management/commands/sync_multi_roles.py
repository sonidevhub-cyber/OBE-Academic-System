from django.core.management.base import BaseCommand
from register.multi_role_service import MultiRoleService
from hods.models import HOD
from coordinators.models import Coordinator
from register.models import User

class Command(BaseCommand):
    help = "Sync multi-role state: enable instructor profiles for HODs/Coordinators with flags, disable where unset"

    def handle(self, *args, **options):
        try:
            MultiRoleService.auto_setup_existing_users()
            self.stdout.write(self.style.SUCCESS('Multi-role sync completed (enable pass).'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error during sync: {e}'))

        # Disable instructor role where HOD/Coordinator flag is false
        try:
            # HODs that should not act as instructors
            hods = HOD.objects.filter(can_act_as_instructor=False)
            disabled = 0
            for hod in hods:
                if hod.user.has_role('instructor'):
                    MultiRoleService.disable_instructor_role_for_hod(hod.user)
                    disabled += 1

            # Coordinators that should not act as instructors
            coords = Coordinator.objects.filter(can_act_as_instructor=False)
            for coord in coords:
                if coord.user.has_role('instructor'):
                    MultiRoleService.disable_instructor_role_for_coordinator(coord.user)
                    disabled += 1

            self.stdout.write(self.style.SUCCESS(f'Disabled instructor role for {disabled} user(s)'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error during disable pass: {e}'))
