from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.response import Response

from core.models.batch import Batch
from core.permissions import IsSAC, IsSACOrCoordinator
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


class BatchDetailView(generics.RetrieveUpdateAPIView):
    def get_serializer_class(self):
        return BatchCreateSerializer if self.request.method in ['PUT', 'PATCH'] else BatchListSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsSAC()]

    def get_queryset(self):
        return Batch.objects.filter(program_id=self.kwargs['program_id'], is_active=True)
    
    def update(self, request, *args, **kwargs):
        from curriculum.models import CurriculumVersion
        from curriculum.services import clone_curriculum_for_batch, create_offerings_from_version
        
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        curriculum_version_id = request.data.get('curriculum_version_id')
        if curriculum_version_id:
            try:
                master_version = CurriculumVersion.objects.get(id=curriculum_version_id, program=instance.program, status='finalized')
                user = request.user if request.user else instance.program.created_by
                clone_curriculum_for_batch(master_version, instance, user)
                # Also ensure CourseSessions are created!
                create_offerings_from_version(master_version)
            except CurriculumVersion.DoesNotExist:
                pass
        
        self.perform_update(serializer)
        return Response(BatchListSerializer(instance).data, status=status.HTTP_200_OK)


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
        if not batch.exit_survey_enabled:
            return Response({'error': 'Exit survey not enabled for this batch'}, status=status.HTTP_400_BAD_REQUEST)

        total_students = User.objects.filter(batch=batch, role='student').count()
        pending_surveys = batch.pending_exit_survey_count
        responded_students = max(total_students - pending_surveys, 0)
        required_responses = max(1, (total_students + 1) // 2)

        if total_students <= 0:
            return Response({'error': 'No students enrolled in this batch'}, status=status.HTTP_400_BAD_REQUEST)

        if responded_students < required_responses:
            return Response(
                {
                    'error': (
                        f'Cannot graduate: {responded_students}/{total_students} students have submitted '
                        'the exit survey. At least 50% is required.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        batch.status = 'graduated'
        batch.graduated_at = timezone.now()
        batch.graduation_status = 'graduated_complete'
        batch.save(update_fields=['status', 'graduated_at', 'graduation_status'])

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
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = BatchListSerializer

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
        )

    def get_queryset(self):
        queryset = Batch.objects.filter(is_active=True).select_related('program')
        alumni_feedback = self.request.query_params.get('alumni_feedback')
        if alumni_feedback and alumni_feedback.lower() in ['1', 'true', 'yes']:
            queryset = queryset.filter(
                status='graduated',
                graduated_at__isnull=False,
            )
        elif alumni_feedback and alumni_feedback.lower() == 'all':
            # Don't filter by status, return both active and graduated
            pass
        else:
            queryset = queryset.filter(status='active')
        program_id = self.request.query_params.get('program')
        if program_id:
            queryset = queryset.filter(program_id=program_id)
        return queryset

