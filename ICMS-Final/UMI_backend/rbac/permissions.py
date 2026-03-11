from rest_framework.permissions import BasePermission

from .services import resolve_user_role_code, user_has_permission, SAC_ROLE_CODE


class IsSAC(BasePermission):
    message = 'Only SAC can perform this action.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and resolve_user_role_code(request.user) == SAC_ROLE_CODE)


class HasRBACPermission(BasePermission):
    message = 'Missing required permission.'

    def has_permission(self, request, view):
        required_permission = getattr(view, 'required_permission', None)
        if not required_permission:
            return True
        return bool(request.user and request.user.is_authenticated and user_has_permission(request.user, required_permission))
