from rest_framework.permissions import BasePermission


class IsSAC(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'SAC')


class IsHOD(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role == 'hod' or request.user.secondary_role == 'hod')
        )


class IsCoordinator(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role == 'coordinator' or request.user.secondary_role == 'coordinator')
        )


class IsInstructor(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ['instructor', 'tvf']
        )


class IsStudent(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'student')


class IsAlumni(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'alumni')


class IsSACOrHOD(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in ['SAC', 'hod'])


class IsSACOrCoordinator(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role in ['SAC', 'coordinator'] or request.user.secondary_role == 'coordinator')
        )

class IsSACOrAssignedCoordinator(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role in ['SAC', 'coordinator'] or request.user.secondary_role == 'coordinator')
        )

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'SAC':
            return True
        
        is_coord = request.user.role == 'coordinator' or request.user.secondary_role == 'coordinator'
        if not is_coord:
            return False
            
        from core.models.program import Program
        if isinstance(obj, Program):
            return obj.coordinators.filter(id=request.user.id).exists()
        return False

