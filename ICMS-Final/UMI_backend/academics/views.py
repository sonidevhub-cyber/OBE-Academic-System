from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Semester, Course, Timetable
from .serializers import (
    SemesterSerializer, CourseSerializer, AttendanceSerializer, 
    ResultSerializer, ScholarshipSerializer, CourseAllocationSerializer
)

class SemesterViewSet(viewsets.ModelViewSet):
    queryset = Semester.objects.all()
    serializer_class = SemesterSerializer

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