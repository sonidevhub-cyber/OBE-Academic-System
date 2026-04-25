from rest_framework import permissions
from .models import Instructor
from rbac.services import user_has_permission

class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        # Allow read operations for all authenticated users
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and user_has_permission(request.user, 'manage_instructors')

    def has_object_permission(self, request, view, obj):
        # Allow read operations for all authenticated users
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        # Allow write operations for admin users or the instructor themselves
        return (
            request.user and request.user.is_authenticated and (
                user_has_permission(request.user, 'manage_instructors') or
                (hasattr(obj, 'user') and obj.user == request.user)
            )
        )

class IsInstructorForDepartment(permissions.BasePermission):
    """
    Custom permission to allow instructors to only access their assigned department.
    Admins can access all departments.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Admins can access all departments
        if (request.user.is_staff or
            getattr(request.user, 'role', None) in ['admin', 'principal', 'director']):
            return True

        # Instructors can only access their department
        try:
            instructor = Instructor.objects.get(user=request.user)
            return instructor.department is not None
        except Instructor.DoesNotExist:
            return False


class CanViewInstructors(permissions.BasePermission):
    """
    Allow read-only access to instructors for coordinator/HOD/admin/principal/superuser
    and instructors themselves.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            if getattr(request.user, 'is_superuser', False):
                return True
            role = getattr(request.user, 'role', None)
            if role in ['admin', 'principal']:
                return True
            if hasattr(request.user, 'coordinator_profile') or hasattr(request.user, 'hod_profile') or hasattr(request.user, 'instructor_profile'):
                return True
        return False

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        # Admins can access all departments
        if (request.user.is_staff or
            getattr(request.user, 'role', None) in ['admin', 'principal', 'director']):
            return True

        # Instructors can only access their department
        try:
            instructor = Instructor.objects.get(user=request.user)
            if hasattr(obj, 'department'):
                return obj.department == instructor.department
            return False
        except Instructor.DoesNotExist:
            return False
