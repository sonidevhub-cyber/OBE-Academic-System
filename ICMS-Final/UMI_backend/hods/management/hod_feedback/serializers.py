from rest_framework import serializers
from feedback.models import Feedback

class HODFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = [
            "id",
            "feedback_type",
            "title",
            "message",
            "rating",
            "semester",
            "subject_area",
            "created_at",
            "is_reviewed",
        ]