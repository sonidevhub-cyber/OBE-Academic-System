from rest_framework import serializers

from ..models import GraduateAttribute


class GraduateAttributeSerializer(serializers.ModelSerializer):
    class Meta:
        model = GraduateAttribute
        fields = "__all__"
