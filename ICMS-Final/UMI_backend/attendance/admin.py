from django.contrib import admin
from .models import (
    StudentAttendance, FacultyAttendance, AttendanceEditRequest,
    AttendanceSettings, AttendanceAlert, BulkAttendanceSession
)

@admin.register(StudentAttendance)
class StudentAttendanceAdmin(admin.ModelAdmin):
    list_display = ['student', 'course', 'instructor', 'date', 'status', 'is_locked', 'location_verified']
    list_filter = ['status', 'date', 'is_locked', 'course', 'location_verified']
    search_fields = ['student__name', 'course__name', 'instructor__name']
    readonly_fields = ['marked_at', 'updated_at', 'attendance_percentage']
    ordering = ['-date', '-marked_at']
    
    def attendance_percentage(self, obj):
        return f"{obj.attendance_percentage:.1f}%"
    attendance_percentage.short_description = 'Attendance %'

@admin.register(FacultyAttendance)
class FacultyAttendanceAdmin(admin.ModelAdmin):
    list_display = ['get_faculty_name', 'get_faculty_type', 'date', 'status', 'auto_marked', 'self_marked', 'is_locked']
    list_filter = ['status', 'date', 'auto_marked', 'self_marked', 'is_locked']
    search_fields = ['instructor__name', 'coordinator__name', 'hod__name']
    readonly_fields = ['marked_at', 'updated_at']
    ordering = ['-date', '-marked_at']

@admin.register(AttendanceEditRequest)
class AttendanceEditRequestAdmin(admin.ModelAdmin):
    list_display = ['request_type', 'requested_by', 'status', 'requested_at', 'reviewed_by']
    list_filter = ['request_type', 'status', 'requested_at']
    search_fields = ['requested_by__username', 'reason']
    readonly_fields = ['requested_at', 'reviewed_at']
    ordering = ['-requested_at']

@admin.register(AttendanceSettings)
class AttendanceSettingsAdmin(admin.ModelAdmin):
    list_display = ['minimum_attendance_percentage', 'late_arrival_threshold_minutes', 'auto_lock_attendance_hours']
    fieldsets = (
        ('Attendance Rules', {
            'fields': ('minimum_attendance_percentage', 'late_arrival_threshold_minutes')
        }),
        ('System Settings', {
            'fields': ('auto_lock_attendance_hours', 'allow_future_attendance', 'require_location_verification')
        }),
    )

@admin.register(AttendanceAlert)
class AttendanceAlertAdmin(admin.ModelAdmin):
    list_display = ['student', 'course', 'alert_type', 'attendance_percentage', 'is_resolved', 'created_at']
    list_filter = ['alert_type', 'is_resolved', 'created_at']
    search_fields = ['student__name', 'course__name']
    readonly_fields = ['created_at', 'resolved_at']
    ordering = ['-created_at']
    
    actions = ['mark_resolved']
    
    def mark_resolved(self, request, queryset):
        from django.utils import timezone
        queryset.update(is_resolved=True, resolved_at=timezone.now())
    mark_resolved.short_description = "Mark selected alerts as resolved"

@admin.register(BulkAttendanceSession)
class BulkAttendanceSessionAdmin(admin.ModelAdmin):
    list_display = ['instructor', 'timetable', 'date', 'total_students', 'marked_students', 'is_completed']
    list_filter = ['date', 'is_completed']
    search_fields = ['instructor__name', 'timetable__course__name']
    readonly_fields = ['session_start', 'session_end']
    ordering = ['-session_start']