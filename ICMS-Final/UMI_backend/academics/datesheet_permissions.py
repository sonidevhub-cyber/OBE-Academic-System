from rest_framework.permissions import BasePermission


def _get_role(user) -> str:
    if not user or not getattr(user, "is_authenticated", False):
        return ""
    return str(getattr(user, "effective_role", None) or getattr(user, "active_role", None) or getattr(user, "role", "")).lower()


class IsDateSheetCoordinator(BasePermission):
    def has_permission(self, request, view):
        role = _get_role(request.user)
        return role in {"coordinator", "admin", "super_admin"}


class IsDateSheetHOD(BasePermission):
    def has_permission(self, request, view):
        role = _get_role(request.user)
        return role in {"hod", "admin", "super_admin"}


class IsDateSheetStudent(BasePermission):
    def has_permission(self, request, view):
        role = _get_role(request.user)
        return role == "student"


class IsDateSheetAuthenticated(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)
