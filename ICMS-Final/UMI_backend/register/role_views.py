from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import User
from instructors.models import Instructor
from coordinators.models import Coordinator
from hods.models import HOD

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_roles(request):
    """Get all available roles for the current user"""
    user = request.user
    available_roles = []
    
    # Add primary role
    available_roles.append({
        'role': user.role,
        'name': user.role.title(),
        'is_primary': True
    })
    
    # Check for instructor profile
    try:
        instructor = Instructor.objects.get(user=user)
        if user.role != 'instructor':
            available_roles.append({
                'role': 'instructor',
                'name': 'Instructor',
                'is_primary': False
            })
    except Instructor.DoesNotExist:
        pass
    
    # Also check if user is HOD - HODs can switch to instructor role
    try:
        hod = HOD.objects.get(user=user)
        if user.role != 'instructor' and not any(r['role'] == 'instructor' for r in available_roles):
            available_roles.append({
                'role': 'instructor',
                'name': 'Instructor (via HOD)',
                'is_primary': False
            })
    except HOD.DoesNotExist:
        pass
    
    # Check for coordinator profile
    try:
        coordinator = Coordinator.objects.get(user=user)
        if user.role != 'coordinator':
            available_roles.append({
                'role': 'coordinator',
                'name': 'Coordinator',
                'is_primary': False
            })
        
        # If coordinator can act as instructor
        if coordinator.can_act_as_instructor and user.role != 'instructor':
            # Check if instructor role already added
            if not any(r['role'] == 'instructor' for r in available_roles):
                available_roles.append({
                    'role': 'instructor',
                    'name': 'Instructor (via Coordinator)',
                    'is_primary': False
                })
    except Coordinator.DoesNotExist:
        pass
    
    # Check for HOD profile
    try:
        hod = HOD.objects.get(user=user)
        if user.role != 'hod':
            available_roles.append({
                'role': 'hod',
                'name': 'HOD',
                'is_primary': False
            })
    except HOD.DoesNotExist:
        pass
    
    # Check if user is coordinator (promoted instructor)
    if user.is_coordinator and user.role == 'instructor':
        if not any(r['role'] == 'coordinator' for r in available_roles):
            available_roles.append({
                'role': 'coordinator',
                'name': 'Coordinator',
                'is_primary': False
            })
    
    return Response({
        'current_role': user.get_current_role(),
        'available_roles': available_roles
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def switch_role(request):
    """Switch user's active role"""
    user = request.user
    target_role = request.data.get('role')
    
    if not target_role:
        return Response({'error': 'Role is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Validate if user can switch to this role
    can_switch = False
    
    # Primary role
    if target_role == user.role:
        can_switch = True
    
    # Check instructor permissions
    elif target_role == 'instructor':
        try:
            Instructor.objects.get(user=user)
            can_switch = True
        except Instructor.DoesNotExist:
            # Check if coordinator can act as instructor
            try:
                coordinator = Coordinator.objects.get(user=user)
                if coordinator.can_act_as_instructor:
                    can_switch = True
            except Coordinator.DoesNotExist:
                pass
    
    # Check coordinator permissions
    elif target_role == 'coordinator':
        try:
            Coordinator.objects.get(user=user)
            can_switch = True
        except Coordinator.DoesNotExist:
            # Check if user is promoted instructor
            if user.is_coordinator and user.role == 'instructor':
                can_switch = True
    
    # Check HOD permissions
    elif target_role == 'hod':
        try:
            HOD.objects.get(user=user)
            can_switch = True
        except HOD.DoesNotExist:
            pass
    
    if not can_switch:
        return Response({'error': 'You do not have permission to switch to this role'}, 
                      status=status.HTTP_403_FORBIDDEN)
    
    # Update active role and sync primary role so legacy role checks
    # (which still use user.role in multiple modules) remain consistent.
    user.active_role = target_role
    user.role = target_role
    if target_role not in user.roles:
        user.roles.append(target_role)
    user.save()
    
    return Response({
        'message': f'Successfully switched to {target_role} role',
        'current_role': user.get_current_role(),
        'role': user.role,
        'active_role': user.active_role,
        'roles': user.roles
    })
