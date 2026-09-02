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
    elective_group_id = serializers.UUIDField(source='elective_group.id', read_only=True, allow_null=True)
    elective_group_name = serializers.CharField(source='elective_group.group_name', read_only=True, allow_null=True)
    selective_group_id = serializers.UUIDField(source='selective_group.id', read_only=True, allow_null=True)
    selective_group_name = serializers.CharField(source='selective_group.group_name', read_only=True, allow_null=True)

    class Meta:
        model = Course
        fields = [
            'id',
            'name',
            'code',
            'course_type',
            'offering_type',
            'elective_group_id',
            'elective_group_name',
            'selective_group_id',
            'selective_group_name',
            'credit_hours',
            'semester_id',
            'semester_number',
            'program_id',
            'program_name',
            'is_active',
        ]


class CourseCreateSerializer(serializers.ModelSerializer):
    elective_group_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    selective_group_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    curriculum_version_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = Course
        fields = [
            'name', 'code', 'course_type', 'credit_hours',
            'semester_id', 'semester_no', 'program_id', 'parent_course',
            'offering_type', 'elective_group_id', 'selective_group_id',
            'curriculum_version_id',
        ]

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

    def validate_offering_type(self, value):
        valid = [Course.OFFERING_COMPULSORY, Course.OFFERING_ELECTIVE, Course.OFFERING_SELECTIVE]
        if value not in valid:
            raise serializers.ValidationError(f'offering_type must be one of {valid}')
        return value

    def validate(self, attrs):
        program_id = attrs.get('program_id')
        semester_id = attrs.get('semester_id')
        semester_no = attrs.get('semester_no')
        offering_type = attrs.get('offering_type', Course.OFFERING_COMPULSORY)
        elective_group_id = attrs.get('elective_group_id')
        selective_group_id = attrs.get('selective_group_id')

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
            
            if Course.objects.filter(parent_course=parent_course, course_type='LAB', semester=semester, is_active=True).exists():
                raise serializers.ValidationError({'parent_course': 'This parent course already has an associated lab course in the same semester.'})

        if offering_type == Course.OFFERING_ELECTIVE and selective_group_id:
            raise serializers.ValidationError({
                'selective_group_id': 'selective_group can only be set when offering_type is SELECTIVE'
            })

        if offering_type == Course.OFFERING_SELECTIVE and elective_group_id:
            raise serializers.ValidationError({
                'elective_group_id': 'elective_group can only be set when offering_type is ELECTIVE'
            })

        if elective_group_id:
            try:
                from electives.models import ElectiveGroup
                group = ElectiveGroup.objects.get(
                    id=elective_group_id,
                    is_active=True,
                    batch__program=program,
                    semester=semester,
                )
                attrs['elective_group'] = group
            except ElectiveGroup.DoesNotExist:
                raise serializers.ValidationError({
                    'elective_group_id': 'ElectiveGroup not found for this program/semester'
                })

        if selective_group_id:
            try:
                from electives.models import SelectiveGroup
                sg = SelectiveGroup.objects.get(
                    id=selective_group_id,
                    is_active=True,
                )
                attrs['selective_group'] = sg
            except SelectiveGroup.DoesNotExist:
                raise serializers.ValidationError({
                    'selective_group_id': 'SelectiveGroup not found'
                })

        if offering_type == Course.OFFERING_SELECTIVE and not selective_group_id:
            from electives.models import SelectiveGroup
            from curriculum.models import CurriculumVersion
            curriculum_version_id = attrs.get('curriculum_version_id')
            if curriculum_version_id:
                try:
                    cv = CurriculumVersion.objects.get(id=curriculum_version_id)
                except CurriculumVersion.DoesNotExist:
                    raise serializers.ValidationError({
                        'curriculum_version_id': 'CurriculumVersion not found'
                    })
            else:
                cv = CurriculumVersion.objects.filter(program=program).first()
            if not cv:
                raise serializers.ValidationError({
                    'curriculum_version_id': 'CurriculumVersion could not be determined. Please provide curriculum_version_id.'
                })
            group_name = f"Selective Group for {attrs.get('code', attrs.get('name', ''))}"
            sg = SelectiveGroup.objects.create(
                group_name=group_name,
                curriculum_version=cv,
                semester=semester,
                semester_no=semester.number,
            )
            attrs['selective_group'] = sg

        attrs['program'] = program
        return attrs

    def create(self, validated_data):
        program = validated_data.pop('program')
        semester = validated_data.pop('semester')
        validated_data.pop('semester_id', None)
        validated_data.pop('semester_no', None)
        validated_data.pop('program_id', None)
        validated_data.pop('elective_group_id', None)
        validated_data.pop('selective_group_id', None)
        validated_data.pop('curriculum_version_id', None)
        return Course.objects.create(program=program, semester=semester, **validated_data)


class CourseUpdateSerializer(serializers.ModelSerializer):
    elective_group_id = serializers.UUIDField(required=False, allow_null=True)
    selective_group_id = serializers.UUIDField(required=False, allow_null=True)
    parent_course = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.filter(is_active=True), required=False, allow_null=True
    )

    class Meta:
        model = Course
        fields = [
            'name', 'code', 'credit_hours', 'course_type',
            'offering_type', 'parent_course',
            'elective_group_id', 'selective_group_id',
        ]

    def validate_offering_type(self, value):
        valid = [Course.OFFERING_COMPULSORY, Course.OFFERING_ELECTIVE, Course.OFFERING_SELECTIVE]
        if value not in valid:
            raise serializers.ValidationError(f'offering_type must be one of {valid}')
        return value

    def validate_course_type(self, value):
        if value not in ['LECTURE', 'LAB']:
            raise serializers.ValidationError('Course type must be either LECTURE or LAB')
        return value

    def validate(self, attrs):
        offering_type = attrs.get('offering_type', self.instance.offering_type if self.instance else Course.OFFERING_COMPULSORY)
        elective_group_id = attrs.get('elective_group_id')
        selective_group_id = attrs.get('selective_group_id')

        if offering_type == Course.OFFERING_ELECTIVE and selective_group_id:
            raise serializers.ValidationError({
                'selective_group_id': 'selective_group can only be set when offering_type is SELECTIVE'
            })

        if offering_type == Course.OFFERING_SELECTIVE and elective_group_id:
            raise serializers.ValidationError({
                'elective_group_id': 'elective_group can only be set when offering_type is ELECTIVE'
            })

        if offering_type != Course.OFFERING_ELECTIVE and elective_group_id is not None:
            raise serializers.ValidationError({
                'elective_group': 'elective_group can only be set when offering_type is ELECTIVE'
            })

        if offering_type != Course.OFFERING_SELECTIVE and selective_group_id is not None:
            raise serializers.ValidationError({
                'selective_group': 'selective_group can only be set when offering_type is SELECTIVE'
            })

        if elective_group_id:
            try:
                from electives.models import ElectiveGroup
                group = ElectiveGroup.objects.get(
                    id=elective_group_id,
                    is_active=True,
                    batch__program=self.instance.program if self.instance else None,
                    semester=self.instance.semester if self.instance else None,
                )
                attrs['elective_group'] = group
            except ElectiveGroup.DoesNotExist:
                raise serializers.ValidationError({
                    'elective_group_id': 'ElectiveGroup not found for this program/semester'
                })

        if selective_group_id:
            try:
                from electives.models import SelectiveGroup
                sg = SelectiveGroup.objects.get(
                    id=selective_group_id,
                    is_active=True,
                )
                attrs['selective_group'] = sg
            except SelectiveGroup.DoesNotExist:
                raise serializers.ValidationError({
                    'selective_group_id': 'SelectiveGroup not found'
                })

        return attrs

    def update(self, instance, validated_data):
        if 'elective_group_id' in validated_data:
            validated_data.pop('elective_group_id', None)
        if 'selective_group_id' in validated_data:
            validated_data.pop('selective_group_id', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.full_clean()
        instance.save()
        return instance