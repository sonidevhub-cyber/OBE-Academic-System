from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.response import Response

from core.models.batch import Batch
<<<<<<< HEAD
from core.permissions import IsSAC, IsSACOrCoordinator
=======
from core.permissions import IsSAC
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
from core.serializers.batch import BatchCreateSerializer, BatchListSerializer
from core.serializers.user import UserListSerializer
from django.contrib.auth import get_user_model


User = get_user_model()


class BatchListCreateView(generics.ListCreateAPIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsSAC()]

    def get_serializer_class(self):
        return BatchCreateSerializer if self.request.method == 'POST' else BatchListSerializer

    def get_queryset(self):
        program_id = self.kwargs['program_id']
        return Batch.objects.filter(program_id=program_id, is_active=True)

    def perform_create(self, serializer):
        serializer.save(program_id=self.kwargs['program_id'])


class BatchDetailView(generics.RetrieveAPIView):
    serializer_class = BatchListSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsSAC()]

    def get_queryset(self):
        return Batch.objects.filter(program_id=self.kwargs['program_id'], is_active=True)


class BatchStudentListView(generics.ListAPIView):
    serializer_class = UserListSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsSAC()]

    def get_queryset(self):
        batch_id = self.kwargs['pk']
        return User.objects.filter(batch_id=batch_id, role='student', is_active=True)


class GraduateBatchView(generics.GenericAPIView):
    permission_classes = [IsSAC]

    @transaction.atomic
    def patch(self, request, program_id, pk):
        batch = Batch.objects.select_for_update().get(program_id=program_id, pk=pk)
        if batch.status == 'graduated':
            return Response({'error': 'Already graduated'}, status=status.HTTP_400_BAD_REQUEST)
        if batch.current_semester < batch.program.total_semesters:
            return Response({'error': 'Not all semesters completed'}, status=status.HTTP_400_BAD_REQUEST)

        batch.status = 'graduated'
        batch.graduated_at = timezone.now()
        batch.save(update_fields=['status', 'graduated_at'])

        count = User.objects.filter(batch=batch, role='student').update(role='alumni')
        return Response({'success': True, 'batch_name': batch.name, 'alumni_count': count}, status=status.HTTP_200_OK)


class BatchDeactivateView(generics.GenericAPIView):
    permission_classes = [IsSAC]

    def delete(self, request, program_id, pk):
        batch = Batch.objects.get(program_id=program_id, pk=pk)
        batch.is_active = False
        batch.save(update_fields=['is_active'])
        return Response({'success': True}, status=status.HTTP_200_OK)


class AllBatchesView(generics.ListAPIView):
<<<<<<< HEAD
    permission_classes = [IsSACOrCoordinator]

    def get_queryset(self):
        queryset = Batch.objects.filter(is_active=True, status='active').select_related('program')
        program_id = self.request.query_params.get('program')
        if program_id:
            queryset = queryset.filter(program_id=program_id)
        return queryset
=======
    # Student registration dropdown needs to read available batches.
    # Previously this was restricted to IsSAC, which caused the dropdown to be empty.
    permission_classes = [permissions.AllowAny]


    def get_queryset(self):
        return Batch.objects.filter(is_active=True, status='active').select_related('program')
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03

    def list(self, request, *args, **kwargs):
        items = self.get_queryset()
        data = [
            {
                'id': str(b.id),
                'name': b.name,
<<<<<<< HEAD
                'program_id': str(b.program_id),
=======
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
                'program_name': b.program.name,
                'session_type': b.session_type,
                'current_semester': b.current_semester,
            }
            for b in items
        ]
        return Response(data, status=status.HTTP_200_OK)

