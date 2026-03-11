from rest_framework import serializers
from .models import Feedback, FeedbackNotification

class FeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = ['id', 'department', 'feedback_type', 'title', 'message', 'rating', 
                 'semester', 'subject_area', 'created_at', 'is_reviewed']
        read_only_fields = ['id', 'created_at']

class FeedbackNotificationSerializer(serializers.ModelSerializer):
    feedback_title = serializers.CharField(source='feedback.title', read_only=True)
    
    class Meta:
        model = FeedbackNotification
        fields = ['id', 'message', 'feedback', 'feedback_title', 'is_read', 'created_at']
        read_only_fields = ['id', 'created_at']