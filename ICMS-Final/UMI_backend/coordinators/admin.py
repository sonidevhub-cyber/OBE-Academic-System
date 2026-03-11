from django.contrib import admin
from .models import Coordinator, TimetableProposal, TimetableSlot, CourseAllocation, CoordinatorDashboard

@admin.register(Coordinator)
class CoordinatorAdmin(admin.ModelAdmin):
    list_display = ['name', 'department', 'designation', 'can_act_as_instructor', 'assigned_by', 'is_active']
    list_filter = ['department', 'can_act_as_instructor', 'is_active', 'created_at']
    search_fields = ['name', 'email', 'employee_id']
    readonly_fields = ['created_at', 'updated_at']

@admin.register(TimetableProposal)
class TimetableProposalAdmin(admin.ModelAdmin):
    list_display = ['title', 'coordinator', 'semester', 'status', 'created_at', 'reviewed_by']
    list_filter = ['status', 'created_at', 'reviewed_at']
    search_fields = ['title', 'coordinator__name', 'semester__name']
    readonly_fields = ['created_at', 'submitted_at', 'reviewed_at']

@admin.register(TimetableSlot)
class TimetableSlotAdmin(admin.ModelAdmin):
    list_display = ['course', 'instructor', 'day', 'start_time', 'end_time', 'room']
    list_filter = ['day', 'proposal__status']
    search_fields = ['course__name', 'instructor__name', 'room']

@admin.register(CourseAllocation)
class CourseAllocationAdmin(admin.ModelAdmin):
    list_display = ['course', 'instructor', 'coordinator', 'semester', 'status', 'proposed_at']
    list_filter = ['status', 'proposed_at', 'approved_at']
    search_fields = ['course__name', 'instructor__name', 'coordinator__name']
    readonly_fields = ['proposed_at', 'approved_at']

@admin.register(CoordinatorDashboard)
class CoordinatorDashboardAdmin(admin.ModelAdmin):
    list_display = ['coordinator', 'total_courses_managed', 'total_instructors_coordinated', 'pending_approvals', 'last_updated']
    readonly_fields = ['last_updated']