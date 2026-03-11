
from rest_framework import viewsets, permissions, status
from .models import Event
from .serializers import EventSerializer
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied


class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        # ✅ Admin/Super Admin create kar sakta hai
        if self.request.user.is_superuser or self.request.user.role in ['admin', 'super_admin']:
            serializer.save(created_by=self.request.user)
        else:
            raise PermissionDenied("Only admin can create events.")

    def get_queryset(self):
        user = self.request.user

        # ✅ Principal/Superuser ko sab events dikhein (approve/reject ke liye)
        if user.is_authenticated and (user.role in ['principal']):
            return Event.objects.all()
        
        # ✅ Admin ko sirf apne events dikhein
        if user.is_authenticated and user.role == 'admin':
            return Event.objects.filter(created_by=user)
        
        # ✅ Baqi sabko sirf approved events dikhein
        return Event.objects.filter(status='approved')

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        event = self.get_object()
        if request.user.role != 'principal':
            raise PermissionDenied("Only principal can approve events.")
        event.status = 'approved'
        event.save()
        return Response({'status': 'Event approved successfully'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        event = self.get_object()
        if request.user.role != 'principal':
            raise PermissionDenied("Only principal can reject events.")
        event.status = 'rejected'
        event.save()
        return Response({'status': 'Event rejected successfully'}, status=status.HTTP_200_OK)
