from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .models import AttendanceEditPermission


class SimpleAdminPermissionsView(APIView):
    """
    Simple admin view to get attendance edit requests
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            permissions = AttendanceEditPermission.objects.all().order_by('-requested_at')
            
            permissions_data = []
            for perm in permissions:
                permissions_data.append({
                    'id': perm.permission_id,
                    'instructor': {
                        'id': perm.instructor.id,
                        'name': perm.instructor.name,
                        'email': 'instructor@example.com'
                    },
                    'student': {
                        'id': perm.attendance.student.student_id,
                        'name': perm.attendance.student.name
                    },
                    'course': {
                        'id': 'N/A',
                        'name': 'General',
                        'code': 'N/A'
                    },
                    'timetable': {
                        'day': 'Today',
                        'time': 'N/A',
                        'room': 'N/A'
                    },
                    'date': perm.attendance.date,
                    'current_status': perm.attendance.status,
                    'proposed_status': perm.proposed_status,
                    'reason': perm.reason,
                    'requested_at': perm.requested_at,
                    'status': perm.status
                })
            
            return Response({
                'pending_requests': permissions_data,
                'requests': permissions_data,
                'total_count': permissions.count()
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        try:
            permission_id = request.data.get('permission_id')
            action = request.data.get('action')
            admin_notes = request.data.get('admin_notes', '')
            
            permission = AttendanceEditPermission.objects.get(permission_id=permission_id)
            
            if action == 'approve':
                permission.status = 'approved'
                permission.admin_notes = admin_notes
                permission.attendance.can_edit = True
                permission.attendance.save()
            elif action == 'reject':
                permission.status = 'rejected'
                permission.admin_notes = admin_notes
            
            permission.save()
            
            return Response({'message': f'Request {action}d successfully'})
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)