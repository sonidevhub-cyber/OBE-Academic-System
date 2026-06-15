from rest_framework import serializers

class QuestionSerializer(serializers.Serializer):
    clo = serializers.UUIDField()
    description = serializers.CharField()
    level = serializers.CharField()
    marks = serializers.FloatField()


class AssessmentCreateSerializer(serializers.Serializer):
    course = serializers.UUIDField()
    batch = serializers.UUIDField()
    title = serializers.CharField()
    type = serializers.CharField()
    total_marks = serializers.FloatField()
    date = serializers.DateField()
    questions = QuestionSerializer(many=True)


from rest_framework import serializers
from .models import CQI
from obe.models import CLO


class CQISerializer(serializers.ModelSerializer):

    id = serializers.SerializerMethodField()
    clo = serializers.PrimaryKeyRelatedField(queryset=CLO.objects.all())

    clo_display = serializers.SerializerMethodField()
    instructor_name = serializers.SerializerMethodField()

    class Meta:
        model = CQI
        fields = "__all__"

    def get_id(self, obj):
        return str(obj.id)

    def get_clo_display(self, obj):
        return f"CLO-{obj.clo.order_number}"

    def get_instructor_name(self, obj):
        return obj.instructor.full_name if obj.instructor else "N/A"