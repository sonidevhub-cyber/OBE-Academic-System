from .models import RBACPermission, RBACRole, RBACRolePermission, RBACUserPermission, RBACUserRole


SAC_ROLE_CODE = 'SAC'
JSC_ROLE_CODE = 'JSC'
HOD_ROLE_CODE = 'HOD'
COORDINATOR_ROLE_CODE = 'COORDINATOR'
INSTRUCTOR_ROLE_CODE = 'INSTRUCTOR'
STUDENT_ROLE_CODE = 'STUDENT'
PRINCIPAL_ROLE_CODE = 'PRINCIPAL'


DEFAULT_ROLES = [
    (SAC_ROLE_CODE, 'Super Admin'),
    (JSC_ROLE_CODE, 'Admin'),
    (HOD_ROLE_CODE, 'HOD'),
    (COORDINATOR_ROLE_CODE, 'Coordinator'),
    (INSTRUCTOR_ROLE_CODE, 'Instructor'),
    (STUDENT_ROLE_CODE, 'Student'),
    (PRINCIPAL_ROLE_CODE, 'Principal'),
]


DEFAULT_PERMISSIONS = [
    ('manage_students', 'Create/update student records', 'Student'),
    ('manage_instructors', 'Create/update instructor records', 'Academic'),
    ('manage_departments', 'Create/update departments', 'Management'),
    ('manage_courses', 'Create/update courses', 'Academic'),
    ('manage_clo', 'Define CLOs and map to GAs', 'OBE'),
    ('manage_results', 'Manage and publish results', 'Academic'),
    ('manage_attendance', 'Review attendance reports and edit requests', 'Academic'),
    ('manage_events', 'Create/update events', 'Management'),
    ('manage_announcements', 'Create/update announcements', 'Management'),
    ('manage_hods', 'Create/update HOD accounts', 'Management'),
    ('manage_jsc_users', 'Create/deactivate JSC users', 'Management'),
    ('manage_principals', 'Create/update Principal accounts', 'Management'),
    ('assign_jsc_permissions', 'Assign/revoke JSC permissions', 'Management'),
    ('view_obe_reports', 'View OBE analytics and reports', 'OBE'),
]


def get_user_rbac_role(user):
    assignment = RBACUserRole.objects.filter(user=user, is_active=True, role__is_active=True).select_related('role').first()
    return assignment.role if assignment else None


def resolve_user_role_code(user):
    role = get_user_rbac_role(user)
    if role:
        return role.code
    # Legacy fallback
    if getattr(user, 'is_superuser', False):
        return SAC_ROLE_CODE

    legacy_role = (getattr(user, 'role', '') or '').lower()
    if legacy_role in {'admin', 'super_admin'}:
        return JSC_ROLE_CODE
    return legacy_role.upper()


def get_user_permission_codes(user):
    role_code = resolve_user_role_code(user)
    if role_code == SAC_ROLE_CODE:
        return list(
            RBACPermission.objects.filter(is_active=True)
            .values_list('code', flat=True)
        )

    role = get_user_rbac_role(user)
    role_permissions = []
    if role:
        role_permissions = list(
            RBACPermission.objects.filter(
                permission_roles__role=role,
                permission_roles__role__is_active=True,
                is_active=True,
            ).values_list('code', flat=True)
        )

    direct_permissions = list(
        RBACUserPermission.objects.filter(
            user=user,
            granted=True,
            permission__is_active=True,
        ).values_list('permission__code', flat=True)
    )

    denied_permissions = set(
        RBACUserPermission.objects.filter(
            user=user,
            granted=False,
        ).values_list('permission__code', flat=True)
    )

    effective = set(role_permissions) | set(direct_permissions)
    effective -= denied_permissions

    if effective:
        return sorted(effective)

    # Legacy fallback for existing admin records created before RBAC rollout.
    legacy_role = (getattr(user, 'role', '') or '').lower()
    if legacy_role == 'admin':
        return ['department_management', 'manage_departments']

    return []


def user_has_permission(user, code: str) -> bool:
    if not user or not getattr(user, 'is_authenticated', False):
        return False

    role_code = resolve_user_role_code(user)
    if role_code == SAC_ROLE_CODE:
        return True

    return code in get_user_permission_codes(user)


def seed_default_roles():
    created_codes = []

    for code, name in DEFAULT_ROLES:
        _, created = RBACRole.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'is_system': True,
                'is_active': True,
            },
        )
        if created:
            created_codes.append(code)

    return created_codes


def seed_default_permissions():
    created_codes = []

    for code, description, module in DEFAULT_PERMISSIONS:
        _, created = RBACPermission.objects.get_or_create(
            code=code,
            defaults={
                'description': description,
                'module': module,
                'is_active': True,
            },
        )
        if created:
            created_codes.append(code)

    return created_codes


def ensure_base_roles():
    created_roles = seed_default_roles()
    created_permissions = seed_default_permissions()

    sac_role = RBACRole.objects.get(code=SAC_ROLE_CODE)

    sac_permissions = RBACPermission.objects.filter(is_active=True)
    existing_permission_ids = set(
        sac_role.role_permissions.values_list('permission_id', flat=True)
    )
    missing = [
        permission
        for permission in sac_permissions
        if permission.id not in existing_permission_ids
    ]
    if missing:
        sac_role.role_permissions.bulk_create(
            [
                RBACRolePermission(role=sac_role, permission=permission)
                for permission in missing
            ],
            ignore_conflicts=True,
        )

    return {
        'created_roles': created_roles,
        'created_permissions': created_permissions,
        'sac_permissions_synced': len(missing),
    }


def ensure_superuser_is_sac(user):
    """
    Ensure a Django superuser is explicitly mapped to the SAC RBAC role.
    Safe to call repeatedly.
    """
    if not user or not getattr(user, 'is_superuser', False):
        return False

    ensure_base_roles()
    sac_role = RBACRole.objects.get(code=SAC_ROLE_CODE)

    RBACUserRole.objects.update_or_create(
        user=user,
        defaults={
            'role': sac_role,
            'is_active': True,
            'assigned_by': None,
        },
    )
    return True
