from rest_framework import serializers
from .models import TeacherAllocation

class TeacherAllocationSerializer(serializers.ModelSerializer):
    course_name = serializers.ReadOnlyField(source='course.name')
    course_code = serializers.ReadOnlyField(source='course.code')
    teacher_name = serializers.ReadOnlyField(source='teacher.full_name')
    teacher_id = serializers.ReadOnlyField(source='teacher.id')
    batch_name = serializers.ReadOnlyField(source='batch.name')
    batch_status = serializers.ReadOnlyField(source='batch.status')
    batch_current_semester = serializers.ReadOnlyField(source='batch.current_semester')
    allocated_by_name = serializers.ReadOnlyField(source='allocated_by.full_name')
    version_no = serializers.ReadOnlyField(source='curriculum_version.version_no')
    coordinator_name = serializers.ReadOnlyField(source='allocated_by.full_name')
    instructor = serializers.ReadOnlyField(source='teacher.id')
    teacher = serializers.ReadOnlyField(source='teacher.id')
    allocation_id = serializers.ReadOnlyField(source='id')

    class Meta:
        model = TeacherAllocation
        fields = [
            'id', 'allocation_id', 'curriculum_version', 'course', 'course_name', 'course_code',
            'batch', 'batch_name', 'batch_status', 'batch_current_semester', 'semester_no', 
            'teacher', 'teacher_id', 'teacher_name', 'instructor',
            'allocated_by', 'allocated_by_name', 'coordinator_name', 'allocated_at', 'status',
            'change_reason', 'cloned_from', 'version_no'
        ]
        read_only_fields = ['allocated_by', 'allocated_at', 'status']

class BulkAllocationSerializer(serializers.Serializer):
    curriculum_version = serializers.IntegerField()
    batch = serializers.UUIDField()
    allocations = serializers.ListField(
        child=serializers.DictField()
    )

    def validate_allocations(self, value):
        for item in value:
            if 'course' not in item or 'teacher' not in item:
                raise serializers.ValidationError("Each allocation must have 'course' and 'teacher'")
            # IDs can be UUID strings or integers
        return value
