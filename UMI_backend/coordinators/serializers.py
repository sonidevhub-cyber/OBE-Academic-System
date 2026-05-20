from rest_framework import serializers
from .models import TeacherAllocation

class TeacherAllocationSerializer(serializers.ModelSerializer):
    course_name = serializers.ReadOnlyField(source='course.name')
    course_code = serializers.ReadOnlyField(source='course.code')
    teacher_name = serializers.ReadOnlyField(source='teacher.full_name')
    batch_name = serializers.ReadOnlyField(source='batch.name')
    allocated_by_name = serializers.ReadOnlyField(source='allocated_by.full_name')
    version_no = serializers.ReadOnlyField(source='curriculum_version.version_no')

    class Meta:
        model = TeacherAllocation
        fields = [
            'id', 'curriculum_version', 'course', 'course_name', 'course_code',
            'batch', 'batch_name', 'semester_no', 'teacher', 'teacher_name',
            'allocated_by', 'allocated_by_name', 'allocated_at', 'status',
            'change_reason', 'cloned_from', 'version_no'
        ]
        read_only_fields = ['allocated_by', 'allocated_at', 'status']

class BulkAllocationSerializer(serializers.Serializer):
    curriculum_version = serializers.IntegerField()
    allocations = serializers.ListField(
        child=serializers.DictField()
    )

    def validate_allocations(self, value):
        for item in value:
            if 'course' not in item or 'teacher' not in item:
                raise serializers.ValidationError("Each allocation must have 'course' and 'teacher'")
            # IDs can be UUID strings or integers
        return value
