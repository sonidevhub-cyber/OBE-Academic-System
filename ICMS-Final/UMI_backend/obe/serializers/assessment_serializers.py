from rest_framework import serializers

from ..models import Assessment, AssessmentCLOMapping, StudentAssessment


class AssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assessment
        fields = "__all__"


class AssessmentCLOMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssessmentCLOMapping
        fields = "__all__"


class StudentAssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentAssessment
        fields = "__all__"
