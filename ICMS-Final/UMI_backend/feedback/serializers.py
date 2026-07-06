# feedback/serializers.py

from rest_framework import serializers
from .models import FeedbackResponse


class FeedbackResponseSerializer(serializers.Serializer):
    course = serializers.UUIDField()
    clo = serializers.UUIDField()
    rating = serializers.IntegerField(min_value=1, max_value=5)