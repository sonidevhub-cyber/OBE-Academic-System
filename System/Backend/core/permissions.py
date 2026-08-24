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


def _is_hod(user):
    if not user or not user.is_authenticated:
        return False
    return user.role == 'hod' or user.secondary_role == 'hod'


def _is_coordinator(user):
    if not user or not user.is_authenticated:
        return False
    return user.role == 'coordinator' or user.secondary_role == 'coordinator'


def _get_user_department(user):
    """Return the Department the HOD belongs to, or None."""
    profile = getattr(user, 'instructor_profile', None)
    if profile is None:
        try:
            from instructors.models import Instructor
            profile = Instructor.objects.filter(user=user).first()
        except Exception:
            profile = None
    department = getattr(profile, 'department', None)
    if department is not None:
        return department

    try:
        program = (
            user.programs
            .filter(department__isnull=False)
            .select_related('department')
            .first()
        )
        return getattr(program, 'department', None)
    except Exception:
        return None


class CanAccessFrameworkSnapshot(BasePermission):
    """Role-based read access to batch framework snapshots.

    - HOD: can GET any batch whose program belongs to the HOD's department.
      Department scope is derived from user.instructor_profile.department.
    - Coordinator: can GET only batches assigned directly (batch.coordinator == user)
      OR batches whose program is in the coordinator's assigned programs set
      (user.programs M2M).
    - All other roles (SAC, Teacher, Student, Alumni): 403 Forbidden.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return _is_hod(request.user) or _is_coordinator(request.user)

    def has_object_permission(self, request, view, obj):
        from core.models.batch import Batch

        if not isinstance(obj, Batch):
            return False

        user = request.user

        if _is_hod(user):
            dept = _get_user_department(user)
            if dept is None:
                return False
            program = getattr(obj, 'program', None)
            if program is None:
                return False
            return str(getattr(program, 'department_id', None)) == str(getattr(dept, 'id', None))

        if _is_coordinator(user):
            if getattr(obj, 'coordinator_id', None) and str(obj.coordinator_id) == str(user.id):
                return True
            program = getattr(obj, 'program', None)
            if program is not None:
                return user.programs.filter(id=program.id).exists()
            return False

        return False


class IsHODDepartmentOnly(BasePermission):
    """HOD/Coordinator permission, restricted to owned academic scope in queryset.

    Used for list-style endpoints like Batch Dossier Vault.
    The view is responsible for scoping the queryset to HOD department or
    coordinator assigned programs.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return _is_hod(request.user) or _is_coordinator(request.user)


class IsHODOrCoordinator(BasePermission):
    """Simple authenticated role gate for shared HOD/Coordinator read views."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return _is_hod(request.user) or _is_coordinator(request.user)

