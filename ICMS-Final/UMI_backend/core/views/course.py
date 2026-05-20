from django.db import transaction
from rest_framework import generics, status, permissions
from rest_framework.response import Response

from core.models.course import Course
from core.permissions import IsSAC
from core.serializers.course import CourseCreateSerializer, CourseSerializer


class CourseListCreateView(generics.ListCreateAPIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsSAC()]

    def get_serializer_class(self):
        return CourseCreateSerializer if self.request.method == 'POST' else CourseSerializer

    def get_queryset(self):
        qs = Course.objects.filter(is_active=True)
        program_id = self.request.query_params.get('program_id')
        semester_id = self.request.query_params.get('semester_id')
<<<<<<< HEAD
        semester_num = self.request.query_params.get('semester_num')
=======
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
        
        if program_id:
            qs = qs.filter(program_id=program_id)
        if semester_id:
            qs = qs.filter(semester_id=semester_id)
<<<<<<< HEAD
        if semester_num:
            qs = qs.filter(semester__number=semester_num)
=======
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        course = serializer.save()
        return Response(CourseSerializer(course).data, status=status.HTTP_201_CREATED)

