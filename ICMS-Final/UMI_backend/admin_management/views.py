from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from register.models import User
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.db import models
import os

from rbac.models import RBACPermission, RBACRole, RBACUserPermission, RBACUserRole
from rbac.services import ensure_base_roles, get_user_permission_codes, ensure_superuser_is_sac, user_has_permission, JSC_ROLE_CODE
from register.access_control import get_user_assigned_department_id, is_department_scoped_admin
from .models import AdminProfile
from register.identifiers import generate_employee_id


LEGACY_TO_RBAC = {
    'department_management': 'manage_departments',
    'course_management': 'manage_courses',
    'results_management': 'manage_results',
    'attendance_management': 'manage_attendance',
    'user_management': 'manage_jsc_users',
    'reports_access': 'view_obe_reports',
    'announcement_management': 'manage_announcements',
    'event_management': 'manage_events',
    'student_management': 'manage_students',
    'instructor_management': 'manage_instructors',
    'hod_management': 'manage_hods',
    'principal_management': 'manage_principals',
    'jsc_permissions': 'assign_jsc_permissions',
    'clo_management': 'manage_clo',
}

RBAC_TO_LEGACY = {v: k for k, v in LEGACY_TO_RBAC.items()}

LEGACY_BUNDLES = {
    # Keep old "all-in-one" options functional in the new RBAC model
    'department_management': [
        'manage_departments',
        'manage_courses',
        'manage_students',
        'manage_instructors',
        'manage_attendance',
        'manage_results',
        'manage_announcements',
        'manage_events',
        'view_obe_reports',
        'manage_clo',
    ],
    'user_management': [
        'manage_students',
        'manage_instructors',
        'manage_hods',
        'manage_jsc_users',
    ],
}


def _normalize_permission_codes(permission_codes):
    normalized = []
    for code in permission_codes or []:
        if code in LEGACY_BUNDLES:
            for bundled_code in LEGACY_BUNDLES[code]:
                if bundled_code not in normalized:
                    normalized.append(bundled_code)
            continue
        mapped = LEGACY_TO_RBAC.get(code, code)
        if mapped not in normalized:
            normalized.append(mapped)
    return normalized


def _legacy_permissions_for_ui(permission_codes):
    # Keep old UI compatible while backend stores canonical RBAC codes.
    legacy = []
    for code in permission_codes or []:
        legacy_code = RBAC_TO_LEGACY.get(code, code)
        if legacy_code not in legacy:
            legacy.append(legacy_code)
    return legacy


def _get_admin_role(user):
    if getattr(user, 'is_superuser', False):
        return 'super_admin'
    try:
        admin_profile = getattr(user, 'admin_profile', None)
        if admin_profile and getattr(admin_profile, 'department_id', None):
            return 'department_admin'
    except Exception:
        pass
    return 'admin'


def _get_department_info(user):
    try:
        admin_profile = getattr(user, 'admin_profile', None)
        if admin_profile and admin_profile.department_id:
            from academics.models import Department
            dept = Department.objects.filter(pk=admin_profile.department_id).first()
            if dept:
                return {'id': dept.pk, 'name': getattr(dept, 'name', f'Department {dept.pk}')}
            return {'id': admin_profile.department_id, 'name': f'Department {admin_profile.department_id}'}
    except Exception:
        pass
    return {'name': 'All Departments'}


def _enforce_permission(request, permission_code: str):
    if not user_has_permission(request.user, permission_code):
        return Response(
            {'error': 'Forbidden', 'required_permission': permission_code},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def _assign_admin_profile(user, department_id):
    if department_id:
        AdminProfile.objects.update_or_create(
            user=user,
            defaults={'department_id': int(department_id)},
        )
    else:
        AdminProfile.objects.filter(user=user).delete()


def _assign_rbac_role(user, role_code: str, assigned_by):
    role = RBACRole.objects.filter(code=role_code, is_active=True).first()
    if not role:
        return
    RBACUserRole.objects.update_or_create(
        user=user,
        defaults={
            'role': role,
            'is_active': True,
            'assigned_by': assigned_by,
        },
    )

class AdminViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        permission_error = _enforce_permission(request, 'manage_jsc_users')
        if permission_error:
            return permission_error

        ensure_base_roles()
        admins = User.objects.filter(role='admin')
        if is_department_scoped_admin(request.user):
            assigned_department_id = get_user_assigned_department_id(request.user)
            admins = admins.filter(admin_profile__department_id=assigned_department_id)
        data = []
        for admin in admins:
            role = _get_admin_role(admin)
            department_info = _get_department_info(admin)
            
            # Get profile image URL
            image_url = None
            if hasattr(admin, 'profile_image') and admin.profile_image:
                try:
                    image_url = request.build_absolute_uri(admin.profile_image.url)
                    print(f'Admin {admin.username} image URL: {image_url}')
                except Exception as e:
                    print(f'Error building image URL for {admin.username}: {e}')
                    image_url = admin.profile_image.url
            else:
                print(f'Admin {admin.username} has no profile image')
            
            data.append({
                'id': admin.id,
                'name': admin.name or f"{admin.first_name} {admin.last_name}",
                'email': admin.email,
                'employee_id': admin.username,
                'role': role,
                'status': 'active' if admin.is_active else 'inactive',
                'permissions': get_user_permission_codes(admin),
                'created_at': admin.date_joined.isoformat(),
                'last_login': admin.last_login.isoformat() if admin.last_login else None,
                'department': department_info,
                'department_id': department_info.get('id') if isinstance(department_info, dict) else None,
                'image': image_url
            })
        return Response({'data': data})
    
    def create(self, request):
        permission_error = _enforce_permission(request, 'manage_jsc_users')
        if permission_error:
            return permission_error

        data = request.data
        try:
            ensure_base_roles()
            email = str(data.get('email', '')).strip()
            password = data.get('password')
            name = str(data.get('name', '')).strip()

            validation_errors = {}
            if not email:
                validation_errors['email'] = ['Email is required.']
            if not password:
                validation_errors['password'] = ['Password is required.']
            if not name:
                validation_errors['name'] = ['Name is required.']

            if email and User.objects.filter(email=email).exists():
                validation_errors['email'] = ['An admin with this email already exists.']

            if validation_errors:
                return Response(
                    {
                        'message': 'Validation failed.',
                        'errors': validation_errors,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            requested_role = data.get('role') or 'admin'
            if requested_role == 'super_admin' and not user_has_permission(request.user, 'manage_jsc_users'):
                return Response(
                    {'error': 'Forbidden: Only SAC can create super admins.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

            requested_permissions = data.get('permissions', [])
            if requested_permissions and not user_has_permission(request.user, 'assign_jsc_permissions'):
                return Response(
                    {'error': 'Forbidden', 'required_permission': 'assign_jsc_permissions'},
                    status=status.HTTP_403_FORBIDDEN,
                )

            department_id = data.get('department_id')
            if isinstance(department_id, str) and not department_id.strip():
                department_id = None
            if requested_role == 'department_admin' and not department_id:
                return Response(
                    {'error': 'Department is required for department admin.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if is_department_scoped_admin(request.user):
                assigned_department_id = get_user_assigned_department_id(request.user)
                if not assigned_department_id:
                    return Response({'error': 'Department assignment required.'}, status=status.HTTP_403_FORBIDDEN)
                if department_id and int(department_id) != int(assigned_department_id):
                    return Response({'error': 'Forbidden: You can only assign your own department.'}, status=status.HTTP_403_FORBIDDEN)
                department_id = assigned_department_id

            id_role = 'super_admin' if requested_role == 'super_admin' else 'admin'
            employee_id = generate_employee_id(id_role)

            user = User.objects.create_user(
                username=employee_id,
                email=email,
                password=password,
                first_name=name.split(' ')[0],
                last_name=' '.join(name.split(' ')[1:]),
                name=name,
                role='admin',
                is_active=data.get('status') == 'active',
                is_staff=True,
                is_superuser=requested_role == 'super_admin'
            )
            user.employee_id = employee_id
            user.save(update_fields=['employee_id'])

            if requested_role == 'super_admin':
                ensure_superuser_is_sac(user)
            else:
                _assign_rbac_role(user, JSC_ROLE_CODE, request.user)

            _assign_admin_profile(user, department_id)

            if requested_permissions:
                canonical_codes = _normalize_permission_codes(requested_permissions)
                permission_map = {
                    p.code: p
                    for p in RBACPermission.objects.filter(code__in=canonical_codes, is_active=True)
                }
                for code in canonical_codes:
                    permission = permission_map.get(code)
                    if permission:
                        RBACUserPermission.objects.update_or_create(
                            user=user,
                            permission=permission,
                            defaults={'granted': True, 'assigned_by': request.user},
                        )

            return Response(
                {
                    'message': 'Admin created successfully',
                    'id': user.id,
                    'employee_id': user.employee_id,
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response(
                {
                    'message': 'Failed to create admin.',
                    'error': str(e),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
    
    def update(self, request, pk=None):
        permission_error = _enforce_permission(request, 'manage_jsc_users')
        if permission_error:
            return permission_error

        try:
            ensure_base_roles()
            user = User.objects.get(id=pk)
            data = request.data
            requested_permissions = data.get('permissions', None)
            if requested_permissions is not None:
                canonical_codes = _normalize_permission_codes(requested_permissions)
                current_codes = set(get_user_permission_codes(user))
                if set(canonical_codes) != current_codes and not user_has_permission(request.user, 'assign_jsc_permissions'):
                    return Response(
                        {'error': 'Forbidden', 'required_permission': 'assign_jsc_permissions'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
            
            print(f"Updating user {pk} with data: {data}")  # Debug log
            
            if 'name' in data:
                user.name = data['name']
                name_parts = data['name'].split(' ')
                user.first_name = name_parts[0]
                user.last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''
            
            if 'email' in data:
                user.email = data['email']
            
            # Employee ID is system-generated; ignore manual updates.
            
            if 'password' in data and data['password']:
                user.set_password(data['password'])
            
            if 'status' in data:
                user.is_active = data['status'] == 'active'
            
            if 'is_active' in data:
                user.is_active = data['is_active']
            
            # Handle department assignment
            department_name = 'All Departments'
            department_id = data.get('department_id') if 'department_id' in data else None
            if isinstance(department_id, str) and not department_id.strip():
                department_id = None
            if is_department_scoped_admin(request.user):
                assigned_department_id = get_user_assigned_department_id(request.user)
                if not assigned_department_id:
                    return Response({'error': 'Department assignment required.'}, status=status.HTTP_403_FORBIDDEN)
                if department_id and int(department_id) != int(assigned_department_id):
                    return Response({'error': 'Forbidden: You can only assign your own department.'}, status=status.HTTP_403_FORBIDDEN)
                department_id = assigned_department_id

            if department_id:
                try:
                    from academics.models import Department
                    dept = Department.objects.get(pk=department_id)
                    department_name = getattr(dept, 'name', f'Department {dept.pk}')
                except Exception as e:
                    print(f"Department assignment error: {e}")
            if 'department_id' in data or is_department_scoped_admin(request.user):
                _assign_admin_profile(user, department_id)
            
            # Determine role for response
            response_role = 'admin'  # Default
            if 'role' in data:
                response_role = data['role']
                if data['role'] == 'super_admin':
                    user.is_superuser = True
                    user.is_staff = True
                    user.role = 'admin'
                    if 'department_id' not in data:
                        _assign_admin_profile(user, None)
                elif data['role'] == 'admin':
                    user.is_superuser = False
                    user.is_staff = True
                    user.role = 'admin'
                    if 'department_id' not in data:
                        _assign_admin_profile(user, None)
                elif data['role'] == 'department_admin':
                    user.is_superuser = False
                    user.is_staff = False
                    user.role = 'admin'
                    if department_id is None:
                        existing_department_id = getattr(getattr(user, 'admin_profile', None), 'department_id', None)
                        if not existing_department_id:
                            return Response(
                                {'error': 'Department is required for department admin.'},
                                status=status.HTTP_400_BAD_REQUEST,
                            )
            
            user.save()

            if user.is_superuser:
                ensure_superuser_is_sac(user)
            else:
                _assign_rbac_role(user, JSC_ROLE_CODE, request.user)

            # Persist permission updates into RBAC direct user permissions.
            if requested_permissions is not None:
                canonical_codes = _normalize_permission_codes(requested_permissions)

                permission_map = {
                    p.code: p
                    for p in RBACPermission.objects.filter(code__in=canonical_codes, is_active=True)
                }

                RBACUserPermission.objects.filter(user=user).delete()
                for code in canonical_codes:
                    permission = permission_map.get(code)
                    if permission:
                        RBACUserPermission.objects.create(
                            user=user,
                            permission=permission,
                            granted=True,
                            assigned_by=request.user,
                        )

            current_permissions = get_user_permission_codes(user)
            print(f"User {pk} updated successfully")  # Debug log
            # Get image URL for response with cache buster
            image_url = None
            if hasattr(user, 'profile_image') and user.profile_image:
                try:
                    base_url = request.build_absolute_uri(user.profile_image.url)
                    import time
                    cache_buster = int(time.time())
                    image_url = f"{base_url}?v={cache_buster}"
                except:
                    image_url = user.profile_image.url
            
            return Response({
                'message': 'Admin updated successfully',
                'admin': {
                    'id': user.id,
                    'name': user.name,
                    'email': user.email,
                    'role': response_role,
                    'status': 'active' if user.is_active else 'inactive',
                    'permissions': current_permissions,
                    'department': {'id': department_id, 'name': department_name} if department_id else {'name': department_name},
                    'department_id': department_id,
                    'image': image_url
                }
            })
        except User.DoesNotExist:
            return Response({'error': 'Admin not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Error updating user {pk}: {str(e)}")  # Debug log
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def delete_admin(self, request, pk=None):
        permission_error = _enforce_permission(request, 'manage_jsc_users')
        if permission_error:
            return permission_error
        print(f"Delete admin called for pk={pk}")  # Debug
        try:
            target_user = User.objects.get(id=pk)
            print(f"Found user: {target_user.username}")  # Debug
            deleted_name = target_user.name or target_user.username
            
            # Simple soft delete - just deactivate
            target_user.is_active = False
            target_user.save()
            print(f"User {deleted_name} soft deleted successfully")  # Debug
            
            return Response({'message': f'Admin {deleted_name} deleted successfully'}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            print(f"User with pk={pk} not found")  # Debug
            return Response({'error': 'Admin not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Error in delete_admin: {str(e)}")  # Debug
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def upload_image(self, request, pk=None):
        try:
            user = User.objects.get(id=pk)
            image_file = request.FILES.get('image')
            
            if not image_file:
                return Response({'error': 'No image file provided'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate file type
            allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
            if image_file.content_type not in allowed_types:
                return Response({'error': 'Invalid file type. Only JPEG, PNG, and GIF are allowed.'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate file size (5MB max)
            if image_file.size > 5 * 1024 * 1024:
                return Response({'error': 'File too large. Maximum size is 5MB.'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Create uploads directory if it doesn't exist
            upload_dir = 'uploads/admin_images/'
            os.makedirs(os.path.join('media', upload_dir), exist_ok=True)
            
            # Generate unique filename
            file_extension = os.path.splitext(image_file.name)[1]
            filename = f"admin_{user.id}_{user.username}{file_extension}"
            file_path = os.path.join(upload_dir, filename)
            
            # Delete old image if exists
            if user.profile_image:
                try:
                    old_path = user.profile_image.name
                    if default_storage.exists(old_path):
                        default_storage.delete(old_path)
                        print(f"Deleted old image: {old_path}")
                except Exception as e:
                    print(f"Error deleting old image: {e}")
                    pass
            
            # Force delete and recreate the file
            if default_storage.exists(file_path):
                default_storage.delete(file_path)
                print(f"Deleted existing file: {file_path}")
            
            # Use a unique filename to avoid any caching issues
            import time
            timestamp = int(time.time())
            unique_filename = f"admin_{user.id}_{user.username}_{timestamp}{file_extension}"
            unique_file_path = os.path.join(upload_dir, unique_filename)
            
            saved_path = default_storage.save(unique_file_path, ContentFile(image_file.read()))
            
            # Update user model
            user.profile_image = saved_path
            user.save()
            
            # Refresh from database to confirm save
            user.refresh_from_db()
            
            print(f"Image saved to: {saved_path}")
            print(f"User profile_image field updated: {user.profile_image}")
            print(f"User ID {user.id} image field after refresh: {user.profile_image}")
            
            image_url = request.build_absolute_uri(default_storage.url(saved_path))
            # Add timestamp to prevent caching
            import time
            cache_buster = int(time.time())
            image_url_with_cache = f"{image_url}?v={cache_buster}"
            
            return Response({
                'message': 'Image uploaded successfully',
                'image_url': image_url_with_cache
            })
        except User.DoesNotExist:
            return Response({'error': 'Admin not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def pending_registrations(self, request):
        permission_error = _enforce_permission(request, 'manage_jsc_users')
        if permission_error:
            return permission_error
        
        # Find all inactive users (potential pending admins)
        pending_admins = User.objects.filter(is_active=False)
        print(f'Found {pending_admins.count()} inactive users')  # Debug
        
        for user in pending_admins:
            print(f'User: {user.username}, role: {user.role}, is_staff: {user.is_staff}, is_superuser: {user.is_superuser}')
        data = []
        for admin in pending_admins:
            # Get image URL
            image_url = None
            if hasattr(admin, 'profile_image') and admin.profile_image:
                try:
                    image_url = request.build_absolute_uri(admin.profile_image.url)
                except:
                    image_url = admin.profile_image.url
            
            data.append({
                'id': admin.id,
                'name': admin.name or f"{admin.first_name} {admin.last_name}",
                'email': admin.email,
                'employee_id': admin.username,
                'role': 'department_admin',
                'status': 'inactive',
                'created_at': admin.date_joined.isoformat(),
                'image': image_url
            })
        return Response({'data': data})
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        permission_error = _enforce_permission(request, 'manage_jsc_users')
        if permission_error:
            return permission_error
        
        try:
            user = User.objects.get(id=pk)
            user.is_active = True
            user.save()
            return Response({'message': f'Admin {user.name or user.username} approved successfully'})
        except User.DoesNotExist:
            return Response({'error': 'Admin not found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['post'])
    def invalidate_sessions(self, request, pk=None):
        return Response({'message': 'Sessions invalidated successfully'})
    
    @action(detail=False, methods=['get'])
    def profile(self, request):
        """Get current admin user's profile"""
        try:
            user = request.user
            
            # Determine role based on user properties
            if user.is_superuser:
                role = 'super_admin'
            elif user.is_staff and user.role == 'admin':
                role = 'admin'
            else:
                role = 'department_admin'
            
            # Get profile image URL
            image_url = None
            if hasattr(user, 'profile_image') and user.profile_image:
                try:
                    image_url = request.build_absolute_uri(user.profile_image.url)
                except Exception as e:
                    print(f'Error building image URL for {user.username}: {e}')
                    image_url = user.profile_image.url
            
            profile_data = {
                'id': user.id,
                'name': user.name or f"{user.first_name} {user.last_name}",
                'email': user.email,
                'employee_id': user.username,
                'role': role,
                'status': 'active' if user.is_active else 'inactive',
                'image': image_url,
                'created_at': user.date_joined.isoformat(),
                'last_login': user.last_login.isoformat() if user.last_login else None
            }
            
            return Response(profile_data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
