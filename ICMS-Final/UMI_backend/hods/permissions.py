from rest_framework.permissions import BasePermission

class IsAdminUser(BasePermission):
    """
    Custom permission to only allow admin users.
    """
    def has_permission(self, request, view):
        return (request.user and request.user.is_authenticated and 
                (request.user.role in ['admin', 'super_admin'] or request.user.is_superuser))

class IsHODUser(BasePermission):
    """
    Custom permission to only allow HOD users.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'hod'

class IsAdminOrHOD(BasePermission):
    """
    Custom permission to allow admin or HOD users.
    """
    def has_permission(self, request, view):
        return (request.user and request.user.is_authenticated and 
                request.user.role in ['admin', 'hod'])