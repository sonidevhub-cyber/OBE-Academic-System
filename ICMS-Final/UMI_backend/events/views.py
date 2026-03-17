
from rest_framework import viewsets, permissions, status
from .models import Event
from .serializers import EventSerializer
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from rbac.services import user_has_permission, resolve_user_role_code, SAC_ROLE_CODE


class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        if user_has_permission(self.request.user, 'manage_events'):
            serializer.save(created_by=self.request.user)
            return
        raise PermissionDenied("Missing manage_events permission.")

    def get_queryset(self):
        user = self.request.user

        if user.is_authenticated and (resolve_user_role_code(user) == SAC_ROLE_CODE or user_has_permission(user, 'manage_events')):
            return Event.objects.all()
        
        # ✅ Baqi sabko sirf approved events dikhein
        return Event.objects.filter(status='approved')

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        event = self.get_object()
        if not user_has_permission(request.user, 'manage_events'):
            raise PermissionDenied("Missing manage_events permission.")
        event.status = 'approved'
        event.save()
        return Response({'status': 'Event approved successfully'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        event = self.get_object()
        if not user_has_permission(request.user, 'manage_events'):
            raise PermissionDenied("Missing manage_events permission.")
        event.status = 'rejected'
        event.save()
        return Response({'status': 'Event rejected successfully'}, status=status.HTTP_200_OK)
