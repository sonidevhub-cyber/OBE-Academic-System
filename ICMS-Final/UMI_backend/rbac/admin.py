from django.contrib import admin

from .models import RBACPermission, RBACRole, RBACRolePermission, RBACUserPermission, RBACUserRole


@admin.register(RBACRole)
class RBACRoleAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'is_system', 'is_active')
    list_filter = ('is_system', 'is_active')
    search_fields = ('code', 'name')


@admin.register(RBACPermission)
class RBACPermissionAdmin(admin.ModelAdmin):
    list_display = ('code', 'module', 'description', 'is_active')
    list_filter = ('module', 'is_active')
    search_fields = ('code', 'description', 'module')


@admin.register(RBACRolePermission)
class RBACRolePermissionAdmin(admin.ModelAdmin):
    list_display = ('role', 'permission')
    search_fields = ('role__code', 'permission__code')


@admin.register(RBACUserRole)
class RBACUserRoleAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'is_active')
    list_filter = ('role__code', 'is_active')
    search_fields = ('user__username', 'user__email', 'role__code')


@admin.register(RBACUserPermission)
class RBACUserPermissionAdmin(admin.ModelAdmin):
    list_display = ('user', 'permission', 'granted')
    list_filter = ('granted', 'permission__module')
    search_fields = ('user__username', 'permission__code')
