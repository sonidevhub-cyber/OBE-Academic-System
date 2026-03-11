from rest_framework import serializers
from .models import Attendance, Result, Scholarship, Department, Semester, Course
import re


# ===========================
# Department Serializer
# ===========================
class DepartmentSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='department_id', read_only=True)

    class Meta:
        model = Department
        fields = ['id', 'name', 'code', 'description', 'num_semesters']
    
    def validate_code(self, value):
        """Ensure department code is unique and properly formatted"""
        if not value:
            raise serializers.ValidationError("Department code is required.")
        
        # Check for uniqueness during creation
        if self.instance is None:  # Creating new department
            if Department.objects.filter(code=value).exists():
                raise serializers.ValidationError("Department with this code already exists.")
        
        return value.upper()  # Convert to uppercase
    
    def validate_name(self, value):
        """Ensure department name is unique"""
        if not value:
            raise serializers.ValidationError("Department name is required.")
        
        # Check for uniqueness during creation
        if self.instance is None:  # Creating new department
            if Department.objects.filter(name=value).exists():
                raise serializers.ValidationError("Department with this name already exists.")
        
        return value
    
    def validate_num_semesters(self, value):
        """Validate number of semesters"""
        if value < 1 or value > 12:
            raise serializers.ValidationError("Number of semesters must be between 1 and 12.")
        return value


# ===========================
# Semester Serializer
# ===========================
class SemesterSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='semester_id', read_only=True)
    department = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Semester
        fields = ['id', 'name', 'semester_code', 'program', 'capacity', 'department']


# ===========================
# Course Serializer
# ===========================
class CourseSerializer(serializers.ModelSerializer):
    department_id = serializers.IntegerField(write_only=True, required=False)
    semester_number = serializers.IntegerField(write_only=True, required=False, min_value=1, max_value=8)
    semester = serializers.PrimaryKeyRelatedField(
        queryset=Semester.objects.all(), write_only=True, required=False
    )
    semester_details = SemesterSerializer(source='semester', read_only=True)

    class Meta:
        model = Course
        fields = [
            'course_id', 'name', 'code', 'description', 'credits',
            'department_id', 'semester_number', 'semester', 'semester_details'
        ]

    def _build_unique_semester_code(self, department: Department, semester_number: int) -> str:
        base = re.sub(r'[^A-Z0-9]', '', (department.code or '').upper()) or 'DEPT'
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
        department_id = validated_data.pop('department_id', None)
        semester_number = validated_data.pop('semester_number', None)
        semester_obj = validated_data.pop('semester', None)

        if department_id and semester_number:
            department = Department.objects.get(pk=department_id)
            semester_name = f'Semester {semester_number}'
            semester = Semester.objects.filter(department=department, name=semester_name).first()
            if not semester:
                semester = Semester.objects.create(
                    department=department,
                    name=semester_name,
                    semester_code=self._build_unique_semester_code(department, semester_number),
                    program=department.name,
                    capacity=30,
                )
            validated_data['semester'] = semester
        elif semester_obj:
            validated_data['semester'] = semester_obj

        return super().create(validated_data)

    def update(self, instance, validated_data):
        department_id = validated_data.pop('department_id', None)
        semester_number = validated_data.pop('semester_number', None)
        semester_obj = validated_data.pop('semester', None)

        if department_id and semester_number:
            department = Department.objects.get(pk=department_id)
            semester_name = f'Semester {semester_number}'
            semester = Semester.objects.filter(department=department, name=semester_name).first()
            if not semester:
                semester = Semester.objects.create(
                    department=department,
                    name=semester_name,
                    semester_code=self._build_unique_semester_code(department, semester_number),
                    program=department.name,
                    capacity=30,
                )
            validated_data['semester'] = semester
        elif semester_obj:
            validated_data['semester'] = semester_obj

        return super().update(instance, validated_data)


# ===========================
# Attendance Serializer
# ===========================
class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = "_all_"
        extra_kwargs = {
            "student": {"read_only": True}
        }


# ===========================
# Result Serializer
# ===========================
class ResultSerializer(serializers.ModelSerializer):
    percentage = serializers.SerializerMethodField()
    course_details = serializers.SerializerMethodField()
    is_pending = serializers.SerializerMethodField()
    subject = serializers.SerializerMethodField()
    marks = serializers.SerializerMethodField()
    gpa = serializers.SerializerMethodField()
    remarks = serializers.SerializerMethodField()

    id = serializers.IntegerField(source='result_id', read_only=True)
    course_id = serializers.IntegerField(write_only=True, required=False)
    obtained_marks_input = serializers.FloatField(write_only=True, required=False, default=0)

    class Meta:
        model = Result
        fields = [
            'id', 'result_id', 'subject', 'marks', 'total_marks', 'obtained_marks',
            'grade', 'gpa', 'remarks', 'is_pending', 'percentage', 'course_details',
            'exam_type', 'exam_date', 'course_id', 'obtained_marks_input'
        ]
        read_only_fields = [
            'id', 'result_id', 'subject', 'marks', 'total_marks',
            'obtained_marks', 'grade', 'gpa', 'remarks', 'is_pending',
            'percentage', 'course_details'
        ]

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get('request', None)
        if request and request.method in ['POST', 'PUT', 'PATCH']:
            allowed = ['course_id', 'exam_type', 'exam_date', 'obtained_marks_input']
            return {k: v for k, v in fields.items() if k in allowed}
        return fields

    def create(self, validated_data):
        course_id = validated_data.pop('course_id', None)
        obtained_marks_input = validated_data.pop('obtained_marks_input', 0)
        exam_type = validated_data.get('exam_type', 'Mid')

        if not course_id:
            raise serializers.ValidationError("course_id is required")

        try:
            course = Course.objects.get(course_id=course_id)
        except Course.DoesNotExist:
            raise serializers.ValidationError(f"Course with ID '{course_id}' not found")

        validated_data['course'] = course
        validated_data.update({
            'assignment1_marks': 0,
            'assignment2_marks': 0,
            'assignment3_marks': 0,
            'mid_term_marks': 0
        })

        exam_type_lower = exam_type.lower()
        if 'quiz 1' in exam_type_lower or 'assignment 1' in exam_type_lower:
            validated_data['assignment1_marks'] = obtained_marks_input
        elif 'quiz 2' in exam_type_lower or 'assignment 2' in exam_type_lower:
            validated_data['assignment2_marks'] = obtained_marks_input
        elif 'mid' in exam_type_lower:
            validated_data['mid_term_marks'] = obtained_marks_input
        elif 'final' in exam_type_lower:
            validated_data['mid_term_marks'] = obtained_marks_input
        else:
            validated_data['assignment3_marks'] = obtained_marks_input

        return super().create(validated_data)

    # ======= Helper Methods =======
    def get_course_details(self, obj):
        if obj.course:
            return {
                'course_id': obj.course.course_id,
                'name': obj.course.name,
                'code': obj.course.code,
                'credits': obj.course.credits,
            }
        return None

    def get_is_pending(self, obj):
        return obj.obtained_marks == 0

    def get_subject(self, obj):
        return obj.course.name if obj.course else (f"{obj.exam_type} Exam" if obj.exam_type else 'General Result')

    def get_gpa(self, obj):
        grade_map = {
            'A+': 4.0, 'A': 4.0, 'A-': 3.7,
            'B+': 3.3, 'B': 3.0, 'B-': 2.7,
            'C+': 2.3, 'C': 2.0, 'C-': 1.7,
            'D+': 1.3, 'D': 1.0, 'F': 0.0
        }
        return grade_map.get(obj.grade.upper(), 0.0) if obj.grade else 0.0

    def get_marks(self, obj):
        return f"{obj.obtained_marks}/{obj.total_marks}"

    def get_percentage(self, obj):
        return obj.percentage

    def get_remarks(self, obj):
        if obj.obtained_marks == 0:
            return 'Result pending'
        elif obj.grade == 'F':
            return 'Failed'
        else:
            return f'Grade: {obj.grade}'


# ===========================
# Scholarship Serializer
# ===========================
class ScholarshipSerializer(serializers.ModelSerializer):
    class Meta:
        model = Scholarship
        fields = "_all_"


# ===========================
# Student Academic History Serializer
# ===========================
class StudentAcademicHistorySerializer(serializers.Serializer):
    department = DepartmentSerializer(read_only=True)
    semester = SemesterSerializer(read_only=True)
    attendance = AttendanceSerializer(many=True, read_only=True)
    results = ResultSerializer(many=True, read_only=True)

    class Meta:
        fields = ['department', 'semester', 'attendance', 'results']
