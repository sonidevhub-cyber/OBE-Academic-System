from rest_framework import serializers
<<<<<<< HEAD
from .models import Semester, Course
import re
from core.models.program import Program

=======
from .models import Attendance, Result, Scholarship, Semester, Course
import re
from academic_structure.models import Program
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03

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

<<<<<<< HEAD
=======
# ===========================
# Attendance Serializer
# ===========================
class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    
    class Meta:
        model = Attendance
        fields = '__all__'

# ===========================
# Result Serializer
# ===========================
class ResultSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    percentage = serializers.ReadOnlyField()
    
    class Meta:
        model = Result
        fields = '__all__'

# ===========================
# Course Allocation Serializer
# ===========================
from .models import Timetable

class CourseAllocationSerializer(serializers.ModelSerializer):
    allocation_id = serializers.IntegerField(source='timetable_id', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    instructor_name = serializers.CharField(source='instructor.full_name', read_only=True)
    semester = serializers.IntegerField(source='course.semester.semester_id', read_only=True)
    semester_name = serializers.CharField(source='course.semester.name', read_only=True)
    coordinator_name = serializers.CharField(source='created_by.full_name', read_only=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = Timetable
        fields = [
            'allocation_id', 'course', 'course_name', 'course_code',
            'instructor', 'instructor_name', 'semester', 'semester_name',
            'coordinator_name', 'status', 'approved_at', 'rejection_reason'
        ]

    def get_status(self, obj):
        mapping = {
            'draft': 'proposed',
            'pending': 'proposed',
            'approved': 'active',
            'rejected': 'rejected'
        }
        return mapping.get(obj.approval_status, 'proposed')

# ===========================
# Scholarship Serializer
# ===========================
class ScholarshipSerializer(serializers.ModelSerializer):
    class Meta:
        model = Scholarship
        fields = '__all__'
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
