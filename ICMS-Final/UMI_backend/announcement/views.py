from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Announcement
from .serializers import AnnouncementSerializer

class AnnouncementViewSet(viewsets.ModelViewSet):
    queryset = Announcement.objects.all().order_by('-created_at')
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAuthenticated]  # 👈 Sirf logged-in users create/update kar sakte

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)  # 👈 Automatically user set karega