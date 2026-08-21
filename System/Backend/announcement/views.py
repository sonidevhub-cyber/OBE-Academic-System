from rest_framework import generics, permissions
from .models import Announcement
from .serializers import AnnouncementSerializer

class AnnouncementListCreateView(generics.ListCreateAPIView):
    queryset = Announcement.objects.filter(is_active=True)
    serializer_class = AnnouncementSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

class AnnouncementDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Announcement.objects.all()
    serializer_class = AnnouncementSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]
