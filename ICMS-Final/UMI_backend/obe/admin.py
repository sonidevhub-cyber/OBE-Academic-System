from django.contrib import admin

from .models import CLO, CLOGAMapping, GraduateAttribute


@admin.register(CLO)
class CLOAdmin(admin.ModelAdmin):
    list_display = ("id", "course", "clo_number", "bloom_level")
    search_fields = ("course__name", "description")


@admin.register(GraduateAttribute)
class GraduateAttributeAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "description")
    search_fields = ("code", "description")


@admin.register(CLOGAMapping)
class CLOGAMappingAdmin(admin.ModelAdmin):
    list_display = ("id", "clo", "ga")
    autocomplete_fields = ("clo", "ga")
