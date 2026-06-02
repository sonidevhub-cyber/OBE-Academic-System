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
        fields = ['name', 'code', 'course_type', 'credit_hours', 'semester_id', 'semester_no', 'program_id', 'parent_course']

    parent_course = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.all(), required=False, allow_null=True
    )

    semester_id = serializers.UUIDField(required=False)
    semester_no = serializers.IntegerField(required=False, write_only=True)
    program_id = serializers.UUIDField()

    def validate_course_type(self, value):
        if value not in ['LECTURE', 'LAB']:
            raise serializers.ValidationError('Course type must be either LECTURE or LAB')
        return value

    def validate(self, attrs):
        program_id = attrs.get('program_id')
        semester_id = attrs.get('semester_id')
        semester_no = attrs.get('semester_no')

        try:
            program = Program.objects.get(id=program_id, is_active=True)
        except Program.DoesNotExist:
            raise serializers.ValidationError({'program_id': 'Program not found'})

        semester = None
        if semester_id:
            try:
                semester = Semester.objects.get(id=semester_id, program=program)
            except Semester.DoesNotExist:
                raise serializers.ValidationError({'semester_id': 'Semester not found for this program'})
        elif semester_no:
            try:
                semester = Semester.objects.get(number=semester_no, program=program)
            except Semester.DoesNotExist:
                raise serializers.ValidationError({'semester_no': f'Semester {semester_no} not found for this program'})
        else:
            raise serializers.ValidationError({'semester_id': 'Either semester_id or semester_no is required'})
        
        attrs['semester'] = semester

        if Course.objects.filter(program=program, code=attrs.get('code'), semester=semester, is_active=True).exists():
            raise serializers.ValidationError('Course code already exists in this program for the selected semester')

        course_type = attrs.get('course_type')
        parent_course = attrs.get('parent_course')

        if course_type == 'LAB':
            if not parent_course:
                raise serializers.ValidationError({'parent_course': 'Parent course is required for lab courses.'})
            if parent_course.course_type != 'LECTURE':
                raise serializers.ValidationError({'parent_course': 'Parent course must be a lecture type course.'})
            if parent_course.semester != semester:
                raise serializers.ValidationError({'parent_course': 'Parent course must be in the same semester as the lab course.'})
            
            # Validate that a parent course can only have one lab course
            if Course.objects.filter(parent_course=parent_course, course_type='LAB', semester=semester, is_active=True).exists():
                raise serializers.ValidationError({'parent_course': 'This parent course already has an associated lab course in the same semester.'})

        attrs['program'] = program
        return attrs

    def create(self, validated_data):
        program = validated_data.pop('program')
        semester = validated_data.pop('semester')
        validated_data.pop('semester_id', None)
        validated_data.pop('semester_no', None)
        validated_data.pop('program_id', None)
        return Course.objects.create(program=program, semester=semester, **validated_data)