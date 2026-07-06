from rest_framework import serializers
from core.models import Program, Batch, Course, Semester

class ProgramSerializer(serializers.ModelSerializer):
    class Meta:
        model = Program
        fields = '__all__'

class BatchSerializer(serializers.ModelSerializer):
    program_name = serializers.CharField(source='program.name', read_only=True)
    program = ProgramSerializer(read_only=True)
    is_graduating_eligible = serializers.BooleanField(read_only=True)
    pending_exit_survey_count = serializers.IntegerField(read_only=True)
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
