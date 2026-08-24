from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.db import transaction
from django.utils import timezone
from .models import Student
from .serializers import StudentSerializer
from core.models.batch import Batch
from core.permissions import IsSAC
from core.responses import api_response

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

class StudentViewSet(viewsets.ModelViewSet):
    serializer_class = StudentSerializer
    pagination_class = StandardResultsSetPagination
    
    def get_queryset(self):
        from django.db.models import Prefetch
        from curriculum.models import CurriculumVersionCourse
        
        queryset = Student.objects.all().select_related(
            'user', 
            'user__batch', 
            'user__batch__program', 
            'user__batch__curriculum_version',
            'department',
            'batch',
            'original_batch',
        ).prefetch_related(
            Prefetch(
                'user__batch__curriculum_version__version_courses',
                queryset=CurriculumVersionCourse.objects.select_related('course').all()
            )
        )
        
        batch_id = self.request.query_params.get('batch')
        role = self.request.query_params.get('role')
        
        if batch_id:
            queryset = queryset.filter(user__batch_id=batch_id)
        if role:
            queryset = queryset.filter(user__role=role)
            
        return queryset
    
    def get_permissions(self):
        if self.action == 'profile':
            return [permissions.IsAuthenticated()]
        if self.action in ['freeze', 'unfreeze']:
            return [IsSAC()]
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsSAC()]

    def _get_live_batch(self, student):
        return student.batch or getattr(student.user, 'batch', None)

    def _is_freezable(self, student):
        from assessments.models import Assessment
        from obe.models import CourseSession

        batch = self._get_live_batch(student)
        current_semester = getattr(student.user, 'current_semester', None)
        if not batch or not current_semester:
            return False

        sessions = CourseSession.objects.filter(
            batch=batch,
            semester__number=current_semester,
            is_active=True,
        ).select_related('course', 'semester')
        sessions = list(sessions)
        if not sessions:
            return False

        return all(
            Assessment.objects.filter(
                course=session.course,
                batch=batch,
                semester=session.semester,
                assessment_type='final',
                course_retake__isnull=True,
                is_finalized=True,
                is_locked=True,
            ).exists()
            for session in sessions
        )

    def _batch_payload(self, batch):
        return {
            'id': str(batch.id),
            'batch_name': batch.name,
            'name': batch.name,
            'current_semester': batch.current_semester,
            'program_id': str(batch.program_id),
        }

    @action(detail=False, methods=['get'])
    def profile(self, request):
        from core.serializers.user import UserListSerializer

        user = request.user
        data = UserListSerializer(user, context={'request': request}).data

        try:
            student = Student.objects.select_related(
                'user', 
                'user__batch', 
                'user__batch__program', 
                'user__batch__curriculum_version',
                'department'
            ).prefetch_related(
                'user__batch__curriculum_version__version_courses__course'
            ).get(user=user)
            serializer = StudentSerializer(student, context={'request': request})
            student_data = serializer.data

            # Merge data
            for key, value in student_data.items():
                if key not in ['id', 'user']:
                    data[key] = value

        except Student.DoesNotExist:
            pass

        return api_response(data=data, message="Student profile retrieved successfully")

    @action(detail=True, methods=['post'], url_path='upload-image')
    def upload_image(self, request, pk=None):
        student = self.get_object()
        if 'image' not in request.FILES:
            return Response({
                'error': 'No image provided',
                'received_files': list(request.FILES.keys()),
            }, status=status.HTTP_400_BAD_REQUEST)
        
        student.image = request.FILES['image']
        student.save()
        return Response({
            'success': True,
            'image': request.build_absolute_uri(student.image.url) if student.image else None
        })

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def freeze(self, request, pk=None):
        student = Student.objects.select_for_update().select_related(
            'user', 'user__batch', 'batch', 'original_batch'
        ).get(pk=pk)
        user = student.user
        batch = self._get_live_batch(student)

        if student.is_frozen:
            return Response({'error': 'Student is already frozen'}, status=status.HTTP_400_BAD_REQUEST)

        if not self._is_freezable(student):
            return Response(
                {'error': 'Cannot freeze — Final not yet submitted for one or more courses in the current semester.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            freeze_at_semester = int(request.data.get('freeze_at_semester'))
        except (TypeError, ValueError):
            return Response({'error': 'Valid freeze_at_semester is required'}, status=status.HTTP_400_BAD_REQUEST)

        current_semester = user.current_semester
        allowed_semesters = {current_semester}
        if current_semester and current_semester > 1:
            allowed_semesters.add(current_semester - 1)

        if freeze_at_semester not in allowed_semesters:
            return Response(
                {'error': 'freeze_at_semester must be current_semester or current_semester - 1'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        student.is_frozen = True
        student.frozen_at_semester = freeze_at_semester
        student.frozen_date = timezone.now()
        if not student.original_batch:
            student.original_batch = batch

        user.current_semester = freeze_at_semester
        user.save(update_fields=['current_semester'])
        student.save(update_fields=[
            'is_frozen', 'frozen_at_semester', 'frozen_date', 'original_batch'
        ])

        return Response({
            'success': True,
            'message': f'{user.full_name} frozen at Semester {freeze_at_semester}',
            'student': StudentSerializer(student, context={'request': request}).data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def unfreeze(self, request, pk=None):
        student = Student.objects.select_for_update().select_related(
            'user', 'user__batch', 'batch', 'original_batch'
        ).get(pk=pk)
        user = student.user
        live_batch = self._get_live_batch(student)

        if not student.is_frozen:
            return Response({'error': 'Student is not frozen'}, status=status.HTTP_400_BAD_REQUEST)

        current_semester = user.current_semester
        program = (
            getattr(live_batch, 'program', None)
            or getattr(student.original_batch, 'program', None)
            or getattr(getattr(user, 'original_batch', None), 'program', None)
        )
        if not current_semester or not program:
            return Response(
                {'error': 'Student semester or program is missing; assign manually before unfreezing.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        active_batches = Batch.objects.filter(
            program=program,
            status='active',
            is_active=True,
        ).order_by('-start_year', 'name')

        target_batch_id = request.data.get('target_batch_id')
        if target_batch_id:
            try:
                target_batch = active_batches.get(id=target_batch_id)
            except Batch.DoesNotExist:
                return Response({'error': 'Target batch not found for this program'}, status=status.HTTP_404_NOT_FOUND)
            if target_batch.current_semester != current_semester:
                return Response({'error': 'Target batch semester mismatch'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            matches = list(active_batches.filter(current_semester=current_semester))
            if len(matches) == 0:
                return Response({
                    'error': f'No active batch currently at Semester {current_semester} for this program — assign manually or create a new batch',
                    'active_batches': [self._batch_payload(batch) for batch in active_batches],
                }, status=status.HTTP_409_CONFLICT)
            if len(matches) > 1:
                return Response({
                    'error': 'Multiple active batches match this semester; choose a target_batch_id.',
                    'candidate_batches': [self._batch_payload(batch) for batch in matches],
                }, status=status.HTTP_409_CONFLICT)
            target_batch = matches[0]

        user.batch = target_batch
        student.batch = target_batch
        student.is_frozen = False

        user.save(update_fields=['batch'])
        student.save(update_fields=['batch', 'is_frozen'])

        return Response({
            'success': True,
            'message': f'{user.full_name} rejoined {target_batch.name}',
            'assigned_batch': self._batch_payload(target_batch),
            'student': StudentSerializer(student, context={'request': request}).data,
        }, status=status.HTTP_200_OK)

