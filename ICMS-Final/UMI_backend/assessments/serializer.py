from rest_framework import serializers
from .models import Assessment, Question
from obe.models import CLO

class CLOSerializer(serializers.ModelSerializer):
    class Meta:
        model = CLO
        fields = ['id', 'order_number', 'title', 'description', 'bloom_level', 'kpi_target']

class QuestionDetailSerializer(serializers.ModelSerializer):
    clo = CLOSerializer(read_only=True)
    
    class Meta:
        model = Question
        fields = ['id', 'clo', 'description', 'bloom_level', 'marks']

class AssessmentDetailSerializer(serializers.ModelSerializer):
    questions = QuestionDetailSerializer(many=True, read_only=True)
    type = serializers.CharField(source='assessment_type', read_only=True)
    
    class Meta:
        model = Assessment
        fields = ['id', 'title', 'type', 'total_marks', 'questions']

class QuestionSerializer(serializers.Serializer):
    clo = serializers.UUIDField()
    description = serializers.CharField()
    level = serializers.CharField()
    marks = serializers.FloatField()


class AssessmentCreateSerializer(serializers.Serializer):
    course = serializers.UUIDField()
    batch = serializers.UUIDField()
    semester = serializers.UUIDField(required=False)
    semester_number = serializers.IntegerField(required=False)
    title = serializers.CharField()
    type = serializers.CharField()
    total_marks = serializers.FloatField()
    date = serializers.DateField()
    questions = QuestionSerializer(many=True)


from rest_framework import serializers
from .models import CQI


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
