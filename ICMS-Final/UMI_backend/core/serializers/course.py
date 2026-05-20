from rest_framework import serializers

from core.models.batch import Batch
from core.models.course import Course
from core.models.program import Program
from core.models.semester import Semester


class CourseSerializer(serializers.ModelSerializer):
    semester_id = serializers.UUIDField(source='semester.id', read_only=True)
    semester_number = serializers.IntegerField(source='semester.number', read_only=True)
    program_id = serializers.UUIDField(source='program.id', read_only=True)
    program_name = serializers.CharField(source='program.name', read_only=True)

    class Meta:
        model = Course
        fields = [
            'id',
            'custom_id',
            'name',
            'code',
            'course_type',
            'credit_hours',
            'semester_id',
            'semester_number',
            'program_id',
            'program_name',
            'is_active',
        ]


class CourseCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ['name', 'code', 'course_type', 'credit_hours', 'semester_id', 'program_id']

    semester_id = serializers.UUIDField()
    program_id = serializers.UUIDField()

    def validate_course_type(self, value):
        if value not in ['theory', 'lab']:
            raise serializers.ValidationError('Course type must be either theory or lab')
        return value

    def validate(self, attrs):
        program_id = attrs.get('program_id')
        semester_id = attrs.get('semester_id')

        try:
            program = Program.objects.get(id=program_id, is_active=True)
        except Program.DoesNotExist:
            raise serializers.ValidationError({'program_id': 'Program not found'})

        try:
            semester = Semester.objects.get(id=semester_id, is_active=True)
        except Semester.DoesNotExist:
            raise serializers.ValidationError({'semester_id': 'Semester not found'})

        if semester.program_id != program.id:
            raise serializers.ValidationError('Semester does not belong to this program')

        if Course.objects.filter(program=program, code=attrs.get('code'), is_active=True).exists():
            raise serializers.ValidationError('Course code already exists in this program')

        attrs['program'] = program
        attrs['semester'] = semester
        return attrs

    def create(self, validated_data):
        program = validated_data.pop('program')
        semester = validated_data.pop('semester')
        return Course.objects.create(program=program, semester=semester, **validated_data)

