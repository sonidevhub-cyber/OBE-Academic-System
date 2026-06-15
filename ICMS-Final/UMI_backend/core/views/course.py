from django.db import transaction
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from django.core.exceptions import ValidationError

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
        semester_num = self.request.query_params.get('semester_num')
        course_type = self.request.query_params.get('course_type')

        if program_id:
            qs = qs.filter(program_id=program_id)

        if semester_id:
            qs = qs.filter(semester_id=semester_id)

        if semester_num:
            qs = qs.filter(semester__number=semester_num)

        # ✅ IMPORTANT (lab parent dropdown ke liye)
        if course_type:
            qs = qs.filter(course_type=course_type)

        return qs.order_by('semester__number', 'name')

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            course = serializer.save()

            # 🔥 Ensure model validation runs
            course.full_clean()
            course.save()

        except ValidationError as e:
            return Response(
                {"error": e.message_dict if hasattr(e, "message_dict") else str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            CourseSerializer(course).data,
            status=status.HTTP_201_CREATED
        )