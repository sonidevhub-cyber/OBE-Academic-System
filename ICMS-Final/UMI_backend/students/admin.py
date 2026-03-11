from django.contrib import admin
from .models import Student

from .professional_feedback_models import Feedback
from .notification_models import FeedbackNotification

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ['student_id', 'name', 'email', 'department', 'semester']
    list_filter = ['department', 'semester']
    search_fields = ['name', 'email', 'student_id']

@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ['title', 'department', 'feedback_type', 'rating', 'created_at', 'is_reviewed']
    list_filter = ['feedback_type', 'rating', 'is_reviewed', 'created_at', 'department']
    search_fields = ['title', 'message', 'department__name']
    readonly_fields = ['created_at']
    list_editable = ['is_reviewed']

@admin.register(FeedbackNotification)
class FeedbackNotificationAdmin(admin.ModelAdmin):
    list_display = ['hod', 'message', 'is_read', 'created_at']
    list_filter = ['is_read', 'created_at']
    search_fields = ['hod__name', 'message']
    readonly_fields = ['created_at']