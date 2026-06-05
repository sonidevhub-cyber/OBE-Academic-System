from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import F
from .models import Instructor
from .serializers import InstructorSerializer
from coordinators.models import TeacherAllocation
from coordinators.serializers import TeacherAllocationSerializer

class InstructorViewSet(viewsets.ModelViewSet):
    queryset = Instructor.objects.all()
    serializer_class = InstructorSerializer
    
    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=['get'], url_path='my-courses')
    def my_courses(self, request):
        """Get courses allocated to the currently logged-in instructor."""
        user = request.user
        
        # Log for debugging - Using 'email' instead of 'username' since CustomUser uses email
        print(f"Fetching courses for user: {user.email}, ID: {user.id}, Role: {getattr(user, 'role', 'N/A')}")
        
        allocations = TeacherAllocation.objects.filter(
            teacher=user,
            is_active=True,
            status='active',
            batch__status='active',
            semester_no=F('batch__current_semester')
        ).select_related('course', 'batch', 'curriculum_version')
        
        print(f"Found {allocations.count()} active allocations")
        
        data = []
        for alloc in allocations:
            data.append({
                'id': alloc.id,
                'allocation_id': alloc.id,
                'course_id': alloc.course.id,
                'course_name': alloc.course.name,
                'course_code': alloc.course.code,
                'course_description': alloc.course.description if hasattr(alloc.course, 'description') else '',
                'credits': alloc.course.credit_hours,
                'credit_hours': alloc.course.credit_hours,
                'batch_id': alloc.batch.id,
                'batch_name': alloc.batch.name,
                'semester_no': alloc.semester_no,
                'semester_name': f"Semester {alloc.semester_no}",
                'department': alloc.batch.program.department.name if hasattr(alloc.batch.program, 'department') else 'N/A',
                'coordinator_name': alloc.allocated_by.full_name if alloc.allocated_by else 'N/A',
                'curriculum_version': alloc.curriculum_version.version_no,
                'curriculum_version_id': alloc.curriculum_version.id,
                'status': 'active'
            })
            
        return Response({'courses': data, 'results': data}) # Wrapped for different component expectations

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