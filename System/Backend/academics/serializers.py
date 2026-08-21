from rest_framework import serializers
from .models import Semester, Course
import re
from core.models.program import Program
from core.models.batch import Batch # Import Batch model


# ===========================
# Semester Serializer
# ===========================
class SemesterSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='semester_id', read_only=True)
    semester_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Semester
        fields = ['id', 'semester_id', 'name', 'semester_code', 'program', 'capacity']


# ===========================
# Course Serializer
# ===========================
class CourseSerializer(serializers.ModelSerializer):
    program_id = serializers.UUIDField(write_only=True, required=False)
    semester_number = serializers.IntegerField(write_only=True, required=False, min_value=1, max_value=8)
    semester = serializers.PrimaryKeyRelatedField(
        queryset=Semester.objects.all(), write_only=True, required=False
    )
    parent_course = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.all(), required=False, allow_null=True
    )
    semester_details = SemesterSerializer(source='semester', read_only=True)
    parent_course_details = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            'course_id', 'name', 'code', 'description', 'credits', 'course_type',
            'parent_course', 'parent_course_details',
            'program_id', 'semester_number', 'semester', 'semester_details'
        ]

    def get_parent_course_details(self, obj):
        if obj.parent_course:
            return {
                "course_id": obj.parent_course.course_id,
                "name": obj.parent_course.name,
                "code": obj.parent_course.code
            }
        return None

    def _build_unique_semester_code(self, program: Program, semester_number: int) -> str:
        base = re.sub(r'[^A-Z0-9]', '', (program.code or '').upper()) or 'PROG'
        suffix = f"S{semester_number}"

        max_base_len = max(1, 10 - len(suffix))
        candidate = f"{base[:max_base_len]}{suffix}"
        if not Semester.objects.filter(semester_code=candidate).exists():
            return candidate

        counter = 1
        while True:
            tail = f"{semester_number}{counter}"
            max_base_len = max(1, 10 - len(tail))
            candidate = f"{base[:max_base_len]}{tail}"
            if not Semester.objects.filter(semester_code=candidate).exists():
                return candidate
            counter += 1

    def create(self, validated_data):
        program_id = validated_data.pop('program_id', None)
        semester_number = validated_data.pop('semester_number', None)
        semester_obj = validated_data.pop('semester', None)

        if program_id and semester_number:
            program = Program.objects.get(pk=program_id)
            semester_name = f'Semester {semester_number}'
            semester = Semester.objects.filter(program=program, name=semester_name).first()
            if not semester:
                semester = Semester.objects.create(
                    program=program,
                    name=semester_name,
                    semester_code=self._build_unique_semester_code(program, semester_number),
                    program_old=program.name,
                    capacity=30,
                )
            validated_data['semester'] = semester
        elif semester_obj:
            validated_data['semester'] = semester_obj

        return super().create(validated_data)

    def update(self, instance, validated_data):
        program_id = validated_data.pop('program_id', None)
        semester_number = validated_data.pop('semester_number', None)
        semester_obj = validated_data.pop('semester', None)

        if program_id and semester_number:
            program = Program.objects.get(pk=program_id)
            semester_name = f'Semester {semester_number}'
            semester = Semester.objects.filter(program=program, name=semester_name).first()
            if not semester:
                semester = Semester.objects.create(
                    program=program,
                    name=semester_name,
                    semester_code=self._build_unique_semester_code(program, semester_number),
                    program_old=program.name,
                    capacity=30,
                )
            validated_data['semester'] = semester
        elif semester_obj:
            validated_data['semester'] = semester_obj

        return super().update(instance, validated_data)