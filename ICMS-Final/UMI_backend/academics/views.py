from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Semester, Course
from .serializers import (
    SemesterSerializer, CourseSerializer
)


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
        batch_id = self.request.query_params.get('batch_id', None)

        if semester:
            queryset = queryset.filter(semester_id=semester)
        
        if program:
            queryset = queryset.filter(semester__program_id=program)
        
        if semester_num:
            # Match semester name exactly like "Semester 1", "Semester 2", etc.
            # Using __iexact to be safe with casing
            queryset = queryset.filter(semester__name__iexact=f"Semester {semester_num}")
            
        if batch_id:
            queryset = queryset.filter(batch_id=batch_id)
            
        return queryset