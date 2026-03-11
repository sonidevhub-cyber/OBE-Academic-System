from rest_framework.permissions import BasePermission

class IsAdminUser(BasePermission):
    """
    Admin, principal, director, and hod roles ko allow karega
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if getattr(request.user, 'is_superuser', False):
            return True
        
        return (request.user.is_authenticated and
                (request.user.role in ['super_admin', 'admin', 'principal', 'director', 'hod'] or
                 request.user.has_role('super_admin') or
                 request.user.has_role('admin') or 
                 request.user.has_role('principal') or 
                 request.user.has_role('hod')))

class HasRole(BasePermission):
    """
    Check if user has specific role(s)
    """
    def __init__(self, required_roles):
        self.required_roles = required_roles if isinstance(required_roles, list) else [required_roles]
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        return any(request.user.has_role(role) for role in self.required_roles)

class CanActAsInstructor(BasePermission):
    """
    Check if user can act as instructor (HOD, Coordinator, or Instructor)
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        return (request.user.has_role('instructor') or 
                request.user.has_role('hod') or 
                request.user.has_role('coordinator'))
