from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from .models import Student
from .serializers import StudentSerializer
from core.permissions import IsSAC
from core.responses import api_response

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

class StudentViewSet(viewsets.ModelViewSet):
    serializer_class = StudentSerializer
    pagination_class = StandardResultsSetPagination
    
    def get_queryset(self):
        from django.db.models import Prefetch
        from curriculum.models import CurriculumVersionCourse
        
        queryset = Student.objects.all().select_related(
            'user', 
            'user__batch', 
            'user__batch__program', 
            'user__batch__curriculum_version',
            'department'
        ).prefetch_related(
            Prefetch(
                'user__batch__curriculum_version__version_courses',
                queryset=CurriculumVersionCourse.objects.select_related('course').all()
            )
        )
        
        batch_id = self.request.query_params.get('batch')
        role = self.request.query_params.get('role')
        
        if batch_id:
            queryset = queryset.filter(user__batch_id=batch_id)
        if role:
            queryset = queryset.filter(user__role=role)
            
        return queryset
    
    def get_permissions(self):
        if self.action == 'profile':
            return [permissions.IsAuthenticated()]
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsSAC()]

    @action(detail=False, methods=['get'])
    def profile(self, request):
        from core.serializers.user import UserListSerializer

        user = request.user
        data = UserListSerializer(user, context={'request': request}).data

        try:
            student = Student.objects.select_related(
                'user', 
                'user__batch', 
                'user__batch__program', 
                'user__batch__curriculum_version',
                'department'
            ).prefetch_related(
                'user__batch__curriculum_version__version_courses__course'
            ).get(user=user)
            serializer = StudentSerializer(student, context={'request': request})
            student_data = serializer.data

            # Merge data
            for key, value in student_data.items():
                if key not in ['id', 'user']:
                    data[key] = value

        except Student.DoesNotExist:
            pass

        return api_response(data=data, message="Student profile retrieved successfully")

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
