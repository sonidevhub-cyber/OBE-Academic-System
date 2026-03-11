from functools import wraps

from rest_framework.response import Response
from rest_framework import status

from .services import user_has_permission


def require_permission(permission_code: str):
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped(request, *args, **kwargs):
            if not user_has_permission(request.user, permission_code):
                return Response({'detail': 'Forbidden', 'required_permission': permission_code}, status=status.HTTP_403_FORBIDDEN)
            return view_func(request, *args, **kwargs)

        return _wrapped

    return decorator
