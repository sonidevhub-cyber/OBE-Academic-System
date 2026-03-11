from rest_framework import permissions

class IsInstructorOrAdmin(permissions.BasePermission):
    """Allow access to instructors and admins"""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        return (
            request.user.is_superuser or
            request.user.role == 'admin' or
            hasattr(request.user, 'instructor_profile')
        )

class IsFacultyOrAdmin(permissions.BasePermission):
    """Allow access to faculty members (instructors, coordinators, HODs) and admins"""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        return (
            request.user.is_superuser or
            request.user.role == 'admin' or
            hasattr(request.user, 'instructor_profile') or
            hasattr(request.user, 'coordinator_profile') or
            hasattr(request.user, 'hod_profile')
        )

class IsAdminOrReadOnly(permissions.BasePermission):
    """Allow read access to authenticated users, write access only to admins"""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        if request.method in permissions.SAFE_METHODS:
            return True
        
        return request.user.is_superuser or request.user.role == 'admin'

class CanViewAttendanceReports(permissions.BasePermission):
    """Allow access to users who can view attendance reports"""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        return (
            request.user.is_superuser or
            request.user.role == 'admin' or
            hasattr(request.user, 'coordinator_profile') or
            hasattr(request.user, 'hod_profile') or
            hasattr(request.user, 'principal_profile')
        )