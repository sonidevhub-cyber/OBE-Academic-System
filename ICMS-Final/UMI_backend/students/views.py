from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Student
from .serializers import StudentSerializer
from core.permissions import IsSAC

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all().select_related('user', 'department')
    serializer_class = StudentSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        batch_id = self.request.query_params.get('batch')
        role = self.request.query_params.get('role')
        
        if batch_id:
            queryset = queryset.filter(user__batch_id=batch_id)
        if role:
            queryset = queryset.filter(user__role=role)
            
        return queryset
    
    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsSAC()]

    @action(detail=True, methods=['post'], url_path='upload-image')
    def upload_image(self, request, pk=None):
        student = self.get_object()
        if 'image' not in request.FILES:
            return Response({
                'error': 'No image provided',
                'received_files': list(request.FILES.keys()),
            }, status=status.HTTP_400_BAD_REQUEST)
        
        student.image = request.FILES['image']
        student.save()
        return Response({
            'success': True,
            'image': request.build_absolute_uri(student.image.url) if student.image else None
        })
