from rest_framework import generics, permissions
from .models import Announcement
from .serializers import AnnouncementSerializer

<<<<<<< HEAD
class AnnouncementListCreateView(generics.ListCreateAPIView):
    queryset = Announcement.objects.filter(is_active=True)
=======

class AnnouncementListCreateView(generics.ListCreateAPIView):
    queryset = Announcement.objects.all()
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
    serializer_class = AnnouncementSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
<<<<<<< HEAD
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]
=======
            return [permissions.AllowAny()]   # ✅ public read
        return [permissions.IsAuthenticated()]  # ✅ only HOD upload
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

<<<<<<< HEAD
=======

>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
class AnnouncementDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Announcement.objects.all()
    serializer_class = AnnouncementSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
<<<<<<< HEAD
        return [permissions.IsAuthenticated()]
=======
        return [permissions.IsAuthenticated()]
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
