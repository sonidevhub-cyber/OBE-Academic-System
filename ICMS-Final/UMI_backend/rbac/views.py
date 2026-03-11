from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import RBACPermission, RBACRole, RBACUserPermission, RBACUserRole
from .permissions import IsSAC
from .serializers import (
    JSCUserCreateSerializer,
    JSCUserPermissionsUpdateSerializer,
    JSCUserSerializer,
    RBACPermissionSerializer,
)
from .services import ensure_base_roles, get_user_permission_codes, resolve_user_role_code


User = get_user_model()


class RBACBootstrapMixin:
    def initial(self, request, *args, **kwargs):
        ensure_base_roles()
        return super().initial(request, *args, **kwargs)


class MyRBACProfileView(RBACBootstrapMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'role': resolve_user_role_code(request.user),
            'permissions': get_user_permission_codes(request.user),
        })


class RBACPermissionListView(RBACBootstrapMixin, APIView):
    permission_classes = [IsAuthenticated, IsSAC]

    def get(self, request):
        permissions = RBACPermission.objects.filter(is_active=True).order_by('module', 'code')
        return Response(RBACPermissionSerializer(permissions, many=True).data)


class JSCUserListCreateView(RBACBootstrapMixin, APIView):
    permission_classes = [IsAuthenticated, IsSAC]

    def get(self, request):
        jsc_users = User.objects.filter(rbac_role_assignment__role__code='JSC').distinct().order_by('id')
        return Response(JSCUserSerializer(jsc_users, many=True).data)

    def post(self, request):
        serializer = JSCUserCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(JSCUserSerializer(user).data, status=status.HTTP_201_CREATED)


class JSCUserStatusView(RBACBootstrapMixin, APIView):
    permission_classes = [IsAuthenticated, IsSAC]

    def patch(self, request, user_id: int):
        is_active = request.data.get('is_active')
        if is_active is None:
            return Response({'detail': 'is_active is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        assignment = RBACUserRole.objects.filter(user=target_user).select_related('role').first()
        if not assignment or assignment.role.code != 'JSC':
            return Response({'detail': 'Only JSC users can be modified by SAC.'}, status=status.HTTP_400_BAD_REQUEST)

        target_user.is_active = bool(is_active)
        target_user.save(update_fields=['is_active'])
        assignment.is_active = bool(is_active)
        assignment.save(update_fields=['is_active', 'updated_at'])

        return Response({'detail': 'User status updated.', 'is_active': target_user.is_active})


class JSCUserPermissionsView(RBACBootstrapMixin, APIView):
    permission_classes = [IsAuthenticated, IsSAC]

    def get_target(self, user_id):
        target_user = User.objects.filter(id=user_id).first()
        if not target_user:
            return None, Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        assignment = RBACUserRole.objects.filter(user=target_user).select_related('role').first()
        if not assignment or assignment.role.code != 'JSC':
            return None, Response({'detail': 'Only JSC users are supported.'}, status=status.HTTP_400_BAD_REQUEST)

        return target_user, None

    def get(self, request, user_id: int):
        target_user, error = self.get_target(user_id)
        if error:
            return error

        return Response({
            'user_id': target_user.id,
            'permissions': get_user_permission_codes(target_user),
        })

    def put(self, request, user_id: int):
        target_user, error = self.get_target(user_id)
        if error:
            return error

        serializer = JSCUserPermissionsUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        requested_codes = serializer.validated_data['permissions']

        permission_map = {
            p.code: p for p in RBACPermission.objects.filter(code__in=requested_codes, is_active=True)
        }

        RBACUserPermission.objects.filter(user=target_user).exclude(permission__code__in=requested_codes).delete()

        for code in requested_codes:
            permission = permission_map[code]
            RBACUserPermission.objects.update_or_create(
                user=target_user,
                permission=permission,
                defaults={
                    'granted': True,
                    'assigned_by': request.user,
                },
            )

        return Response({
            'detail': 'Permissions updated.',
            'permissions': get_user_permission_codes(target_user),
        })
