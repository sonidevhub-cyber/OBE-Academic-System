from rest_framework import serializers
from core.models import Program, Batch, Course, Semester
from obe.views.peo_views import (
    _get_alumni_feedback_response_count,
    _get_alumni_feedback_response_rate,
    _get_alumni_feedback_eligible_count
)

class ProgramSerializer(serializers.ModelSerializer):
    class Meta:
        model = Program
        fields = '__all__'

class BatchSerializer(serializers.ModelSerializer):
    program_name = serializers.CharField(source='program.name', read_only=True)
    program = ProgramSerializer(read_only=True)
    is_graduating_eligible = serializers.BooleanField(read_only=True)
    pending_exit_survey_count = serializers.IntegerField(read_only=True)
    is_alumni_feedback_eligible = serializers.BooleanField(read_only=True)
    alumni_feedback_cycle_status = serializers.SerializerMethodField()
    alumni_feedback_response_count = serializers.SerializerMethodField()
    alumni_feedback_response_rate = serializers.SerializerMethodField()
    alumni_feedback_total_alumni = serializers.SerializerMethodField()

    def get_alumni_feedback_cycle_status(self, obj):
        cycle = obj.alumni_survey_cycles.order_by('-created_at').first()
        return cycle.status if cycle else None

    def get_alumni_feedback_response_count(self, obj):
        cycle = obj.alumni_survey_cycles.order_by('-created_at').first()
        return _get_alumni_feedback_response_count(cycle) if cycle else 0

    def get_alumni_feedback_response_rate(self, obj):
        cycle = obj.alumni_survey_cycles.order_by('-created_at').first()
        return float(_get_alumni_feedback_response_rate(cycle)) if cycle else 0

    def get_alumni_feedback_total_alumni(self, obj):
        return _get_alumni_feedback_eligible_count(obj)

    class Meta:
        model = Batch
        fields = '__all__'

class CourseSerializer(serializers.ModelSerializer):
    program_name = serializers.CharField(source='program.name', read_only=True)
    semester_name = serializers.CharField(source='semester.name', read_only=True)
    
    class Meta:
        model = Course
        fields = '__all__'

class SemesterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Semester
        fields = '__all__'
