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
    date = serializers.DateField(source='assessment_date', read_only=True)
    
    class Meta:
        model = Assessment
        fields = ['id', 'title', 'type', 'date', 'total_marks', 'is_finalized', 'questions']

class QuestionSerializer(serializers.Serializer):
    clo = serializers.UUIDField(required=False, allow_null=True)
    description = serializers.CharField(allow_blank=True, required=False, default="")
    level = serializers.CharField(required=False, allow_null=True, allow_blank=True, default="")
    marks = serializers.FloatField()

    def validate(self, data):
        # Auto-fill description from CLO title if description is blank
        if not data.get('description') and data.get('clo'):
            try:
                clo = CLO.objects.get(id=data['clo'])
                data['description'] = clo.title or clo.description or ""
            except CLO.DoesNotExist:
                pass
        return data


class AssessmentCreateSerializer(serializers.Serializer):
    course = serializers.UUIDField()
    batch = serializers.UUIDField()
    semester = serializers.UUIDField(required=False, allow_null=True)
    semester_number = serializers.IntegerField(required=False, allow_null=True)
    title = serializers.CharField()
    type = serializers.CharField()
    total_marks = serializers.FloatField()
    date = serializers.DateField()
    questions = QuestionSerializer(many=True)

    def validate_semester(self, value):
        # If semester is empty string or falsy, treat it as None so semester_number fallback runs in view
        if not value:
            return None
        return value

    def validate_semester_number(self, value):
        if value is None or value == "":
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None


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
# Backend serializer ya view ki misaal
class AssessmentHistorySerializer(serializers.ModelSerializer):
    is_locked = serializers.SerializerMethodField()

    def get_is_locked(self, obj):
        # Agar course_session ka allow_result_editing False hai, to is_locked True hona chahiye
        # (Assuming assessment ka relation course_session se hai)
        if hasattr(obj, 'course_session') and obj.course_session:
            return not obj.course_session.allow_result_editing
        return True # Defaulting to locked if session not found
    
    class Meta:
        model = Assessment
        fields = ['id', 'title', 'type', 'date', 'total_marks', 'is_finalized', 'is_locked']    
