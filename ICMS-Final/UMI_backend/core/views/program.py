from django.db import transaction
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models.program import Program
from core.models.semester import Semester
from core.permissions import IsSAC
from core.serializers.program import ProgramCreateSerializer, ProgramDetailSerializer, ProgramListSerializer


class ProgramListCreateView(generics.ListCreateAPIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsSAC()]

    def get_serializer_class(self):
        return ProgramCreateSerializer if self.request.method == 'POST' else ProgramListSerializer

    def get_queryset(self):
        return Program.objects.all().filter(is_active=True)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        program = serializer.save()

        for i in range(1, program.total_semesters + 1):
            Semester.objects.create(program=program, number=i, name=f"Semester {i}")

        return Response(ProgramDetailSerializer(program).data, status=status.HTTP_201_CREATED)


class ProgramDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsSAC]
    queryset = Program.objects.all()

    def get_serializer_class(self):
        return ProgramDetailSerializer

    @transaction.atomic
    def patch(self, request, *args, **kwargs):
        program = self.get_object()
        for field in ['name', 'code', 'description']:
            if field in request.data:
                setattr(program, field, request.data[field])
        program.save(update_fields=[f for f in ['name', 'code', 'description'] if f in request.data])
        return Response(ProgramDetailSerializer(program).data, status=status.HTTP_200_OK)


class ProgramDeleteView(generics.GenericAPIView):
    permission_classes = [IsSAC]

    def delete(self, request, pk):
        program = Program.objects.get(pk=pk)
        program.is_active = False
        program.save(update_fields=['is_active'])
        return Response({'success': True}, status=status.HTTP_200_OK)

