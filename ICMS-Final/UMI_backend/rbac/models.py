from django.conf import settings
from django.db import models


class RBACRole(models.Model):
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=64)
    description = models.TextField(blank=True)
    is_system = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'rbac_role'
        ordering = ['code']

    def __str__(self) -> str:
        return self.code


class RBACPermission(models.Model):
    id = models.BigAutoField(primary_key=True)
    code = models.CharField(max_length=64, unique=True)
    description = models.TextField()
    module = models.CharField(max_length=64)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'rbac_permission'
        ordering = ['module', 'code']

    def __str__(self) -> str:
        return self.code


class RBACRolePermission(models.Model):
    role = models.ForeignKey(RBACRole, on_delete=models.CASCADE, related_name='role_permissions')
    permission = models.ForeignKey(RBACPermission, on_delete=models.CASCADE, related_name='permission_roles')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'rbac_role_permission'
        unique_together = ('role', 'permission')

    def __str__(self) -> str:
        return f'{self.role.code}:{self.permission.code}'


class RBACUserRole(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='rbac_role_assignment')
    role = models.ForeignKey(RBACRole, on_delete=models.PROTECT, related_name='assigned_users')
    is_active = models.BooleanField(default=True)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rbac_role_assigned_users',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'rbac_user_role'

    def __str__(self) -> str:
        return f'{self.user.username}:{self.role.code}'


class RBACUserPermission(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='rbac_user_permissions')
    permission = models.ForeignKey(RBACPermission, on_delete=models.CASCADE, related_name='rbac_permission_users')
    granted = models.BooleanField(default=True)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rbac_permission_assigned_users',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'rbac_user_permission'
        unique_together = ('user', 'permission')

    def __str__(self) -> str:
        return f'{self.user.username}:{self.permission.code}:{self.granted}'
