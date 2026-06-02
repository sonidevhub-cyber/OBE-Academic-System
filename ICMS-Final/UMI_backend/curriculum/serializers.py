from rest_framework import serializers
from .models import CurriculumVersion, CurriculumVersionCourse
from core.serializers.course import CourseSerializer
from core.models import Course

class CurriculumVersionCourseSerializer(serializers.ModelSerializer):
    course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all())
    course_code = serializers.ReadOnlyField(source='course.code')
    course_name = serializers.ReadOnlyField(source='course.name')
    course_type = serializers.ReadOnlyField(source='course.course_type')
    credit_hours = serializers.ReadOnlyField(source='course.credit_hours')

    class Meta:
        model = CurriculumVersionCourse
        fields = [
            'id', 'course', 'course_code', 'course_name', 'course_type', 
            'credit_hours', 'semester_no', 'is_active'
        ]
        read_only_fields = ['is_active']

    def validate(self, attrs):
        version = self.context.get('version')
        course = attrs.get('course')

        if not version.is_editable():
            raise serializers.ValidationError("Version must be in draft status to add/edit courses")
        
        # Only validate program match if a course is actually provided
        if course and course.program != version.program:
            raise serializers.ValidationError("Course program must match version program")
            
        return attrs

class CurriculumVersionSerializer(serializers.ModelSerializer):
    batch_name = serializers.ReadOnlyField(source='batch.name')
    program_name = serializers.ReadOnlyField(source='program.name')
    program_total_semesters = serializers.ReadOnlyField(source='program.total_semesters')
    created_by_name = serializers.ReadOnlyField(source='created_by.full_name')
    cloned_from_version_no = serializers.ReadOnlyField(source='cloned_from.version_no')
    total_courses = serializers.SerializerMethodField()
    is_editable = serializers.ReadOnlyField()

    class Meta:
        model = CurriculumVersion
        fields = [
            'id', 'program', 'program_name', 'program_total_semesters', 'batch', 'batch_name', 
            'version_no', 'status', 'cloned_from', 'cloned_from_version_no',
            'created_by', 'created_by_name', 'activated_by', 'activated_at',
            'created_at', 'updated_at', 'is_active', 'total_courses', 'is_editable'
        ]
        read_only_fields = ['version_no', 'status', 'created_by', 'activated_by', 'activated_at']

    def get_total_courses(self, obj):
        return obj.version_courses.count()

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if self.context.get('view_type') == 'detail':
            from coordinators.models import TeacherAllocation
            from coordinators.serializers import TeacherAllocationSerializer
            courses = instance.version_courses.all()
            grouped_courses = {}
            for vc in courses:
                sem_key = f"semester_{vc.semester_no}"
                if sem_key not in grouped_courses:
                    grouped_courses[sem_key] = []
                
                # In a real scenario, we'd add allocation info here from Module 2
                course_data = CurriculumVersionCourseSerializer(vc).data
                # Try to get allocation (Module 2)
                allocation = TeacherAllocation.objects.filter(
                    curriculum_version=instance, 
                    course=vc.course, 
                    status='active'
                ).first()
                course_data['allocation'] = TeacherAllocationSerializer(allocation).data if allocation else None
                
                grouped_courses[sem_key].append(course_data)
            representation['courses_by_semester'] = grouped_courses
        return representation