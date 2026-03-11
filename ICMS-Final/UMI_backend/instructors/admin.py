from django.contrib import admin
from .models import Instructor

@admin.register(Instructor)
class InstructorAdmin(admin.ModelAdmin):
    list_display = ['employee_id', 'name', 'get_email', 'department', 'designation', 'phone']
    list_filter = ['department', 'designation', 'hire_date']
    search_fields = ['employee_id', 'name', 'phone', 'user__email']
    raw_id_fields = ['user']
    
    def get_email(self, obj):
        return obj.user.email if obj.user else 'No email'
    get_email.short_description = 'Email'
    get_email.admin_order_field = 'user__email'
