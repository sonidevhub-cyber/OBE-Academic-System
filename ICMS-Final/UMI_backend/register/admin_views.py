from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import User

class AdminViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        """Get all admin users"""
        admins = User.objects.filter(role='admin')
        data = []
        for admin in admins:
            data.append({
                'id': admin.id,
                'name': admin.name or f"{admin.first_name} {admin.last_name}",
                'email': admin.email,
                'employee_id': admin.username,
                'role': 'super_admin' if admin.is_superuser else 'admin',
                'status': 'active' if admin.is_active else 'inactive',
                'permissions': ['user_management', 'department_management'] if admin.is_superuser else ['department_management'],
                'profile_image': request.build_absolute_uri(admin.profile_image.url) if admin.profile_image else None,
                'created_at': admin.date_joined.isoformat(),
                'last_login': admin.last_login.isoformat() if admin.last_login else None
            })
        return Response({'data': data})
    
    def create(self, request):
        """Create new admin"""
        data = request.data
        try:
            user = User.objects.create_user(
                username=data.get('employee_id'),
                email=data.get('email'),
                password=data.get('password'),
                first_name=data.get('name', '').split(' ')[0],
                last_name=' '.join(data.get('name', '').split(' ')[1:]),
                name=data.get('name'),
                role='admin',
                is_active=data.get('status') == 'active',
                is_staff=True,
                is_superuser=data.get('role') == 'super_admin'
            )
            return Response({'message': 'Admin created successfully'}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def update(self, request, pk=None):
        """Update admin"""
        try:
            user = User.objects.get(id=pk)
            data = request.data
            
            if 'name' in data:
                user.name = data['name']
                name_parts = data['name'].split(' ')
                user.first_name = name_parts[0]
                user.last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''
            
            if 'email' in data:
                user.email = data['email']
            
            if 'password' in data and data['password']:
                user.set_password(data['password'])
            
            if 'status' in data:
                user.is_active = data['status'] == 'active'
            
            if 'profile_image' in request.FILES:
                user.profile_image = request.FILES['profile_image']
            
            if 'role' in data:
                user.is_superuser = data['role'] == 'super_admin'
            
            if 'profile_image' in request.FILES:
                user.profile_image = request.FILES['profile_image']
            
            user.save()
            return Response({'message': 'Admin updated successfully'})
        except User.DoesNotExist:
            return Response({'error': 'Admin not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def destroy(self, request, pk=None):
        """Delete admin"""
        try:
            user = User.objects.get(id=pk)
            user.delete()
            return Response({'message': 'Admin deleted successfully'})
        except User.DoesNotExist:
            return Response({'error': 'Admin not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class PrincipalViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        """Get all principal users"""
        principals = User.objects.filter(role='principal')
        data = []
        for principal in principals:
            data.append({
                'id': principal.id,
                'name': principal.name or f"{principal.first_name} {principal.last_name}",
                'email': principal.email,
                'employee_id': principal.username,
                'role': 'principal',
                'status': 'active' if principal.is_active else 'inactive',
                'permissions': ['full_access'],
                'profile_image': request.build_absolute_uri(principal.profile_image.url) if principal.profile_image else None,
                'created_at': principal.date_joined.isoformat(),
                'last_login': principal.last_login.isoformat() if principal.last_login else None
            })
        return Response({'data': data})
    
    def create(self, request):
        """Create new principal"""
        data = request.data
        try:
            user = User.objects.create_user(
                username=data.get('employee_id'),
                email=data.get('email'),
                password=data.get('password'),
                first_name=data.get('name', '').split(' ')[0],
                last_name=' '.join(data.get('name', '').split(' ')[1:]),
                name=data.get('name'),
                role='principal',
                is_active=data.get('status') == 'active',
                is_staff=True,
                is_superuser=False
            )
            return Response({'message': 'Principal created successfully'}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def update(self, request, pk=None):
        """Update principal"""
        try:
            user = User.objects.get(id=pk, role='principal')
            data = request.data
            
            if 'name' in data:
                user.name = data['name']
                name_parts = data['name'].split(' ')
                user.first_name = name_parts[0]
                user.last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''
            
            if 'email' in data:
                user.email = data['email']
            
            if 'password' in data and data['password']:
                user.set_password(data['password'])
            
            if 'status' in data:
                user.is_active = data['status'] == 'active'
            
            user.save()
            return Response({'message': 'Principal updated successfully'})
        except User.DoesNotExist:
            return Response({'error': 'Principal not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def destroy(self, request, pk=None):
        """Delete principal"""
        try:
            user = User.objects.get(id=pk, role='principal')
            user.delete()
            return Response({'message': 'Principal deleted successfully'})
        except User.DoesNotExist:
            return Response({'error': 'Principal not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)