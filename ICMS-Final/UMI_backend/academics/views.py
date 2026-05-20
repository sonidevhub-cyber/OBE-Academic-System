from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
<<<<<<< HEAD
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Semester, Course
from .serializers import (
    SemesterSerializer, CourseSerializer
=======
from rest_framework.permissions import IsAuthenticated
from .models import Semester, Course, Timetable
from .serializers import (
    SemesterSerializer, CourseSerializer, AttendanceSerializer, 
    ResultSerializer, ScholarshipSerializer, CourseAllocationSerializer
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
)

class SemesterViewSet(viewsets.ModelViewSet):
    queryset = Semester.objects.all()
    serializer_class = SemesterSerializer

<<<<<<< HEAD
class SemesterViewSet(viewsets.ModelViewSet):
    queryset = Semester.objects.all()
    serializer_class = SemesterSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset()
        semester = self.request.query_params.get('semester', None)
        program = self.request.query_params.get('program', None)
        semester_num = self.request.query_params.get('semester_num', None)

        if semester:
            queryset = queryset.filter(semester_id=semester)
        
        if program:
            queryset = queryset.filter(semester__program_id=program)
        
        if semester_num:
            # Match semester name exactly like "Semester 1", "Semester 2", etc.
            # Using __iexact to be safe with casing
            queryset = queryset.filter(semester__name__iexact=f"Semester {semester_num}")
            
        return queryset


=======
class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def course_allocations(request):
    """
    Returns a list of course allocations (based on Timetable entries).
    """
    if not request.user.is_authenticated:
        return Response(status=status.HTTP_401_UNAUTHORIZED)
    
    # If it's an instructor, only show their allocations
    if request.user.role == 'instructor':
        allocations = Timetable.objects.filter(instructor=request.user)
    else:
        allocations = Timetable.objects.all()
        
    serializer = CourseAllocationSerializer(allocations, many=True)
    return Response(serializer.data)
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
