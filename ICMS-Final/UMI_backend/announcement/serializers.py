from rest_framework import serializers
from .models import Announcement



class AnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = ['id', 'title', 'message', 'created_at', 'created_by']
        read_only_fields = ['created_by', 'created_at']  # 👈 Important line