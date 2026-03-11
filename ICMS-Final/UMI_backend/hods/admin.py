from django.contrib import admin
from .models import HOD, HODRegistrationRequest

@admin.register(HOD)
class HODAdmin(admin.ModelAdmin):
    list_display = ['name', 'email', 'employee_id', 'department', 'designation', 'is_active', 'created_at']
    list_filter = ['department', 'designation', 'is_active', 'created_at']
    search_fields = ['name', 'email', 'employee_id']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('user', 'name', 'email', 'employee_id', 'phone')
        }),
        ('Professional Details', {
            'fields': ('department', 'designation', 'specialization', 'experience_years', 'hire_date')
        }),
        ('Personal Information', {
            'fields': ('date_of_birth', 'gender', 'image')
        }),
        ('Status', {
            'fields': ('is_active', 'created_at', 'updated_at')
        }),
    )

@admin.register(HODRegistrationRequest)
class HODRegistrationRequestAdmin(admin.ModelAdmin):
    list_display = ['name', 'email', 'employee_id', 'department', 'status', 'hod_request_status', 'requested_at']
    list_filter = ['status', 'hod_request_status', 'department', 'requested_at']
    search_fields = ['name', 'email', 'employee_id']
    readonly_fields = ['requested_at', 'reviewed_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'email', 'employee_id', 'phone')
        }),
        ('Professional Details', {
            'fields': ('department', 'designation', 'specialization', 'experience_years')
        }),
        ('Request Status', {
            'fields': ('status', 'hod_request_status', 'requested_at', 'reviewed_at', 'reviewed_by', 'rejection_reason')
        }),
    )
    
    def get_readonly_fields(self, request, obj=None):
        readonly_fields = list(self.readonly_fields)
        if obj and obj.status != 'pending':
            readonly_fields.extend(['name', 'email', 'employee_id', 'phone', 'department', 'designation', 'specialization', 'experience_years'])
        return readonly_fields