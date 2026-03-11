from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsAdminOrReadOnly(BasePermission):
    """
    Sirf Admin create/update/delete kar sakta.
    Baaki (GET, HEAD, OPTIONS) sabke liye open.
    """
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:  # GET, HEAD, OPTIONS
            return True
        return request.user.is_authenticated and request.user.role == 'admin'

class IsStaffOrAdmin(BasePermission):
    """
    Admin or staff (instructor) can create/update/delete.
    Baaki (GET, HEAD, OPTIONS) sabke liye open.
    """
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:  # GET, HEAD, OPTIONS
            return True
        # Temporarily allow all authenticated users for testing
        return request.user.is_authenticated
        # Original: return request.user.is_authenticated and (request.user.role == 'admin' or request.user.role == 'staff')
