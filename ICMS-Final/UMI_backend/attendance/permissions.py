from rest_framework import permissions
from rbac.services import user_has_permission

class IsInstructorOrAdmin(permissions.BasePermission):
    """Allow access to instructors and admins"""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        if hasattr(request.user, 'instructor_profile'):
            return True

        if request.user.role == 'admin':
            return user_has_permission(request.user, 'manage_attendance')

        return request.user.is_superuser

class IsFacultyOrAdmin(permissions.BasePermission):
    """Allow access to faculty members (instructors, coordinators, HODs) and admins"""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        if hasattr(request.user, 'instructor_profile') or hasattr(request.user, 'coordinator_profile') or hasattr(request.user, 'hod_profile'):
            return True

        if request.user.role == 'admin':
            return user_has_permission(request.user, 'manage_attendance')

        return request.user.is_superuser

class IsAdminOrReadOnly(permissions.BasePermission):
    """Allow read access to authenticated users, write access only to admins"""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        if request.method in permissions.SAFE_METHODS:
            return True
        
        if request.user.role == 'admin':
            return user_has_permission(request.user, 'manage_attendance')
        return request.user.is_superuser

class CanViewAttendanceReports(permissions.BasePermission):
    """Allow access to users who can view attendance reports"""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        if hasattr(request.user, 'coordinator_profile') or hasattr(request.user, 'hod_profile') or hasattr(request.user, 'principal_profile'):
            return True

        if request.user.role == 'admin':
            return user_has_permission(request.user, 'manage_attendance')

        return request.user.is_superuser
