from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from register.models import User
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.db import models
import os

from rbac.models import RBACPermission, RBACUserPermission
from rbac.services import ensure_base_roles, get_user_permission_codes


LEGACY_TO_RBAC = {
    'department_management': 'manage_departments',
    'course_management': 'manage_courses',
    'results_management': 'manage_results',
    'attendance_management': 'manage_attendance',
    'user_management': 'manage_jsc_users',
    'reports_access': 'view_obe_reports',
}

RBAC_TO_LEGACY = {v: k for k, v in LEGACY_TO_RBAC.items()}


def _normalize_permission_codes(permission_codes):
    normalized = []
    for code in permission_codes or []:
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

class AdminViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        ensure_base_roles()
        admins = User.objects.filter(role='admin', is_active=True)
        data = []
        for admin in admins:
            # Determine role based on user properties
            if admin.is_superuser:
                role = 'super_admin'
            elif admin.is_staff and admin.role == 'admin':
                role = 'admin'
            else:
                role = 'department_admin'
            
            # Get department info if exists
            department_info = {'name': 'All Departments'}
            try:
                from academics.models import Department
                # Check if department_id is stored in last_name
                if '|dept_' in str(admin.last_name):
                    dept_id = admin.last_name.split('|dept_')[1]
                    try:
                        dept = Department.objects.get(pk=int(dept_id))
                        department_info = {'id': dept.pk, 'name': getattr(dept, 'name', f'Department {dept.pk}')}
                    except:
                        pass
                elif role == 'department_admin':
                    # Default department for dept admins without specific assignment
                    departments = Department.objects.all()[:1]
                    if departments:
                        dept = departments[0]
                        department_info = {'id': dept.pk, 'name': getattr(dept, 'name', f'Department {dept.pk}')}
            except Exception as e:
                print(f"Department retrieval error: {e}")
                # Fallback to simple department assignment
                if role == 'department_admin':
                    department_info = {'name': 'Computer Science'}
                pass
            
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
                'permissions': _legacy_permissions_for_ui(get_user_permission_codes(admin)),
                'created_at': admin.date_joined.isoformat(),
                'last_login': admin.last_login.isoformat() if admin.last_login else None,
                'department': department_info,
                'image': image_url
            })
        return Response({'data': data})
    
    def create(self, request):
        data = request.data
        try:
            ensure_base_roles()
            employee_id = str(data.get('employee_id', '')).strip()
            email = str(data.get('email', '')).strip()
            password = data.get('password')
            name = str(data.get('name', '')).strip()

            validation_errors = {}
            if not employee_id:
                validation_errors['employee_id'] = ['Employee ID is required.']
            if not email:
                validation_errors['email'] = ['Email is required.']
            if not password:
                validation_errors['password'] = ['Password is required.']
            if not name:
                validation_errors['name'] = ['Name is required.']

            if employee_id and User.objects.filter(username=employee_id).exists():
                validation_errors['employee_id'] = ['An admin with this Employee ID already exists.']

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
                is_superuser=data.get('role') == 'super_admin'
            )

            requested_permissions = data.get('permissions', [])
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

            return Response({'message': 'Admin created successfully', 'id': user.id}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response(
                {
                    'message': 'Failed to create admin.',
                    'error': str(e),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
    
    def update(self, request, pk=None):
        try:
            ensure_base_roles()
            user = User.objects.get(id=pk)
            data = request.data
            
            print(f"Updating user {pk} with data: {data}")  # Debug log
            
            if 'name' in data:
                user.name = data['name']
                name_parts = data['name'].split(' ')
                user.first_name = name_parts[0]
                user.last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''
            
            if 'email' in data:
                user.email = data['email']
            
            if 'employee_id' in data:
                user.username = data['employee_id']
            
            if 'password' in data and data['password']:
                user.set_password(data['password'])
            
            if 'status' in data:
                user.is_active = data['status'] == 'active'
            
            if 'is_active' in data:
                user.is_active = data['is_active']
            
            # Handle department assignment
            department_name = 'All Departments'
            if 'department_id' in data and data['department_id']:
                try:
                    from academics.models import Department
                    dept = Department.objects.get(pk=data['department_id'])
                    department_name = getattr(dept, 'name', f'Department {dept.pk}')
                    # Store department_id in last_name field
                    base_name = user.last_name.split('|')[0] if '|' in str(user.last_name) else user.last_name
                    user.last_name = f"{base_name}|dept_{data['department_id']}"
                    print(f"Assigned department {department_name} to user {user.username}")
                except Exception as e:
                    print(f"Department assignment error: {e}")
                    # Fallback assignment
                    department_name = 'Computer Science'
                    user.last_name = f"{user.last_name.split('|')[0] if '|' in str(user.last_name) else user.last_name}|dept_1"
            
            # Determine role for response
            response_role = 'admin'  # Default
            if 'role' in data:
                response_role = data['role']
                if data['role'] == 'super_admin':
                    user.is_superuser = True
                    user.is_staff = True
                    user.role = 'admin'
                elif data['role'] == 'admin':
                    user.is_superuser = False
                    user.is_staff = True
                    user.role = 'admin'
                elif data['role'] == 'department_admin':
                    user.is_superuser = False
                    user.is_staff = False
                    user.role = 'admin'
            
            user.save()

            # Persist permission updates into RBAC direct user permissions.
            if 'permissions' in data:
                requested_permissions = data.get('permissions', [])
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

            current_permissions = _legacy_permissions_for_ui(get_user_permission_codes(user))
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
                    'department': department_name,
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
        # Only super admin can view pending registrations
        if not request.user.is_superuser:
            return Response({'error': 'Only Super Admin can view pending registrations'}, status=status.HTTP_403_FORBIDDEN)
        
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
        # Only super admin can approve registrations
        if not request.user.is_superuser:
            return Response({'error': 'Only Super Admin can approve registrations'}, status=status.HTTP_403_FORBIDDEN)
        
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
