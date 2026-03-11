from django.contrib import admin
from .models import Feedback, FeedbackNotification

@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ['title', 'department', 'feedback_type', 'rating', 'is_reviewed', 'created_at']
    list_filter = ['feedback_type', 'rating', 'is_reviewed', 'department', 'created_at']
    search_fields = ['title', 'message', 'subject_area']
    readonly_fields = ['created_at']

@admin.register(FeedbackNotification)
class FeedbackNotificationAdmin(admin.ModelAdmin):
    list_display = ['hod', 'message', 'is_read', 'created_at']
    list_filter = ['is_read', 'created_at']
    readonly_fields = ['created_at']