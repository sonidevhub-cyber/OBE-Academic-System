from rest_framework import serializers
from .models import (
    StudentAttendance, FacultyAttendance, AttendanceEditRequest,
    AttendanceSettings, AttendanceAlert, BulkAttendanceSession, AttendanceUpdateRequest
)

class StudentAttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    instructor_name = serializers.CharField(source='instructor.name', read_only=True)
    department_name = serializers.CharField(source='course.semester.department.name', read_only=True)
    semester_name = serializers.CharField(source='course.semester.name', read_only=True)
    attendance_percentage = serializers.ReadOnlyField()
    
    class Meta:
        model = StudentAttendance
        fields = '__all__'

class FacultyAttendanceSerializer(serializers.ModelSerializer):
    faculty_name = serializers.SerializerMethodField()
    faculty_type = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    
    class Meta:
        model = FacultyAttendance
        fields = '__all__'
    
    def get_faculty_name(self, obj):
        return obj.get_faculty_name()
    
    def get_faculty_type(self, obj):
        return obj.get_faculty_type()
    
    def get_department_name(self, obj):
        department = obj.get_department()
        return department.name if department else None

class AttendanceEditRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.get_full_name', read_only=True)
    student_name = serializers.SerializerMethodField()
    faculty_name = serializers.SerializerMethodField()
    course_name = serializers.SerializerMethodField()
    
    class Meta:
        model = AttendanceEditRequest
        fields = '__all__'
    
    def get_student_name(self, obj):
        if obj.student_attendance:
            return obj.student_attendance.student.name
        return None
    
    def get_faculty_name(self, obj):
        if obj.faculty_attendance:
            return obj.faculty_attendance.get_faculty_name()
        return None
    
    def get_course_name(self, obj):
        if obj.student_attendance:
            return obj.student_attendance.course.name
        return None

class AttendanceSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceSettings
        fields = '__all__'

class AttendanceAlertSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    
    class Meta:
        model = AttendanceAlert
        fields = '__all__'

class BulkAttendanceSessionSerializer(serializers.ModelSerializer):
    instructor_name = serializers.CharField(source='instructor.name', read_only=True)
    course_name = serializers.CharField(source='timetable.course.name', read_only=True)
    course_code = serializers.CharField(source='timetable.course.code', read_only=True)
    
    class Meta:
        model = BulkAttendanceSession
        fields = '__all__'


class AttendanceUpdateRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.name', read_only=True)
    course_name = serializers.CharField(source='timetable.course.name', read_only=True)
    course_code = serializers.CharField(source='timetable.course.code', read_only=True)
    section = serializers.CharField(source='timetable.course.semester.name', read_only=True)
    instructor_name = serializers.CharField(source='timetable.instructor.name', read_only=True)

    class Meta:
        model = AttendanceUpdateRequest
        fields = '__all__'
