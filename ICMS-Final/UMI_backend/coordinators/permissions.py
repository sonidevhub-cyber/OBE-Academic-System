from rest_framework import permissions

def _get_coordinator_for_user(user):
    if hasattr(user, 'coordinator_profile'):
        return user.coordinator_profile

    try:
        from .models import Coordinator
        return Coordinator.objects.get(user=user)
    except Exception:
        pass

    employee_id = None
    if hasattr(user, 'instructor_profile'):
        employee_id = user.instructor_profile.employee_id
    else:
        try:
            from instructors.models import Instructor
            instructor = Instructor.objects.get(user=user)
            employee_id = instructor.employee_id
        except Exception:
            employee_id = None

    if employee_id:
        try:
            from .models import Coordinator
            return Coordinator.objects.get(employee_id=employee_id)
        except Exception:
            return None

    return None

class IsCoordinator(permissions.BasePermission):
    """
    Custom permission to only allow coordinators to access coordinator views.
    """
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # Check if user has coordinator role directly
        if request.user.has_role('coordinator') if hasattr(request.user, 'has_role') else request.user.role == 'coordinator':
            return True
        
        # Check if user has coordinator access via multi-role (instructor who is also coordinator)
        if _get_coordinator_for_user(request.user):
            return True
        
        return False

class IsHODOrCoordinator(permissions.BasePermission):
    """
    Custom permission to allow HODs and coordinators to access certain views.
    """
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # Check if user is HOD
        if request.user.has_role('hod') if hasattr(request.user, 'has_role') else request.user.role == 'hod':
            return True
        
        # Check if user has coordinator role directly
        if request.user.has_role('coordinator') if hasattr(request.user, 'has_role') else request.user.role == 'coordinator':
            return True
        
        # Check if user has coordinator access via multi-role
        if _get_coordinator_for_user(request.user):
            return True
        
        return False

class IsHODForCoordinatorManagement(permissions.BasePermission):
    """
    Custom permission for HOD to manage coordinators in their department.
    """
    
    def has_permission(self, request, view):
        return request.user.is_authenticated and (request.user.has_role('hod') if hasattr(request.user, 'has_role') else request.user.role == 'hod')
    
    def has_object_permission(self, request, view, obj):
        if request.user.has_role('hod') if hasattr(request.user, 'has_role') else request.user.role == 'hod':
            pass
        else:
            return False
        
        try:
            from hods.models import HOD
            hod = HOD.objects.get(user=request.user)
            
            # Check if coordinator belongs to HOD's department
            if hasattr(obj, 'department'):
                return obj.department == hod.department
            elif hasattr(obj, 'coordinator'):
                return obj.coordinator.department == hod.department
            
            return False
        except HOD.DoesNotExist:
            return False

class CanActAsInstructor(permissions.BasePermission):
    """
    Custom permission for coordinators who can also act as instructors.
    """
    
    def has_permission(self, request, view):
        if not (request.user.is_authenticated and (request.user.has_role('coordinator') if hasattr(request.user, 'has_role') else request.user.role == 'coordinator')):
            return False
        
        coordinator = _get_coordinator_for_user(request.user)
        return bool(coordinator and coordinator.can_act_as_instructor)
