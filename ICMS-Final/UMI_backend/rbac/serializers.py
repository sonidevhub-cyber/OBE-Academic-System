from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import RBACPermission, RBACRole, RBACUserPermission, RBACUserRole
from .services import get_user_permission_codes, resolve_user_role_code


User = get_user_model()


class RBACPermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RBACPermission
        fields = ['id', 'code', 'description', 'module', 'is_active']


class JSCUserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'is_active', 'role', 'permissions']

    def get_role(self, obj):
        return resolve_user_role_code(obj)

    def get_permissions(self, obj):
        return get_user_permission_codes(obj)


class JSCUserCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    permissions = serializers.ListField(child=serializers.CharField(), required=False)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Username already exists.')
        return value

    def create(self, validated_data):
        permissions = validated_data.pop('permissions', [])
        request_user = self.context['request'].user

        jsc_role = RBACRole.objects.get(code='JSC')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            role='admin',
            is_active=True,
        )

        RBACUserRole.objects.update_or_create(
            user=user,
            defaults={'role': jsc_role, 'is_active': True, 'assigned_by': request_user},
        )

        if permissions:
            permission_objs = RBACPermission.objects.filter(code__in=permissions, is_active=True)
            existing = {p.permission_id: p for p in RBACUserPermission.objects.filter(user=user, permission__in=permission_objs)}
            for perm in permission_objs:
                if perm.id in existing:
                    up = existing[perm.id]
                    up.granted = True
                    up.assigned_by = request_user
                    up.save(update_fields=['granted', 'assigned_by', 'updated_at'])
                else:
                    RBACUserPermission.objects.create(user=user, permission=perm, granted=True, assigned_by=request_user)

        return user


class JSCUserPermissionsUpdateSerializer(serializers.Serializer):
    permissions = serializers.ListField(child=serializers.CharField(), allow_empty=True)

    def validate_permissions(self, value):
        valid_codes = set(RBACPermission.objects.filter(is_active=True).values_list('code', flat=True))
        unknown = [code for code in value if code not in valid_codes]
        if unknown:
            raise serializers.ValidationError(f'Unknown permissions: {unknown}')
        return value
