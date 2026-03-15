from django.contrib import admin
from .models import Department, Semester, Course, Timetable, Attendance, Result, Scholarship

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'num_semesters']
    search_fields = ['name', 'code']

@admin.register(Semester)
class SemesterAdmin(admin.ModelAdmin):
    list_display = ['name', 'semester_code', 'department', 'capacity']
    list_filter = ['department']
    search_fields = ['name', 'semester_code']

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'course_type', 'parent_course', 'credits', 'semester']
    list_filter = ['course_type', 'semester__department', 'credits']
    search_fields = ['name', 'code']

@admin.register(Timetable)
class TimetableAdmin(admin.ModelAdmin):
    list_display = ['course', 'instructor', 'day', 'start_time', 'end_time', 'room']
    list_filter = ['day', 'course__semester__department']
    search_fields = ['course__name', 'instructor__name', 'room']
    ordering = ['day', 'start_time']

@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ['student', 'course', 'date', 'status', 'marked_by']
    list_filter = ['status', 'date', 'course']
    search_fields = ['student__name', 'course__name']

@admin.register(Result)
class ResultAdmin(admin.ModelAdmin):
    list_display = ['student', 'course', 'exam_type', 'obtained_marks', 'total_marks', 'grade']
    list_filter = ['exam_type', 'grade', 'course']
    search_fields = ['student__name', 'course__name']

@admin.register(Scholarship)
class ScholarshipAdmin(admin.ModelAdmin):
    list_display = ['name', 'amount']
    search_fields = ['name']
