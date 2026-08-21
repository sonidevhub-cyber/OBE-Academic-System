
from django.contrib import admin
from .models import SemesterCLOMasterCache, CourseCLOMasterEntry


@admin.register(SemesterCLOMasterCache)
class SemesterCLOMasterCacheAdmin(admin.ModelAdmin):
    list_display = (
        "program",
        "semester",
        "is_fully_compiled",
        "total_courses_expected",
        "total_courses_finalized",
        "last_updated",
        "is_active"
    )
    list_filter = ("program", "semester", "is_fully_compiled", "is_active")
    search_fields = ("program__name", "semester__name")


@admin.register(CourseCLOMasterEntry)
class CourseCLOMasterEntryAdmin(admin.ModelAdmin):
    list_display = (
        "master_cache",
        "course",
        "clo",
        "student",
        "clo_score",
        "is_kpi_achieved",
        "finalized_at",
        "is_active"
    )
    list_filter = (
        "master_cache",
        "course",
        "clo",
        "is_kpi_achieved",
        "is_active"
    )
    search_fields = ("course__name", "clo__title", "student__full_name")
