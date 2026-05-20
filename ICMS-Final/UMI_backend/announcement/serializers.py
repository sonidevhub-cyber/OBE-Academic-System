from rest_framework import serializers
from .models import Announcement

class AnnouncementSerializer(serializers.ModelSerializer):
    author_name = serializers.ReadOnlyField(source='author.full_name')
    message = serializers.CharField(source='content')

    class Meta:
        model = Announcement
        fields = ['id', 'title', 'message', 'author', 'author_name', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']
