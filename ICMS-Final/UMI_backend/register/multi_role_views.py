from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from .multi_role_service import MultiRoleService
from .serializers import UserSerializer

User = get_user_model()

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def switch_role(request):
    """Switch user's active role"""
    new_role = request.data.get('role')
    
    if not new_role:
        return Response(
            {'error': 'Role is required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check if user has the role and it's different from current
    if not request.user.has_role(new_role):
        return Response(
            {'error': f'You do not have {new_role} role'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    if request.user.get_current_role() == new_role:
        return Response(
            {'error': f'You are already in {new_role} role'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if MultiRoleService.switch_user_role(request.user, new_role):
        # Refresh user from database to get updated data
        request.user.refresh_from_db()
        serializer = UserSerializer(request.user)
        return Response({
            'message': f'Successfully switched to {new_role} role',
            'user': serializer.data,
            'capabilities': MultiRoleService.get_user_capabilities(request.user)
        })
    else:
        return Response(
            {'error': 'Failed to switch role'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_roles(request):
    """Get user's available roles and capabilities"""
    capabilities = MultiRoleService.get_user_capabilities(request.user)
    return Response(capabilities)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def enable_instructor_role(request):
    """Enable instructor role for HOD/Coordinator"""
    user = request.user
    
    if user.has_role('hod'):
        success = MultiRoleService.enable_instructor_role_for_hod(user)
    elif user.has_role('coordinator'):
        success = MultiRoleService.enable_instructor_role_for_coordinator(user)
    else:
        return Response(
            {'error': 'Only HODs and Coordinators can enable instructor role'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    if success:
        return Response({
            'message': 'Instructor role enabled successfully',
            'capabilities': MultiRoleService.get_user_capabilities(user)
        })
    else:
        return Response(
            {'error': 'Failed to enable instructor role'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def setup_multi_role_system(request):
    """Setup multi-role system for existing users (Admin only)"""
    if not request.user.has_role('admin') and not request.user.is_superuser:
        return Response(
            {'error': 'Only admins can setup multi-role system'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        MultiRoleService.auto_setup_existing_users()
        return Response({'message': 'Multi-role system setup completed successfully'})
    except Exception as e:
        return Response(
            {'error': f'Setup failed: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )