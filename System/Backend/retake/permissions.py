from rest_framework.permissions import BasePermission


def is_sac(user):
    return bool(user and user.is_authenticated and user.role == "SAC")


def is_coordinator(user):
    return bool(
        user
        and user.is_authenticated
        and (user.role == "coordinator" or getattr(user, "secondary_role", None) == "coordinator")
    )


def is_hod(user):
    return bool(
        user
        and user.is_authenticated
        and (user.role == "hod" or getattr(user, "secondary_role", None) == "hod")
    )


def is_teacher(user):
    return bool(
        user
        and user.is_authenticated
        and user.role in {"instructor", "tvf", "Teacher"}
    )


class IsCoordinatorOrSAC(BasePermission):
    def has_permission(self, request, view):
        return is_sac(request.user) or is_coordinator(request.user)


class IsSACOnly(BasePermission):
    def has_permission(self, request, view):
        return is_sac(request.user)


class IsTeacherOrOversight(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (is_teacher(request.user) or is_hod(request.user) or is_coordinator(request.user) or is_sac(request.user)))


class IsStudentSelfOrOversight(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)
