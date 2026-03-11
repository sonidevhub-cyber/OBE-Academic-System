from rest_framework import serializers
from django.contrib.auth import get_user_model
User = get_user_model()
from datetime import date
from .models import Student
from academics.models import Course, Department, Semester
from academics.serializers import CourseSerializer


class StudentSerializer(serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    semester = serializers.SerializerMethodField()
    courses = CourseSerializer(many=True, read_only=True)
    department_id = serializers.IntegerField(required=False, allow_null=True)
    semester_id = serializers.IntegerField(required=False, allow_null=True)
    image = serializers.ImageField(required=False, allow_null=True)

    def get_id(self, obj):
        return obj.student_id

    def get_department(self, obj):
        if obj.department:
            return {
                'id': obj.department.department_id,
                'name': obj.department.name,
                'code': obj.department.code,
                'description': obj.department.description,
                'num_semesters': obj.department.num_semesters,
            }
        return None

    def get_semester(self, obj):
        if obj.semester:
            return {
                'id': obj.semester.semester_id,
                'name': obj.semester.name,
                'semester_code': obj.semester.semester_code,
                'program': obj.semester.program,
                'capacity': obj.semester.capacity,
                'department': obj.semester.department.department_id if obj.semester.department else None,
            }
        return None

    def get_department_id(self, obj):
        return obj.department.department_id if obj.department else None

    # ✅ Auto assign semester courses
    def _assign_semester_courses(self, student):
        import logging
        logger = logging.getLogger(__name__)

        if not student.semester:
            logger.warning(f"Student {student.name} (ID: {student.student_id}) has no semester assigned. Skipping course assignment.")
            return

        try:
            semester_courses = Course.objects.filter(semester=student.semester)
            student.courses.set(semester_courses)

            added_names = list(semester_courses.values_list('name', flat=True))
            logger.info(f"Assigned courses to {student.name}: {added_names}")

        except Exception as e:
            logger.error(f"Error assigning courses to {student.name}: {e}")
            raise

    def validate(self, data):
        print(f"StudentSerializer validate - Incoming data: {data}")

        required_fields = ['email', 'department_id', 'registration_number']
        for field in required_fields:
            if field not in data or not data[field]:
                raise serializers.ValidationError(f"{field} is required")

        if not data.get('name') and not (data.get('first_name') and data.get('last_name')):
            raise serializers.ValidationError("Either 'name' or both 'first_name' and 'last_name' are required")

        return data

    def create(self, validated_data):
        # ✅ Extract and set department + semester
        department_id = validated_data.pop('department_id', None)
        semester_id = validated_data.pop('semester_id', None)
        if department_id:
            validated_data['department'] = Department.objects.get(pk=department_id)
        if semester_id:
            validated_data['semester'] = Semester.objects.get(pk=semester_id)

        # ✅ Merge first/last name into full name
        if validated_data.get('first_name') or validated_data.get('last_name'):
            validated_data['name'] = f"{validated_data.get('first_name', '')} {validated_data.get('last_name', '')}".strip()

        validated_data.setdefault('phone', 'N/A')
        validated_data.setdefault('date_of_birth', date.today())

        # ✅ Set student_id to registration_number for uniqueness
        validated_data['student_id'] = validated_data.get('registration_number')

        # ✅ Create student record
        student = super().create(validated_data)

        # ✅ Auto assign semester courses
        self._assign_semester_courses(student)

        return student

    def update(self, instance, validated_data):
        department_id = validated_data.pop('department_id', None)
        semester_id = validated_data.pop('semester_id', None)

        if department_id:
            validated_data['department'] = Department.objects.get(pk=department_id)
        if semester_id:
            validated_data['semester'] = Semester.objects.get(pk=semester_id)

        if validated_data.get('first_name') or validated_data.get('last_name'):
            validated_data['name'] = f"{validated_data.get('first_name', '')} {validated_data.get('last_name', '')}".strip()

        student = super().update(instance, validated_data)

        if 'semester' in validated_data or 'semester_id' in validated_data:
            self._assign_semester_courses(student)

        return student

    class Meta:
        model = Student
        fields = '__all__'
        extra_kwargs = {
            'password': {'write_only': True},
            'name': {'required': False},
            'father_guardian': {'required': False},
            'student_id': {'read_only': True},
        }