from rest_framework import serializers
from .models import Coordinator, TimetableProposal, TimetableSlot, CourseAllocation, CoordinatorDashboard
from academics.models import Course, Semester, Department
from instructors.models import Instructor
from hods.models import HOD

class CoordinatorSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    assigned_by_name = serializers.CharField(source='assigned_by.name', read_only=True)
    
    class Meta:
        model = Coordinator
        fields = '__all__'
        read_only_fields = ('user', 'assigned_by', 'created_at', 'updated_at', 'employee_id')

class TimetableSlotSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source='course.name', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    instructor_name = serializers.CharField(source='instructor.name', read_only=True)
    
    class Meta:
        model = TimetableSlot
        fields = '__all__'

class TimetableProposalSerializer(serializers.ModelSerializer):
    slots = TimetableSlotSerializer(many=True, read_only=True)
    coordinator_name = serializers.CharField(source='coordinator.name', read_only=True)
    semester_name = serializers.CharField(source='semester.name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.name', read_only=True)
    
    class Meta:
        model = TimetableProposal
        fields = '__all__'
        read_only_fields = ('coordinator', 'reviewed_by', 'reviewed_at')

class CourseAllocationSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source='course.name', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    instructor_name = serializers.CharField(source='instructor.name', read_only=True)
    semester_name = serializers.CharField(source='semester.name', read_only=True)
    coordinator_name = serializers.CharField(source='coordinator.name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.name', read_only=True)
    
    class Meta:
        model = CourseAllocation
        fields = '__all__'
        read_only_fields = ('coordinator', 'approved_by', 'approved_at')

class CoordinatorDashboardSerializer(serializers.ModelSerializer):
    coordinator_name = serializers.CharField(source='coordinator.name', read_only=True)
    
    class Meta:
        model = CoordinatorDashboard
        fields = '__all__'
        read_only_fields = ('coordinator', 'last_updated')

# Serializers for creating proposals and allocations
class CreateTimetableProposalSerializer(serializers.ModelSerializer):
    status = serializers.ChoiceField(
        choices=['draft', 'submitted'],
        required=False,
        default='draft'
    )
    slots = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        write_only=True,
        default=list
    )

    class Meta:
        model = TimetableProposal
        fields = ['semester', 'title', 'description', 'status', 'slots']

    def create(self, validated_data):
        # Non-model payload keys used by the view logic.
        validated_data.pop('slots', None)
        validated_data.pop('status', None)
        return TimetableProposal.objects.create(**validated_data)

class CreateTimetableSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimetableSlot
        fields = ['course', 'instructor', 'day', 'start_time', 'end_time', 'room']

class CreateCourseAllocationSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        course = attrs.get('course')
        semester = attrs.get('semester')

        if course and semester and course.semester_id != semester.semester_id:
            raise serializers.ValidationError({
                'semester': 'Selected semester does not match the selected course.'
            })

        return attrs

    class Meta:
        model = CourseAllocation
        fields = ['course', 'instructor', 'semester', 'hod_comments']
