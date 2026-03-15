from rest_framework import serializers

from ..models import CLO, CLOGAMapping


class CLOSerializer(serializers.ModelSerializer):
    class Meta:
        model = CLO
        fields = "__all__"


class CLOGAMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = CLOGAMapping
        fields = "__all__"
