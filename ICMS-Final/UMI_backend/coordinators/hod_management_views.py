from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.contrib.auth.hashers import make_password
from coordinators.models import Coordinator, CoordinatorDashboard
from coordinators.serializers import CoordinatorSerializer
from instructors.models import Instructor
from register.models import User
from hods.models import HOD
from register.multi_role_service import MultiRoleService
from register.identifiers import generate_employee_id

def _is_hod_user(user):
    if hasattr(user, 'hod_profile'):
        return True
    current_role = user.get_current_role() if hasattr(user, 'get_current_role') else getattr(user, 'role', None)
    if current_role == 'hod' or getattr(user, 'role', None) == 'hod':
        return True
    return HOD.objects.filter(user=user).exists()

class HODCoordinatorManagementViewSet(viewsets.ModelViewSet):
    queryset = Coordinator.objects.all()
    serializer_class = CoordinatorSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def department_coordinators(self, request):
        """Get all coordinators for HOD's department (including inactive)"""
        print(f"\n=== DEPARTMENT COORDINATORS DEBUG ===")
        print(f"User: {request.user.username}, Role: {request.user.role}")
        
        if not _is_hod_user(request.user):
            print(f"Access denied - user role is {request.user.role}, not hod")
            return Response({'error': 'Only HOD can view coordinators'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        try:
            hod = HOD.objects.get(user=request.user)
            print(f"HOD found: {hod.name} from department {hod.department.name if hod.department else 'No Dept'}")
            
            # Get all coordinators (active and inactive)
            if hod.department:
                coordinators = Coordinator.objects.filter(department=hod.department).select_related('user')
                print(f"Coordinators in HOD's department ({hod.department.name}): {coordinators.count()}")
            else:
                print("HOD has no department assigned!")
                coordinators = Coordinator.objects.none()
            
            coordinator_data = []
            for coordinator in coordinators:
                # Get name - prefer coordinator.name, fallback to user name
                coordinator_name = coordinator.name
                if not coordinator_name or coordinator_name == 'N/A' or coordinator_name == '' or coordinator_name == coordinator.employee_id:
                    # Try to get name from user
                    if coordinator.user:
                        # Try user.name first
                        coordinator_name = coordinator.user.name
                        # If empty, try first_name + last_name
                        if not coordinator_name or coordinator_name == '':
                            full_name = f"{coordinator.user.first_name or ''} {coordinator.user.last_name or ''}".strip()
                            coordinator_name = full_name if full_name else None
                        # If still empty, use username
                        if not coordinator_name or coordinator_name == '':
                            coordinator_name = coordinator.user.username
                    else:
                        coordinator_name = 'Unknown'
                
                data = {
                    'id': coordinator.id,
                    'name': coordinator_name,
                    'email': coordinator.email,
                    'employee_id': coordinator.employee_id or 'N/A',
                    'specialization': coordinator.specialization or 'N/A',
                    'department_name': coordinator.department.name if coordinator.department else 'N/A',
                    'can_act_as_instructor': coordinator.can_act_as_instructor,
                    'is_active': coordinator.is_active,
                    'created_at': coordinator.created_at.isoformat() if coordinator.created_at else None
                }
                coordinator_data.append(data)
                print(f"Added coordinator: {data}")
            
            print(f"Returning {len(coordinator_data)} coordinators")
            print(f"=== END DEBUG ===\n")
            return Response(coordinator_data)
            
        except HOD.DoesNotExist:
            print(f"HOD profile not found for user {request.user.username}")
            return Response({'error': 'HOD profile not found'}, 
                          status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Error in department_coordinators: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def inactive_coordinators(self, request):
        """Get only inactive coordinators for HOD's department"""
        if not _is_hod_user(request.user):
            return Response({'error': 'Only HOD can view coordinators'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        try:
            hod = HOD.objects.get(user=request.user)
            coordinators = Coordinator.objects.filter(department=hod.department, is_active=False)
            
            coordinator_data = []
            for coordinator in coordinators:
                coordinator_data.append({
                    'id': coordinator.id,
                    'name': coordinator.name,
                    'email': coordinator.email,
                    'employee_id': coordinator.employee_id or 'N/A',
                    'specialization': coordinator.specialization or 'N/A',
                    'department_name': coordinator.department.name if coordinator.department else 'N/A',
                    'can_act_as_instructor': coordinator.can_act_as_instructor,
                    'is_active': coordinator.is_active,
                    'deactivated_at': coordinator.updated_at.isoformat() if coordinator.updated_at else None
                })
            
            return Response(coordinator_data)
            
        except HOD.DoesNotExist:
            return Response({'error': 'HOD profile not found'}, 
                          status=status.HTTP_404_NOT_FOUND)
        """Check current user role and HOD status"""
        from register.models import User
        
        user_info = {
            'user_id': request.user.id,
            'username': request.user.username,
            'user_role': request.user.role,
            'is_authenticated': request.user.is_authenticated,
        }
        
        # Check if user has HOD profile
        try:
            hod = HOD.objects.get(user=request.user)
            user_info['has_hod_profile'] = True
            user_info['hod_name'] = hod.name
            user_info['hod_department'] = hod.department.name if hod.department else 'No Department'
        except HOD.DoesNotExist:
            user_info['has_hod_profile'] = False
        
        return Response(user_info)
        """Check all coordinators in database"""
        from register.models import User
        
        # Check all coordinators
        all_coordinators = Coordinator.objects.all()
        coordinator_data = []
        
        for coord in all_coordinators:
            coordinator_data.append({
                'id': coord.id,
                'name': coord.name,
                'email': coord.email,
                'department': coord.department.name if coord.department else 'No Department',
                'user_role': coord.user.role if coord.user else 'No User',
                'is_active': coord.is_active,
                'created_at': str(coord.created_at)
            })
        
        # Check all users with coordinator role
        coordinator_users = User.objects.filter(role='coordinator')
        user_data = []
        
        for user in coordinator_users:
            has_profile = hasattr(user, 'coordinator_profile')
            user_data.append({
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'role': user.role,
                'has_coordinator_profile': has_profile,
                'profile_id': user.coordinator_profile.id if has_profile else None
            })
        
        return Response({
            'total_coordinator_records': len(coordinator_data),
            'coordinator_records': coordinator_data,
            'total_coordinator_users': len(user_data),
            'coordinator_users': user_data
        })
    
    def get_queryset(self):
        if not _is_hod_user(self.request.user):
            return Coordinator.objects.none()
        
        try:
            hod = HOD.objects.get(user=self.request.user)
            # Return all coordinators in HOD's department
            coordinators = Coordinator.objects.filter(department=hod.department)
            print(f"HOD {hod.name} requesting coordinators, found {coordinators.count()} coordinators")
            return coordinators
        except HOD.DoesNotExist:
            print(f"HOD profile not found for user {self.request.user.username}")
            return Coordinator.objects.none()
    
    @action(detail=False, methods=['post'])
    def promote_instructor_to_coordinator(self, request):
        """HOD promotes an instructor to coordinator"""
        if not _is_hod_user(request.user):
            return Response({'error': f'Only HOD can promote instructors. Your role: {request.user.role}'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        instructor_id = request.data.get('instructor_id')
        can_act_as_instructor = request.data.get('can_act_as_instructor', False)
        
        try:
            hod = HOD.objects.get(user=request.user)
            instructor = Instructor.objects.get(id=instructor_id)
            
            # Check if instructor is in same department
            if instructor.department != hod.department:
                return Response({'error': f'Can only promote instructors from your department'}, 
                              status=status.HTTP_403_FORBIDDEN)
            
            # Check if already a coordinator
            if hasattr(instructor.user, 'coordinator_profile'):
                coordinator = instructor.user.coordinator_profile
                coordinator.can_act_as_instructor = can_act_as_instructor
                coordinator.save()
                return Response({
                    'message': f'Instructor {instructor.name} is already a coordinator. Settings updated.',
                    'coordinator_id': coordinator.id
                })
            
            # Update user role and is_coordinator flag
            print(f"Updating user {instructor.user.username} role from {instructor.user.role} to coordinator")
            instructor.user.role = 'coordinator'
            instructor.user.is_coordinator = True
            instructor.user.save()
            print(f"User role updated to: {instructor.user.role}")
            
            # Create coordinator profile
            coordinator = Coordinator.objects.create(
                user=instructor.user,
                employee_id=instructor.employee_id,
                name=instructor.name,
                email=instructor.user.email,
                phone=instructor.phone,
                department=instructor.department,
                designation='Coordinator',
                hire_date=instructor.hire_date,
                date_of_birth=instructor.date_of_birth,
                gender=instructor.gender,
                specialization=instructor.specialization,
                experience_years=instructor.experience_years,
                image=instructor.image,
                can_act_as_instructor=can_act_as_instructor,
                assigned_by=hod
            )

            # If coordinator can act as instructor, ensure instructor role/profile exists
            try:
                if coordinator.can_act_as_instructor:
                    MultiRoleService.enable_instructor_role_for_coordinator(coordinator.user)
            except Exception:
                pass

            # Create dashboard
            CoordinatorDashboard.objects.get_or_create(coordinator=coordinator)
            
            return Response({
                'message': f'Instructor {instructor.name} promoted to coordinator successfully',
                'coordinator_id': coordinator.id,
                'can_act_as_instructor': can_act_as_instructor
            })
            
        except Instructor.DoesNotExist:
            return Response({'error': 'Instructor not found'}, 
                          status=status.HTTP_404_NOT_FOUND)
        except HOD.DoesNotExist:
            return Response({'error': 'HOD profile not found'}, 
                          status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': f'Error: {str(e)}'}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def create_new_coordinator(self, request):
        """HOD creates a new coordinator directly"""
        if not _is_hod_user(request.user):
            return Response({'error': 'Only HOD can create coordinators'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        try:
            hod = HOD.objects.get(user=request.user)
            
            employee_id = generate_employee_id('coordinator', hod.department)

            # Create user account
            user_data = {
                'username': employee_id,
                'email': request.data.get('email'),
                'password': make_password(request.data.get('password')),
                'role': 'coordinator',
                'name': request.data.get('name'),
                'employee_id': employee_id,
            }
            
            user = User.objects.create(**user_data)
            
            # Create coordinator profile
            coordinator_data = {
                'user': user,
                'employee_id': employee_id,
                'name': request.data.get('name'),
                'email': request.data.get('email'),
                'phone': request.data.get('phone'),
                'department': hod.department,
                'designation': 'Coordinator',
                'specialization': request.data.get('specialization'),
                'experience_years': request.data.get('experience_years', 0),
                'can_act_as_instructor': request.data.get('can_act_as_instructor', False),
                'assigned_by': hod
            }
            
            coordinator = Coordinator.objects.create(**coordinator_data)

            # If coordinator should act as instructor, enable role/profile
            try:
                if coordinator.can_act_as_instructor:
                    MultiRoleService.enable_instructor_role_for_coordinator(user)
            except Exception:
                pass

            # Create dashboard
            CoordinatorDashboard.objects.create(coordinator=coordinator)
            
            return Response({
                'message': f'Coordinator {coordinator.name} created successfully',
                'coordinator_id': coordinator.id,
                'employee_id': coordinator.employee_id
            })
            
        except Exception as e:
            return Response({'error': str(e)}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def toggle_instructor_permission(self, request, pk=None):
        """Toggle coordinator's permission to act as instructor"""
        coordinator = self.get_object()
        coordinator.can_act_as_instructor = not coordinator.can_act_as_instructor
        coordinator.save()

        # Ensure instructor role/profile exists or is removed accordingly
        try:
            if coordinator.can_act_as_instructor:
                from register.multi_role_service import MultiRoleService
                MultiRoleService.enable_instructor_role_for_coordinator(coordinator.user)
            else:
                from register.multi_role_service import MultiRoleService
                MultiRoleService.disable_instructor_role_for_coordinator(coordinator.user)
        except Exception:
            pass

        return Response({
            'message': f'Coordinator {"can now" if coordinator.can_act_as_instructor else "cannot"} act as instructor',
            'can_act_as_instructor': coordinator.can_act_as_instructor
        })
    
    @action(detail=True, methods=['post'])
    def deactivate_coordinator(self, request, pk=None):
        """Deactivate coordinator (keeps record but marks as inactive)"""
        coordinator = self.get_object()
        coordinator.is_active = False
        coordinator.save()
        
        # Update user role to instructor if they can act as instructor
        if coordinator.can_act_as_instructor:
            coordinator.user.role = 'instructor'
            coordinator.user.save()
        
        return Response({
            'message': f'Coordinator {coordinator.name} has been deactivated',
            'coordinator_id': coordinator.id
        })
    
    @action(detail=True, methods=['post'])
    def reactivate_coordinator(self, request, pk=None):
        """Reactivate coordinator"""
        coordinator = self.get_object()
        coordinator.is_active = True
        coordinator.save()
        
        # Update user role back to coordinator
        coordinator.user.role = 'coordinator'
        coordinator.user.save()
        
        return Response({
            'message': f'Coordinator {coordinator.name} has been reactivated',
            'coordinator_id': coordinator.id
        })
    @action(detail=True, methods=['delete'])
    def remove_coordinator(self, request, pk=None):
        """Permanently delete coordinator"""
        coordinator = self.get_object()
        coordinator_name = coordinator.name
        
        # Delete user account too
        user = coordinator.user
        coordinator.delete()
        user.delete()
        
        return Response({'message': f'Coordinator {coordinator_name} has been permanently deleted'})
    
    @action(detail=False, methods=['get'])
    def check_user_role(self, request):
        """Debug endpoint to check current user's role in database"""
        from register.models import User
        
        try:
            # Get fresh user data from database
            user = User.objects.get(id=request.user.id)
            
            return Response({
                'user_id': user.id,
                'username': user.username,
                'email': user.email,
                'role_in_db': user.role,
                'role_in_request': request.user.role,
                'is_coordinator': getattr(user, 'is_coordinator', False),
                'first_name': user.first_name,
                'name': user.name,
                'has_coordinator_profile': hasattr(user, 'coordinator_profile')
            })
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)
        """Test endpoint to check coordinators"""
        all_coordinators = Coordinator.objects.all()
        data = []
        for coord in all_coordinators:
            data.append({
                'id': coord.id,
                'name': coord.name,
                'department': coord.department.name if coord.department else 'No Department',
                'email': coord.email,
                'can_act_as_instructor': coord.can_act_as_instructor
            })
        return Response({
            'total_coordinators': len(data),
            'coordinators': data,
            'current_user_role': request.user.role
        })
    
    @action(detail=False, methods=['get'])
    def test_instructors(self, request):
        """Test endpoint to check all instructors"""
        all_instructors = Instructor.objects.all()
        data = []
        for inst in all_instructors:
            data.append({
                'id': inst.id,
                'name': inst.name,
                'department': inst.department.name if inst.department else 'No Department',
                'email': inst.user.email if inst.user else 'No User'
            })
        return Response({
            'total_instructors': len(data),
            'instructors': data,
            'current_user_role': request.user.role
        })
    
    @action(detail=False, methods=['get'])
    def department_instructors(self, request):
        """Get all instructors for HOD"""
        if not _is_hod_user(request.user):
            return Response({'error': 'Only HOD can view instructors'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        try:
            hod = HOD.objects.get(user=request.user)
            # Keep instructor records in sync for department users who can act as instructor.
            # This guarantees visibility in instructor tabs for HOD/Coordinator dual-role users.
            for dept_hod in HOD.objects.filter(department=hod.department, can_act_as_instructor=True).select_related('user'):
                if dept_hod.user and not hasattr(dept_hod.user, 'instructor_profile'):
                    try:
                        MultiRoleService.enable_instructor_role_for_hod(dept_hod.user)
                    except Exception:
                        pass

            for dept_coordinator in Coordinator.objects.filter(
                department=hod.department,
                can_act_as_instructor=True,
            ).select_related('user'):
                if dept_coordinator.user and not hasattr(dept_coordinator.user, 'instructor_profile'):
                    try:
                        MultiRoleService.enable_instructor_role_for_coordinator(dept_coordinator.user)
                    except Exception:
                        pass

            # Get all instructors in the department (including those who are coordinators)
            instructors = Instructor.objects.filter(department=hod.department).select_related('user')
            
            instructor_data = []
            for instructor in instructors:
                is_coordinator = hasattr(instructor.user, 'coordinator_profile') if instructor.user else False
                coordinator_info = None
                
                if is_coordinator:
                    coordinator = instructor.user.coordinator_profile
                    coordinator_info = {
                        'id': coordinator.id,
                        'can_act_as_instructor': coordinator.can_act_as_instructor
                    }
                
                # Get name - prefer instructor.name, fallback to user name
                instructor_name = instructor.name
                if not instructor_name or instructor_name == 'N/A' or instructor_name == '' or instructor_name == instructor.employee_id:
                    if instructor.user:
                        instructor_name = instructor.user.name
                        if not instructor_name or instructor_name == '':
                            full_name = f"{instructor.user.first_name or ''} {instructor.user.last_name or ''}".strip()
                            instructor_name = full_name if full_name else None
                        if not instructor_name or instructor_name == '':
                            instructor_name = instructor.user.username
                    else:
                        instructor_name = 'Unknown'
                
                # Get specialization - prefer instructor.specialization, fallback to user
                instructor_specialization = instructor.specialization
                if not instructor_specialization or instructor_specialization == 'N/A' or instructor_specialization == '':
                    instructor_specialization = 'Not Assigned'
                
                instructor_data.append({
                    'id': instructor.id,
                    'name': instructor_name,
                    'email': instructor.user.email if instructor.user else 'N/A',
                    'employee_id': instructor.employee_id or 'N/A',
                    'specialization': instructor_specialization,
                    'experience_years': instructor.experience_years or 0,
                    'is_coordinator': is_coordinator,
                    'coordinator_info': coordinator_info
                })
            
            print(f"Returning {len(instructor_data)} instructors for HOD {hod.name}")
            return Response(instructor_data)
            
        except HOD.DoesNotExist:
            return Response({'error': 'HOD profile not found'}, 
                          status=status.HTTP_404_NOT_FOUND)
