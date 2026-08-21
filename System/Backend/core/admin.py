
from django.contrib import admin
from .models import CustomUser, Department, Program, Semester, Course, Batch


@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ['email', 'full_name', 'role', 'is_active', 'is_staff']
    list_filter = ['role', 'is_active', 'is_staff']
    search_fields = ['email', 'full_name']


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'code']


@admin.register(Program)
class ProgramAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'department', 'total_semesters', 'is_active']
    list_filter = ['is_active', 'department']
    search_fields = ['name', 'code']


@admin.register(Semester)
class SemesterAdmin(admin.ModelAdmin):
    list_display = ['name', 'number', 'program', 'is_active']
    list_filter = ['is_active', 'program']
    search_fields = ['name', 'program__name']


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'program', 'semester', 'credit_hours', 'is_active']
    list_filter = ['is_active', 'program', 'semester', 'course_type']
    search_fields = ['code', 'name']


@admin.register(Batch)
class BatchAdmin(admin.ModelAdmin):
    list_display = ['name', 'program', 'session_type', 'current_semester', 'is_active']
    list_filter = ['is_active', 'program', 'session_type']
    search_fields = ['name', 'program__name']
