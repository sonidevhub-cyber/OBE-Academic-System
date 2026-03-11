from django.db import transaction
from .models import User
from instructors.models import Instructor
from coordinators.models import Coordinator
from hods.models import HOD

class MultiRoleService:
    """Service to manage multi-role functionality for users"""
    
    @staticmethod
    def setup_multi_role_user(user, primary_role, additional_roles=None):
        """Setup a user with multiple roles"""
        with transaction.atomic():
            user.role = primary_role
            user.roles = [primary_role]
            user.active_role = primary_role
            
            if additional_roles:
                for role in additional_roles:
                    if role not in user.roles:
                        user.roles.append(role)
            
            user.save()
            return user
    
    @staticmethod
    def enable_instructor_role_for_hod(hod_user):
        """Enable instructor role for HOD"""
        with transaction.atomic():
            if not hod_user.has_role('instructor'):
                hod_user.add_role('instructor')
                
                # Create instructor profile if doesn't exist
                if not hasattr(hod_user, 'instructor_profile'):
                    hod_profile = hod_user.hod_profile
                    Instructor.objects.create(
                        user=hod_user,
                        employee_id=hod_profile.employee_id,
                        name=hod_profile.name,
                        phone=hod_profile.phone,
                        department=hod_profile.department,
                        designation=f"HOD & Instructor - {hod_profile.designation}",
                        hire_date=hod_profile.hire_date,
                        date_of_birth=hod_profile.date_of_birth,
                        gender=hod_profile.gender,
                        specialization=hod_profile.specialization,
                        experience_years=hod_profile.experience_years,
                        image=hod_profile.image,
                        address=""
                    )
            return True
    
    @staticmethod
    def enable_instructor_role_for_coordinator(coordinator_user):
        """Enable instructor role for Coordinator"""
        with transaction.atomic():
            if not coordinator_user.has_role('instructor'):
                coordinator_user.add_role('instructor')
                
                # Create instructor profile if doesn't exist
                if not hasattr(coordinator_user, 'instructor_profile'):
                    coord_profile = coordinator_user.coordinator_profile
                    Instructor.objects.create(
                        user=coordinator_user,
                        employee_id=coord_profile.employee_id,
                        name=coord_profile.name,
                        phone=coord_profile.phone,
                        department=coord_profile.department,
                        designation=f"Coordinator & Instructor - {coord_profile.designation}",
                        hire_date=coord_profile.hire_date,
                        date_of_birth=coord_profile.date_of_birth,
                        gender=coord_profile.gender,
                        specialization=coord_profile.specialization,
                        experience_years=coord_profile.experience_years,
                        image=coord_profile.image,
                        address=""
                    )
            return True

    @staticmethod
    def disable_instructor_role_for_user(user):
        """Remove instructor role and delete instructor profile if present"""
        with transaction.atomic():
            try:
                if user.has_role('instructor'):
                    # remove from roles list
                    if 'instructor' in user.roles:
                        user.roles.remove('instructor')
                    # if primary role was instructor, fallback to first role or student
                    if user.role == 'instructor':
                        user.role = user.roles[0] if user.roles else 'student'
                    # clear active_role if it was instructor
                    if user.active_role == 'instructor':
                        user.active_role = user.role
                    user.save()

                # Delete instructor profile if exists
                if hasattr(user, 'instructor_profile'):
                    try:
                        user.instructor_profile.delete()
                    except Exception:
                        pass
            except Exception:
                return False
        return True

    @staticmethod
    def disable_instructor_role_for_hod(hod_user):
        return MultiRoleService.disable_instructor_role_for_user(hod_user)

    @staticmethod
    def disable_instructor_role_for_coordinator(coordinator_user):
        return MultiRoleService.disable_instructor_role_for_user(coordinator_user)
    
    @staticmethod
    def switch_user_role(user, new_role):
        """Switch user's active role"""
        if user.has_role(new_role):
            user.active_role = new_role
            user.role = new_role
            if new_role not in user.roles:
                user.roles.append(new_role)
            user.save()
            return True
        return False
    
    @staticmethod
    def get_user_capabilities(user):
        """Get all capabilities based on user's roles"""
        capabilities = {
            'can_teach': False,
            'can_coordinate': False,
            'can_manage_department': False,
            'can_manage_institution': False,
            'available_roles': user.roles,
            'current_role': user.get_current_role()
        }
        
        if user.has_role('instructor'):
            capabilities['can_teach'] = True
        if user.has_role('coordinator'):
            capabilities['can_coordinate'] = True
        if user.has_role('hod'):
            capabilities['can_manage_department'] = True
        if user.has_role('principal') or user.has_role('admin'):
            capabilities['can_manage_institution'] = True
            
        return capabilities
    
    @staticmethod
    def auto_setup_existing_users():
        """Auto-setup existing HODs and Coordinators with instructor roles"""
        with transaction.atomic():
            # Setup HODs
            hods = HOD.objects.filter(can_act_as_instructor=True)
            for hod in hods:
                MultiRoleService.enable_instructor_role_for_hod(hod.user)
            
            # Setup Coordinators
            coordinators = Coordinator.objects.filter(can_act_as_instructor=True)
            for coordinator in coordinators:
                MultiRoleService.enable_instructor_role_for_coordinator(coordinator.user)
