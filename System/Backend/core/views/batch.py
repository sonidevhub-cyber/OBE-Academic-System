from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.response import Response

from core.models.batch import Batch, BatchFrameworkSnapshotFillAudit
from core.permissions import (
    IsHOD,
    IsSAC,
    IsSACOrCoordinator,
    CanAccessFrameworkSnapshot,
    IsHODDepartmentOnly,
    IsHODOrCoordinator,
    _get_user_department,
)
from core.serializers.batch import (
    BatchCreateSerializer,
    BatchFrameworkSnapshotCopySerializer,
    BatchFrameworkSnapshotSerializer,
    BatchListSerializer,
    BatchStructureSerializer,
    DossierListSerializer,
)
from core.serializers.user import UserListSerializer
from django.contrib.auth import get_user_model
from rest_framework.views import APIView


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
        from curriculum.services import branch_version_if_needed, create_offerings_from_version
        
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        curriculum_version_id = request.data.get('curriculum_version_id')
        if curriculum_version_id:
            try:
                master_version = CurriculumVersion.objects.get(id=curriculum_version_id, program=instance.program, status='finalized')
                user = request.user if request.user else instance.program.created_by
                branch_version_if_needed(master_version, instance, user)
                # Also ensure CourseSessions are created!
                create_offerings_from_version(master_version)
            except CurriculumVersion.DoesNotExist:
                pass
        
        self.perform_update(serializer)
        return Response(BatchListSerializer(instance, context=self.get_serializer_context()).data, status=status.HTTP_200_OK)


class BatchStudentListView(generics.ListAPIView):
    serializer_class = UserListSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsSAC()]

    def get_queryset(self):
        batch_id = self.kwargs['pk']
        return User.objects.filter(
            batch_id=batch_id,
            role='student',
            is_active=True,
        ).order_by('custom_id')


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
        queryset = Batch.objects.filter(is_active=True).select_related('program', 'program__department')
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


class BatchSemesterSelectorView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, batch_id):
        from assessments.workflows import derive_batch_semester_status, get_permitted_actions
        from core.models import Semester

        try:
            batch = Batch.objects.select_related('program').get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)

        semesters = Semester.objects.filter(
            program=batch.program,
            is_active=True,
            number__lte=batch.current_semester,
        ).order_by('-number')

        data = []
        for semester in semesters:
            status_value = derive_batch_semester_status(batch, semester)
            data.append({
                'id': str(semester.id),
                'number': semester.number,
                'name': semester.name,
                'status': status_value,
                'is_current': semester.number == batch.current_semester,
                'permitted_actions': get_permitted_actions(status_value),
            })

        return Response({
            'batch': {
                'id': str(batch.id),
                'name': batch.name,
                'current_semester': batch.current_semester,
            },
            'semesters': data,
        })


class BatchFrameworkSnapshotView(generics.RetrieveAPIView):
    """Read-only locked framework snapshot per batch (role-scoped access).

    Permission model (single endpoint, role-based branching via
    CanAccessFrameworkSnapshot):

    * HOD — any batch whose program.department matches the HOD's department
      (user.instructor_profile.department).
    * Coordinator — only batches where batch.coordinator == request.user OR
      batch.program is one of the coordinator's assigned programs (user.programs M2M).
    * All other roles (SAC, Teacher, Student, Alumni) receive HTTP 403 Forbidden.

    The response is always built from the Batch instance's write-once snapshot
    JSON fields (peo_snapshot, ga_snapshot, vision_mission_snapshot) and NEVER
    from the live GA/PEO/VisionMission tables — snapshots are immutable once
    written at batch creation.
    """

    permission_classes = [CanAccessFrameworkSnapshot]
    serializer_class = BatchFrameworkSnapshotSerializer
    lookup_url_kwarg = 'pk'
    lookup_field = 'id'

    def get_queryset(self):
        return Batch.objects.filter(is_active=True).select_related('program')

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        lookup_kwarg = self.lookup_url_kwarg or self.lookup_field
        filter_kwargs = {self.lookup_field: self.kwargs[lookup_kwarg]}
        from django.shortcuts import get_object_or_404
        obj = get_object_or_404(queryset, **filter_kwargs)
        self.check_object_permissions(self.request, obj)
        return obj

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class BatchStructureView(generics.RetrieveAPIView):
    """Shared read-only batch structure endpoint for HOD and Coordinator."""

    permission_classes = [permissions.IsAuthenticated, IsHODOrCoordinator]
    serializer_class = BatchStructureSerializer
    lookup_url_kwarg = 'pk'
    lookup_field = 'id'

    def get_queryset(self):
        return Batch.objects.filter(is_active=True).select_related('program', 'curriculum_version')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        semester = self.request.query_params.get('semester')
        if semester not in (None, ''):
            try:
                context['semester'] = int(semester)
            except (TypeError, ValueError):
                context['semester'] = None
        else:
            context['semester'] = None
        return context


class BatchFrameworkSnapshotCopyView(APIView):
    """Manual recovery path for empty write-once batch framework snapshots."""

    permission_classes = [permissions.IsAuthenticated, CanAccessFrameworkSnapshot]

    def _snapshot_summary(self, field_name, snapshot):
        if field_name == 'ga':
            return {'captured_ga_count': len((snapshot or {}).get('gas') or [])}
        if field_name == 'peo':
            return {'captured_peo_count': len((snapshot or {}).get('peos') or [])}
        if field_name == 'vision_mission':
            vision = (snapshot or {}).get('vision') or {}
            mission = (snapshot or {}).get('mission') or {}
            return {
                'has_vision': bool(vision.get('vision_text') or vision.get('keywords')),
                'has_mission': bool(mission.get('mission_text') or mission.get('keywords')),
                'vision_keyword_count': len(vision.get('keywords') or []),
                'mission_keyword_count': len(mission.get('keywords') or []),
            }
        return {}

    @transaction.atomic
    def post(self, request, pk):
        serializer = BatchFrameworkSnapshotCopySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from django.shortcuts import get_object_or_404
        from obe.framework_snapshots import populate_batch_framework_snapshot

        batch = get_object_or_404(
            Batch.objects.select_for_update(of=('self',)).select_related('program', 'program__department'),
            id=pk,
            is_active=True,
        )
        self.check_object_permissions(request, batch)

        original = {
            'ga': batch.ga_snapshot,
            'peo': batch.peo_snapshot,
            'vision_mission': batch.vision_mission_snapshot,
        }
        populate_batch_framework_snapshot(batch)
        generated = {
            'ga': batch.ga_snapshot,
            'peo': batch.peo_snapshot,
            'vision_mission': batch.vision_mission_snapshot,
        }

        batch.ga_snapshot = original['ga']
        batch.peo_snapshot = original['peo']
        batch.vision_mission_snapshot = original['vision_mission']

        saved_fields = []
        results = {}
        errors = {}
        now = timezone.now()

        field_to_model_field = {
            'ga': 'ga_snapshot',
            'peo': 'peo_snapshot',
            'vision_mission': 'vision_mission_snapshot',
        }

        for field_name in serializer.validated_data['fields']:
            model_field = field_to_model_field[field_name]
            current_snapshot = getattr(batch, model_field)
            if not BatchFrameworkSnapshotSerializer.is_snapshot_empty(current_snapshot, field_name):
                errors[field_name] = f"{model_field} already set for this batch - write-once rule prevents overwrite"
                continue

            new_snapshot = generated[field_name]
            if BatchFrameworkSnapshotSerializer.is_snapshot_empty(new_snapshot, field_name):
                errors[field_name] = f"No current {field_name.replace('_', ' ')} framework data is available to copy"
                continue

            setattr(batch, model_field, new_snapshot)
            saved_fields.append(model_field)
            BatchFrameworkSnapshotFillAudit.objects.create(
                batch=batch,
                snapshot_field=field_name,
                filled_by=request.user,
                filled_at=now,
                snapshot_summary=self._snapshot_summary(field_name, new_snapshot),
            )
            results[field_name] = {
                'status': 'copied',
                'filled_at': now.isoformat(),
                'filled_by': str(request.user.id),
            }

        if saved_fields:
            batch.save(update_fields=saved_fields)

        response_status = status.HTTP_200_OK if results else status.HTTP_400_BAD_REQUEST
        return Response(
            {
                'batch_id': str(batch.id),
                'copied': results,
                'errors': errors,
                'snapshot_empty_fields': {
                    'ga': BatchFrameworkSnapshotSerializer.is_snapshot_empty(batch.ga_snapshot, 'ga'),
                    'peo': BatchFrameworkSnapshotSerializer.is_snapshot_empty(batch.peo_snapshot, 'peo'),
                    'vision_mission': BatchFrameworkSnapshotSerializer.is_snapshot_empty(
                        batch.vision_mission_snapshot,
                        'vision_mission',
                    ),
                },
            },
            status=response_status,
        )


class BatchDossierListView(generics.ListAPIView):
    """Lightweight HOD/Coordinator listing for the Batch Dossier Vault UI.

    Access: HOD and Coordinator. 403 for all other roles.

    The queryset is automatically scoped to the HOD's department or the
    coordinator's assigned programs.

    Query parameters:
      - program=<uuid>: restrict to a specific program (must still be within
        the HOD's department scope).
      - status=active|graduated: filter by batch.status.
    """

    permission_classes = [IsHODDepartmentOnly]
    serializer_class = DossierListSerializer

    def get_queryset(self):
        user = self.request.user
        base = Batch.objects.select_related('program').filter(is_active=True)

        if getattr(user, 'role', None) == 'hod' or getattr(user, 'secondary_role', None) == 'hod':
            dept = _get_user_department(user)
            if dept is not None:
                base = base.filter(program__department_id=dept.id)
            else:
                base = base.none()
        elif getattr(user, 'role', None) == 'coordinator' or getattr(user, 'secondary_role', None) == 'coordinator':
            base = base.filter(program__in=user.programs.all())
        else:
            base = base.none()

        program_id = self.request.query_params.get('program')
        if program_id:
            base = base.filter(program_id=program_id)

        status_filter = self.request.query_params.get('status')
        if status_filter and status_filter in ('active', 'graduated'):
            base = base.filter(status=status_filter)

        return base.order_by('-start_year', 'name')

