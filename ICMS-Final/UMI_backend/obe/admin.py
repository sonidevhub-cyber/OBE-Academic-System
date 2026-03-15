from django.contrib import admin

from .forms import CLOAdminForm, CLOGAMappingAdminForm
from .models import (
    Assessment,
    AssessmentCLOMapping,
    CLO,
    CLOGAMapping,
    GraduateAttribute,
    OBEConfiguration,
    StudentAssessment,
)


@admin.register(CLO)
class CLOAdmin(admin.ModelAdmin):
    form = CLOAdminForm
    fields = ("department", "semester", "course", "clo_number", "description", "bloom_level")
    list_display = ("id", "course", "clo_number", "bloom_level")
    search_fields = ("course__name", "description")
    list_filter = ("course__semester__department", "course__semester")

    class Media:
        js = ("obe/js/clo_admin_v2.js",)


@admin.register(GraduateAttribute)
class GraduateAttributeAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "description")
    search_fields = ("code", "description")


@admin.register(CLOGAMapping)
class CLOGAMappingAdmin(admin.ModelAdmin):
    form = CLOGAMappingAdminForm
    fields = ("department", "semester", "course", "clo", "ga_multiple", "ga", "weightage")
    list_display = ("id", "clo", "ga")
    autocomplete_fields = ("ga",)

    class Media:
        js = ("obe/js/clo_ga_mapping_admin.js",)


@admin.register(Assessment)
class AssessmentAdmin(admin.ModelAdmin):
    list_display = ("assessment_id", "course", "title", "assessment_type", "total_marks", "weightage", "assessment_date")
    list_filter = ("assessment_type", "course")
    search_fields = ("title", "course__name", "course__code")
    autocomplete_fields = ("course", "created_by")


@admin.register(AssessmentCLOMapping)
class AssessmentCLOMappingAdmin(admin.ModelAdmin):
    list_display = ("id", "assessment", "clo", "weightage")
    list_filter = ("assessment__course",)
    search_fields = ("assessment__title", "clo__description", "clo__course__name")
    autocomplete_fields = ("assessment", "clo")


@admin.register(StudentAssessment)
class StudentAssessmentAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "assessment", "obtained_marks", "evaluated_by", "evaluated_at")
    list_filter = ("assessment__course", "assessment__assessment_type")
    search_fields = ("student__name", "assessment__title", "assessment__course__name")
    autocomplete_fields = ("student", "assessment", "evaluated_by")


@admin.register(OBEConfiguration)
class OBEConfigurationAdmin(admin.ModelAdmin):
    list_display = ("id", "clo_pass_threshold", "ga_pass_threshold", "updated_at")
