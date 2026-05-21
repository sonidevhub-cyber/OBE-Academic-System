from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Instructor
from .serializers import InstructorSerializer

class InstructorViewSet(viewsets.ModelViewSet):
    queryset = Instructor.objects.all()
    serializer_class = InstructorSerializer
    
    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=['get'])
    def profile(self, request):
        """Get the profile of the currently logged-in instructor."""
        try:
            instructor = Instructor.objects.get(user=request.user)
            serializer = InstructorSerializer(instructor, context={'request': request})
            return Response(serializer.data)
        except Instructor.DoesNotExist:
            # Fallback to basic user data if no instructor profile exists
            from core.serializers.user import UserListSerializer
            serializer = UserListSerializer(request.user, context={'request': request})
            return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='upload-image')
    def upload_image(self, request, pk=None):
        instructor = self.get_object()
        if 'image' not in request.FILES:
            return Response({'error': 'No image provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        instructor.image = request.FILES['image']
        instructor.save()
        return Response({
            'success': True,
            'image': request.build_absolute_uri(instructor.image.url) if instructor.image else None
        })