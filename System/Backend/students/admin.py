from django.contrib import admin

from .models import Student


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = (
        "registration_number",
        "name",
        "batch",
        "is_frozen",
        "frozen_at_semester",
    )
    list_filter = ("batch", "is_frozen")
    search_fields = ("registration_number", "name", "user__email")
