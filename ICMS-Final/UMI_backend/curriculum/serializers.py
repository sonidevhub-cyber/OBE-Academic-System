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
    assigned_batches = serializers.SerializerMethodField()
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
            'assigned_batches', 'version_no', 'status', 'cloned_from', 'cloned_from_version_no',
            'created_by', 'created_by_name', 'activated_by', 'activated_at',
            'created_at', 'updated_at', 'is_active', 'total_courses', 'is_editable'
        ]
        read_only_fields = ['version_no', 'status', 'created_by', 'activated_by', 'activated_at']

    def get_assigned_batches(self, obj):
        return [{"id": b.id, "name": b.name} for b in obj.assigned_batches.all()]

    def get_total_courses(self, obj):
        return obj.version_courses.count()

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if self.context.get('view_type') == 'detail':
            from coordinators.models import TeacherAllocation
            from coordinators.serializers import TeacherAllocationSerializer
            from core.models.batch import Batch
            courses = instance.version_courses.filter(is_active=True)
            grouped_courses = {}
            
            batch_id = self.context.get('batch_id')
            print(f"[CurriculumVersionSerializer] Batch ID from context: {batch_id}")
            batch = None
            if batch_id:
                try:
                    batch = Batch.objects.get(pk=batch_id)
                    print(f"[CurriculumVersionSerializer] Found batch: {batch}")
                except Batch.DoesNotExist:
                    print(f"[CurriculumVersionSerializer] Batch {batch_id} does not exist!")
            
            for vc in courses:
                sem_key = f"semester_{vc.semester_no}"
                if sem_key not in grouped_courses:
                    grouped_courses[sem_key] = []
                
                course_data = CurriculumVersionCourseSerializer(vc).data
                print(f"[CurriculumVersionSerializer] Processing course: {vc.course.code} (id={vc.course.id}), semester: {vc.semester_no}")
                
                # Try to get allocation
                allocation_query = TeacherAllocation.objects.filter(
                    curriculum_version=instance, 
                    course=vc.course, 
                    status='active'
                )
                print(f"[CurriculumVersionSerializer] Allocation query (without batch): {allocation_query.query}")
                print(f"[CurriculumVersionSerializer] Allocations found (without batch): {allocation_query.count()}")
                if batch:
                    allocation_query = allocation_query.filter(batch=batch)
                    print(f"[CurriculumVersionSerializer] Allocation query (with batch): {allocation_query.query}")
                    print(f"[CurriculumVersionSerializer] Allocations found (with batch): {allocation_query.count()}")
                
                allocation = allocation_query.first()
                print(f"[CurriculumVersionSerializer] Final allocation for {vc.course.code}: {allocation}")
                
                course_data['allocation'] = TeacherAllocationSerializer(allocation).data if allocation else None
                
                grouped_courses[sem_key].append(course_data)
            representation['courses_by_semester'] = grouped_courses
        return representation