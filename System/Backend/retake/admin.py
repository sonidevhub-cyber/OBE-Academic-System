from django.contrib import admin

from .models import CourseRetake, ReportInvalidationLog
from .services import recalculate_reports_for_retake_queryset


@admin.register(CourseRetake)
class CourseRetakeAdmin(admin.ModelAdmin):
    list_display = (
        "student",
        "failed_course",
        "attempt_number",
        "status",
        "is_active",
        "retake_teacher",
    )
    list_filter = ("status", "is_active", "attempt_number")
    search_fields = (
        "student__name",
        "student__registration_number",
        "failed_course__name",
        "retake_teacher__full_name",
    )
    actions = ["recalculate_retake_reports"]

    @admin.action(description="Recalculate CLO/GA reports for selected retakes")
    def recalculate_retake_reports(self, request, queryset):
        processed = recalculate_reports_for_retake_queryset(queryset)
        self.message_user(
            request,
            f"Recalculated reports for {len(processed)} retake course session(s).",
        )


@admin.register(ReportInvalidationLog)
class ReportInvalidationLogAdmin(admin.ModelAdmin):
    list_display = (
        "student",
        "triggered_by_retake",
        "affected_student_report",
        "affected_batch_report",
        "triggered_at",
        "resolved_at",
    )
    list_filter = ("affected_student_report", "affected_batch_report", "resolved_at")
    search_fields = (
        "student__name",
        "student__registration_number",
        "triggered_by_retake__failed_course__name",
    )
