from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .professional_feedback_models import Feedback
from .notification_models import FeedbackNotification
from .models import Student
from academics.models import Department

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_feedback(request):
    """Student submits anonymous feedback"""
    try:
        # Get student to verify they're a student and get their department
        student = Student.objects.get(user=request.user)
        
        feedback = Feedback.objects.create(
            department=student.department,
            feedback_type=request.data.get('feedback_type', 'general'),
            title=request.data.get('title'),
            message=request.data.get('message'),
            rating=request.data.get('rating', 3),
            semester=request.data.get('semester', ''),
            subject_area=request.data.get('subject_area', '')
        )
        
        # Create notification for department HOD
        try:
            from hods.models import HOD
            hod = HOD.objects.get(department=student.department)
            FeedbackNotification.objects.create(
                hod=hod,
                feedback=feedback,
                message=f"New feedback: {feedback.title}"
            )
        except HOD.DoesNotExist:
            pass  # No HOD for this department
        
        return Response({
            'success': True,
            'message': 'Feedback submitted successfully. Thank you for your input!'
        }, status=status.HTTP_201_CREATED)
        
    except Student.DoesNotExist:
        return Response({'error': 'Only students can submit feedback'}, status=status.HTTP_403_FORBIDDEN)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_department_feedback(request):
    """HOD gets all feedback for their department"""
    try:
        from hods.models import HOD
        try:
            hod = HOD.objects.get(user=request.user)
        except HOD.DoesNotExist:
            return Response({'error': 'Only HODs can view feedback'}, status=status.HTTP_403_FORBIDDEN)
        
        feedbacks = Feedback.objects.filter(department=hod.department)
        
        feedback_data = []
        for feedback in feedbacks:
            feedback_data.append({
                'id': feedback.id,
                'title': feedback.title,
                'message': feedback.message,
                'feedback_type': feedback.feedback_type,
                'rating': feedback.rating,
                'semester': feedback.semester,
                'subject_area': feedback.subject_area,
                'created_at': feedback.created_at.isoformat(),
                'is_reviewed': feedback.is_reviewed
            })
        
        return Response({
            'success': True,
            'feedbacks': feedback_data,
            'count': len(feedback_data)
        })
        
    except Exception as e:
        print(f"Error in get_department_feedback: {str(e)}")
        return Response({'error': f'Error fetching feedback: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def mark_feedback_reviewed(request, feedback_id):
    """HOD marks feedback as reviewed"""
    try:
        from hods.models import HOD
        try:
            hod = HOD.objects.get(user=request.user)
        except HOD.DoesNotExist:
            return Response({'error': 'Only HODs can mark feedback as reviewed'}, status=status.HTTP_403_FORBIDDEN)
        
        feedback = get_object_or_404(Feedback, pk=feedback_id, department=hod.department)
        feedback.is_reviewed = True
        feedback.save()
        
        return Response({
            'success': True,
            'message': 'Feedback marked as reviewed'
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_hod_notifications(request):
    """Get notifications for HOD"""
    try:
        from hods.models import HOD
        hod = HOD.objects.get(user=request.user)
        
        notifications = FeedbackNotification.objects.filter(hod=hod)
        
        notification_data = []
        for notification in notifications:
            notification_data.append({
                'id': notification.id,
                'message': notification.message,
                'feedback_id': notification.feedback.id,
                'feedback_title': notification.feedback.title,
                'is_read': notification.is_read,
                'created_at': notification.created_at.isoformat()
            })
        
        return Response({
            'success': True,
            'notifications': notification_data,
            'unread_count': notifications.filter(is_read=False).count()
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, notification_id):
    """Mark notification as read"""
    try:
        from hods.models import HOD
        hod = HOD.objects.get(user=request.user)
        
        notification = get_object_or_404(FeedbackNotification, id=notification_id, hod=hod)
        notification.is_read = True
        notification.save()
        
        return Response({'success': True})
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)