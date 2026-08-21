
from rest_framework import serializers
from .models import SemesterCLOMasterCache, CourseCLOMasterEntry


class CourseCLOMasterEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseCLOMasterEntry
        fields = "__all__"


class SemesterCLOMasterCacheSerializer(serializers.ModelSerializer):
    class Meta:
        model = SemesterCLOMasterCache
        fields = "__all__"
