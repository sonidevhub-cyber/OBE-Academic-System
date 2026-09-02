import uuid
from rest_framework import serializers
from django.core.exceptions import ValidationError

from .models import (
    SelectiveGroup,
    EligibilityRule,
    ElectiveGroup,
    ElectiveSelectionWindow,
    StudentElectiveEnrollment,
)
from core.models.course import Course


class SelectiveGroupSerializer(serializers.ModelSerializer):
    curriculum_version_id = serializers.UUIDField(source='curriculum_version.id', read_only=True)
    curriculum_version_version_no = serializers.CharField(source='curriculum_version.version_no', read_only=True)
    semester_id = serializers.UUIDField(source='semester.id', read_only=True)
    semester_number = serializers.IntegerField(source='semester.number', read_only=True)
    course_count = serializers.IntegerField(read_only=True)
    has_eligibility_rules = serializers.SerializerMethodField()

    class Meta:
        model = SelectiveGroup
        fields = [
            'id', 'group_name', 'curriculum_version_id', 'curriculum_version_version_no',
            'semester_id', 'semester_number', 'is_active', 'created_at',
            'course_count', 'has_eligibility_rules',
        ]

    def get_has_eligibility_rules(self, obj):
        return obj.eligibility_rules.filter(is_active=True).exists()


class SelectiveGroupCreateSerializer(serializers.ModelSerializer):
    curriculum_version_id = serializers.UUIDField(write_only=True)
    semester_id = serializers.UUIDField(write_only=True, required=False)
    semester_no = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = SelectiveGroup
        fields = ['group_name', 'curriculum_version_id', 'semester_id', 'semester_no']

    def validate(self, attrs):
        from core.models import Semester
        from curriculum.models import CurriculumVersion

        curriculum_version_id = attrs.get('curriculum_version_id')
        semester_id = attrs.get('semester_id')
        semester_no = attrs.get('semester_no')

        try:
            curriculum_version = CurriculumVersion.objects.get(id=curriculum_version_id, is_active=True)
        except CurriculumVersion.DoesNotExist:
            raise serializers.ValidationError({'curriculum_version_id': 'CurriculumVersion not found or inactive'})

        program = curriculum_version.program

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
            raise serializers.ValidationError('Either semester_id or semester_no is required')

        attrs['curriculum_version'] = curriculum_version
        attrs['semester'] = semester
        attrs['semester_no'] = semester.number
        return attrs

    def create(self, validated_data):
        validated_data.pop('curriculum_version_id', None)
        validated_data.pop('semester_id', None)
        return SelectiveGroup.objects.create(**validated_data)


class EligibilityRuleSerializer(serializers.ModelSerializer):
    selective_group_id = serializers.UUIDField(source='selective_group.id')
    course_id = serializers.UUIDField(source='course.id', write_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)

    class Meta:
        model = EligibilityRule
        fields = [
            'id', 'selective_group_id', 'course_id', 'course_code', 'course_name',
            'student_attribute_field', 'student_attribute_value', 'is_active', 'created_at',
        ]

    def validate(self, attrs):
        selective_group = attrs.get('selective_group')
        course = attrs.get('course')

        if course.offering_type != Course.OFFERING_SELECTIVE:
            raise serializers.ValidationError({'course_id': 'Course must be SELECTIVE offering type'})

        if course.selective_group_id != selective_group.id:
            raise serializers.ValidationError({'course_id': 'Course must belong to the same selective_group'})

        dup_rules = EligibilityRule.objects.filter(
            selective_group=selective_group,
            course=course,
            student_attribute_field=attrs.get('student_attribute_field'),
            is_active=True,
        )
        if self.instance:
            dup_rules = dup_rules.exclude(pk=self.instance.pk)
        if dup_rules.exists():
            raise serializers.ValidationError({
                'student_attribute_field': (
                    f'Duplicate attribute_field "{attrs.get("student_attribute_field")}" '
                    f'for course {course.code} in this selective group.'
                )
            })

        return attrs

    def create(self, validated_data):
        selective_group_id = validated_data['selective_group'].get('id') if isinstance(validated_data.get('selective_group'), dict) else None
        course_id = validated_data['course'].get('id') if isinstance(validated_data.get('course'), dict) else None

        if selective_group_id:
            from .models import SelectiveGroup
            validated_data['selective_group'] = SelectiveGroup.objects.get(id=selective_group_id)
        if course_id:
            validated_data['course'] = Course.objects.get(id=course_id)

        return EligibilityRule.objects.create(**validated_data)


class ElectiveGroupSerializer(serializers.ModelSerializer):
    batch_id = serializers.UUIDField(source='batch.id', read_only=True)
    batch_name = serializers.CharField(source='batch.name', read_only=True)
    batch_custom_id = serializers.CharField(source='batch.custom_id', read_only=True)
    semester_id = serializers.UUIDField(source='semester.id', read_only=True)
    semester_number = serializers.IntegerField(source='semester.number', read_only=True)
    course_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = ElectiveGroup
        fields = [
            'id', 'group_name', 'batch_id', 'batch_name', 'batch_custom_id',
            'semester_id', 'semester_number', 'is_active', 'created_at',
            'course_count',
        ]


class ElectiveGroupCreateSerializer(serializers.ModelSerializer):
    batch_id = serializers.UUIDField(write_only=True)
    semester_id = serializers.UUIDField(write_only=True, required=False)
    semester_no = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = ElectiveGroup
        fields = ['group_name', 'batch_id', 'semester_id', 'semester_no']

    def validate(self, attrs):
        from core.models import Batch, Semester

        batch_id = attrs.get('batch_id')
        semester_id = attrs.get('semester_id')
        semester_no = attrs.get('semester_no')

        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            raise serializers.ValidationError({'batch_id': 'Batch not found'})

        semester = None
        if semester_id:
            try:
                semester = Semester.objects.get(id=semester_id, program=batch.program)
            except Semester.DoesNotExist:
                raise serializers.ValidationError({'semester_id': 'Semester not found for this batch program'})
        elif semester_no:
            try:
                semester = Semester.objects.get(number=semester_no, program=batch.program)
            except Semester.DoesNotExist:
                raise serializers.ValidationError({'semester_no': f'Semester {semester_no} not found'})
        else:
            raise serializers.ValidationError('Either semester_id or semester_no is required')

        attrs['batch'] = batch
        attrs['semester'] = semester
        return attrs

    def create(self, validated_data):
        validated_data.pop('batch_id', None)
        validated_data.pop('semester_id', None)
        validated_data.pop('semester_no', None)
        return ElectiveGroup.objects.create(**validated_data)


class ElectiveSelectionWindowSerializer(serializers.ModelSerializer):
    batch_id = serializers.UUIDField(source='batch.id', read_only=True)
    batch_name = serializers.CharField(source='batch.name', read_only=True)
    batch_custom_id = serializers.CharField(source='batch.custom_id', read_only=True)
    semester_id = serializers.UUIDField(source='semester.id', read_only=True)
    semester_number = serializers.IntegerField(source='semester.number', read_only=True)
    opened_by_name = serializers.CharField(source='opened_by.get_full_name', read_only=True, allow_null=True)
    closed_by_name = serializers.CharField(source='closed_by.get_full_name', read_only=True, allow_null=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = ElectiveSelectionWindow
        fields = [
            'id', 'batch_id', 'batch_name', 'batch_custom_id',
            'semester_id', 'semester_number', 'is_open', 'status',
            'opened_by', 'opened_by_name', 'opened_at',
            'closed_by', 'closed_by_name', 'closed_at',
            'max_electives_allowed', 'is_active', 'created_at',
        ]

    def get_status(self, obj):
        if obj.is_open:
            return 'OPEN'
        if obj.opened_at is None and obj.closed_at is None:
            return 'NOT_OPENED'
        return 'LOCKED'


class StudentElectiveEnrollmentSerializer(serializers.ModelSerializer):
    student_id = serializers.UUIDField(source='student.student_id', read_only=True)
    student_custom_id = serializers.CharField(source='student.custom_id', read_only=True)
    student_name = serializers.CharField(source='student.name', read_only=True)
    student_registration_number = serializers.CharField(source='student.registration_number', read_only=True)
    course_id = serializers.UUIDField(source='course.id', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    course_offering_type = serializers.CharField(source='course.offering_type', read_only=True)
    semester_id = serializers.UUIDField(source='semester.id', read_only=True)
    semester_number = serializers.IntegerField(source='semester.number', read_only=True)
    batch_id = serializers.UUIDField(source='batch.id', read_only=True)
    batch_custom_id = serializers.CharField(source='batch.custom_id', read_only=True)
    elective_group_id = serializers.UUIDField(source='course.elective_group.id', read_only=True, allow_null=True)
    elective_group_name = serializers.CharField(source='course.elective_group.group_name', read_only=True, allow_null=True)
    selective_group_id = serializers.UUIDField(source='course.selective_group.id', read_only=True, allow_null=True)
    selective_group_name = serializers.CharField(source='course.selective_group.group_name', read_only=True, allow_null=True)
    enrolled_by_id = serializers.UUIDField(source='enrolled_by.id', read_only=True, allow_null=True)
    enrolled_by_name = serializers.CharField(source='enrolled_by.get_full_name', read_only=True, allow_null=True)
    locked_by_name = serializers.CharField(source='locked_by.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = StudentElectiveEnrollment
        fields = [
            'id', 'student_id', 'student_custom_id', 'student_name', 'student_registration_number',
            'course_id', 'course_name', 'course_code', 'course_offering_type',
            'semester_id', 'semester_number', 'batch_id', 'batch_custom_id',
            'elective_group_id', 'elective_group_name',
            'selective_group_id', 'selective_group_name',
            'enrolled_by_id', 'enrolled_by_name',
            'enrolled_at', 'is_locked', 'locked_by', 'locked_by_name', 'locked_at',
            'is_active', 'created_at',
        ]


class ElectiveCourseOptionSerializer(serializers.ModelSerializer):
    elective_group_id = serializers.UUIDField(source='elective_group.id', read_only=True, allow_null=True)
    elective_group_name = serializers.CharField(source='elective_group.group_name', read_only=True, allow_null=True)
    selective_group_id = serializers.UUIDField(source='selective_group.id', read_only=True, allow_null=True)
    selective_group_name = serializers.CharField(source='selective_group.group_name', read_only=True, allow_null=True)
    program_id = serializers.UUIDField(source='program.id', read_only=True)
    semester_id = serializers.UUIDField(source='semester.id', read_only=True)
    semester_number = serializers.IntegerField(source='semester.number', read_only=True)
    offering_type = serializers.ChoiceField(choices=Course.OFFERING_TYPE_CHOICES, read_only=True)

    class Meta:
        model = Course
        fields = [
            'id', 'name', 'code', 'course_type', 'offering_type',
            'elective_group_id', 'elective_group_name',
            'selective_group_id', 'selective_group_name',
            'credit_hours', 'program_id', 'semester_id', 'semester_number',
        ]


class SACAssignSerializer(serializers.Serializer):
    student_id = serializers.UUIDField()
    course_id = serializers.UUIDField()
    batch_id = serializers.UUIDField()
    semester_id = serializers.UUIDField(required=False)
    semester_no = serializers.IntegerField(required=False)

    def validate(self, attrs):
        from core.models import Batch, Semester
        from students.models import Student

        student_id = attrs.get('student_id')
        course_id = attrs.get('course_id')
        batch_id = attrs.get('batch_id')
        semester_id = attrs.get('semester_id')
        semester_no = attrs.get('semester_no')

        try:
            student = Student.objects.get(student_id=student_id)
        except Student.DoesNotExist:
            raise serializers.ValidationError({'student_id': 'Student not found'})

        try:
            course = Course.objects.get(id=course_id, is_active=True)
        except Course.DoesNotExist:
            raise serializers.ValidationError({'course_id': 'Course not found'})

        if course.offering_type not in (Course.OFFERING_ELECTIVE, Course.OFFERING_SELECTIVE):
            raise serializers.ValidationError({'course_id': 'Course must be ELECTIVE or SELECTIVE offering type'})

        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            raise serializers.ValidationError({'batch_id': 'Batch not found'})

        program = batch.program

        semester = None
        if semester_id:
            try:
                semester = Semester.objects.get(id=semester_id, program=program)
            except Semester.DoesNotExist:
                raise serializers.ValidationError({'semester_id': 'Semester not found for this batch program'})
        elif semester_no:
            try:
                semester = Semester.objects.get(number=semester_no, program=program)
            except Semester.DoesNotExist:
                raise serializers.ValidationError({'semester_no': f'Semester {semester_no} not found'})
        else:
            raise serializers.ValidationError('Either semester_id or semester_no is required')

        if course.program_id != program.id or course.semester_id != semester.id:
            raise serializers.ValidationError({'course_id': 'Course does not match this batch program and semester'})

        attrs['student'] = student
        attrs['course'] = course
        attrs['batch'] = batch
        attrs['semester'] = semester
        return attrs

    def create(self, validated_data):
        raise NotImplementedError('Create handled in view to apply enrolled_by context')
