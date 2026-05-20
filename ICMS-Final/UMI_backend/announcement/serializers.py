from rest_framework import serializers
from .models import Announcement

class AnnouncementSerializer(serializers.ModelSerializer):
    author_name = serializers.ReadOnlyField(source='author.full_name')
    message = serializers.CharField(source='content', required=False)

    class Meta:
        model = Announcement
        fields = [
            'id',
            'title',
            'content',
            'message',
            'type',
            'file',
            'author',
            'author_name',
            'is_pinned',
            'is_active',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']