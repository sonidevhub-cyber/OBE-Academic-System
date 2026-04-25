from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rbac.permissions import HasRBACPermission
from .models import Announcement
from .serializers import AnnouncementSerializer

class AnnouncementViewSet(viewsets.ModelViewSet):
    queryset = Announcement.objects.all().order_by('-created_at')
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAuthenticated, HasRBACPermission]
    required_permission = 'manage_announcements'

    def get_permissions(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), HasRBACPermission()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)  # 👈 Automatically user set karega
