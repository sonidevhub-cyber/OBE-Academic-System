from django.db import transaction
from rest_framework import generics, status
from rest_framework.response import Response

from core.models.batch import Batch
from core.permissions import IsSAC
from django.contrib.auth import get_user_model


User = get_user_model()


class ProvisionalPromoteAllView(generics.GenericAPIView):
    permission_classes = [IsSAC]

    @transaction.atomic
    def post(self, request, program_id, batch_id):
        batch = Batch.objects.select_for_update().get(program_id=program_id, pk=batch_id)

        if batch.status == 'graduated':
            return Response({'error': 'Batch already graduated'}, status=status.HTTP_400_BAD_REQUEST)

        if batch.current_semester >= batch.program.total_semesters:
            return Response({'error': 'Already at final semester'}, status=status.HTTP_400_BAD_REQUEST)

        next_sem = batch.current_semester + 1
        
        # Removed restrictive session-type check that prevented standard 1-increment promotion
        
        batch.current_semester = next_sem
        batch.save(update_fields=['current_semester'])

        count = User.objects.filter(
            batch=batch,
            role='student',
            is_active=True,
        ).update(current_semester=next_sem, promotion_status='provisional')

        return Response({'success': True, 'new_semester': next_sem, 'promoted_count': count}, status=status.HTTP_200_OK)


class MarkAsRepeatView(generics.GenericAPIView):
    permission_classes = [IsSAC]

    @transaction.atomic
    def patch(self, request, program_id, batch_id, student_id):
        student = User.objects.select_for_update().get(pk=student_id, batch_id=batch_id, role='student')

        if student.promotion_status != 'provisional':
            return Response({'error': 'Student is not in provisional status'}, status=status.HTTP_400_BAD_REQUEST)

        if student.promotion_status == 'repeat':
            return Response({'error': 'Already marked as repeat'}, status=status.HTTP_400_BAD_REQUEST)

        student.promotion_status = 'repeat'
        student.current_semester = student.current_semester - 1
        student.save(update_fields=['promotion_status', 'current_semester'])

        return Response({'success': True, 'student_name': student.full_name, 'repeat_semester': student.current_semester}, status=status.HTTP_200_OK)


from rest_framework.views import APIView


class PendingTransfersView(APIView):
    permission_classes = [IsSAC]


    def get(self, request):
        students = User.objects.filter(
            role='student',
            promotion_status='repeat',
            is_active=True,
        ).select_related('batch', 'original_batch')

        data = []
        for s in students:
            # Check eligible batch exists
            has_eligible = False
            if s.batch:
                has_eligible = Batch.objects.filter(
                    current_semester=s.current_semester,
                    session_type=s.batch.session_type,
                    status='active'
                ).exclude(id=s.batch.id).exists()

            data.append({
                'id': str(s.id),
                'full_name': s.full_name,
                'email': s.email,
                'current_batch': s.batch.name if s.batch else None,
                'original_batch': s.original_batch.name if s.original_batch else None,
                'current_semester': s.current_semester,
                'session_type': s.batch.session_type if s.batch else None,
                'has_eligible_batch': has_eligible,
            })

        return Response(data, status=status.HTTP_200_OK)


class EligibleBatchesView(APIView):
    permission_classes = [IsSAC]

    def get(self, request, pk):
        try:
            student = User.objects.get(pk=pk, role='student')
        except User.DoesNotExist:
            return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)
            
<<<<<<< HEAD
        if not student.batch:
=======
        base_batch = student.batch or student.original_batch
        if not base_batch:
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
            return Response({'eligible_batches': [], 'has_eligible': False})

        batches = Batch.objects.filter(
            current_semester=student.current_semester,
<<<<<<< HEAD
            session_type=student.batch.session_type,
            status='active'
        ).exclude(id=student.batch.id)
=======
            session_type=base_batch.session_type,
            status='active'
        ).exclude(id=base_batch.id)

>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03

        data = [
            {
                'id': str(b.id),
                'name': b.name,
                'current_semester': b.current_semester,
                'session_type': b.session_type,
                'student_count': User.objects.filter(batch=b, role='student', is_active=True).count()
            }
            for b in batches
        ]

        return Response({
            'eligible_batches': data,
            'has_eligible': len(data) > 0
        }, status=status.HTTP_200_OK)


class TransferStudentView(APIView):
    permission_classes = [IsSAC]

    @transaction.atomic
    def patch(self, request, pk):
        try:
            student = User.objects.select_for_update().get(pk=pk, role='student')
        except User.DoesNotExist:
            return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)
            
        new_batch_id = request.data.get('new_batch_id')

        if not new_batch_id:
            return Response({'error': 'New batch ID is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_batch = Batch.objects.get(pk=new_batch_id)
        except Batch.DoesNotExist:
            return Response({'error': 'Target batch not found'}, status=status.HTTP_404_NOT_FOUND)

        # Basic validation: session type and semester should match
        if student.batch and new_batch.session_type != student.batch.session_type:
            return Response({'error': 'Session type mismatch'}, status=status.HTTP_400_BAD_REQUEST)

        if new_batch.current_semester != student.current_semester:
            return Response({'error': 'Semester mismatch'}, status=status.HTTP_400_BAD_REQUEST)

        old_batch_name = student.batch.name if student.batch else "None"
        
        # If student doesn't have an original_batch yet, set current as original
        if not student.original_batch:
            student.original_batch = student.batch

        student.batch = new_batch
        student.promotion_status = 'none' # Reset status after transfer
        student.save(update_fields=['batch', 'original_batch', 'promotion_status'])

        return Response({
            'success': True,
            'message': f'Student transferred to {new_batch.name}',
            'student_name': student.full_name,
            'old_batch': old_batch_name,
            'new_batch': new_batch.name,
            'semester': student.current_semester
        }, status=status.HTTP_200_OK)
