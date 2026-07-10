from rest_framework import serializers

from core.models.batch import Batch
from core.models.course import Course # Import Course model
from core.models.semester import Semester # Import Semester model


class BatchCreateSerializer(serializers.ModelSerializer):
    program_id = serializers.UUIDField(write_only=True, required=False)
    curriculum_version_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Batch
        fields = ['name', 'start_year', 'end_year', 'session_type', 'program_id', 'curriculum_version_id']

    def validate(self, attrs):
        if attrs['end_year'] <= attrs['start_year']:
            raise serializers.ValidationError('End year must be greater than start year')
        return attrs

    def create(self, validated_data):
        from core.models.program import Program
        from curriculum.models import CurriculumVersion
        from curriculum.services import clone_curriculum_for_batch

        program_id = validated_data.pop('program_id')
        curriculum_version_id = validated_data.pop('curriculum_version_id', None)
        program = Program.objects.get(id=program_id, is_active=True)

        session_type = validated_data.get('session_type')
        current_semester = 1 if session_type == 'fall' else 2
        
        new_batch = Batch.objects.create(program=program, current_semester=current_semester, **validated_data)

        if curriculum_version_id:
            try:
                master_version = CurriculumVersion.objects.get(id=curriculum_version_id, program=program, status='finalized')
                
                # Use request user from context
                request = self.context.get('request')
                user = request.user if request else None
                
                if not user:
                    # Fallback to program creator if no request user
                    user = program.created_by
                
                if user:
                    clone_curriculum_for_batch(master_version, new_batch, user)

            except CurriculumVersion.DoesNotExist:
                # Handle case where master version is not found
                print(f"Warning: Master curriculum version with ID {curriculum_version_id} not found.")

        return new_batch


from core.models.program import Program

class ProgramSerializer(serializers.ModelSerializer):
    class Meta:
        model = Program
        fields = "__all__"
        
class BatchListSerializer(serializers.ModelSerializer):
    program_name = serializers.CharField(source='program.name', read_only=True)
    program_id = serializers.CharField(source='program.id', read_only=True)
    curriculum_version_id = serializers.IntegerField(source='curriculum_version.id', read_only=True, allow_null=True)
    curriculum_version_no = serializers.CharField(source='curriculum_version.version_no', read_only=True)
    student_count = serializers.SerializerMethodField()
    program = ProgramSerializer(read_only=True)
    is_graduating_eligible = serializers.BooleanField(read_only=True)
    pending_exit_survey_count = serializers.IntegerField(read_only=True)
    exit_survey_enabled = serializers.BooleanField(read_only=True)
    exit_survey_enabled_at = serializers.DateTimeField(read_only=True, allow_null=True)
    alumni_feedback_enabled = serializers.BooleanField(read_only=True)
    alumni_feedback_enabled_at = serializers.DateTimeField(read_only=True, allow_null=True)
    alumni_feedback_due_at = serializers.SerializerMethodField()
    graduation_status = serializers.CharField(read_only=True)
    is_program_end_ready = serializers.BooleanField(read_only=True)
    is_alumni_feedback_eligible = serializers.BooleanField(read_only=True)
    alumni_feedback_cycle_status = serializers.SerializerMethodField()
    alumni_feedback_response_rate = serializers.SerializerMethodField()
    alumni_feedback_response_count = serializers.SerializerMethodField()
    alumni_feedback_total_alumni = serializers.SerializerMethodField()

    class Meta:
        model = Batch
        fields = [
            'id',
            'custom_id',
            'name',
            'program_name',
            'program_id',
            'session_type',
            'start_year',
            'end_year',
            'current_semester',
            'status',
            'curriculum_version_id',
            'curriculum_version_no',
            'graduated_at',
            'is_active',
            'student_count',
            'program',
            'is_graduating_eligible',
            'pending_exit_survey_count',
            'exit_survey_enabled',
            'exit_survey_enabled_at',
            'alumni_feedback_enabled',
            'alumni_feedback_enabled_at',
            'alumni_feedback_due_at',
            'graduation_status',
            'is_program_end_ready',
            'is_alumni_feedback_eligible',
            'alumni_feedback_cycle_status',
            'alumni_feedback_response_rate',
            'alumni_feedback_response_count',
            'alumni_feedback_total_alumni',
        ]

    def get_student_count(self, obj):
        User = self.context['request'].user.__class__
        # Avoid importing user model directly in serializer for minimal coupling
        from django.contrib.auth import get_user_model
        from django.db.models import Q

        user_model = get_user_model()
        # Count both active students and alumni in this batch, case-insensitive
        return user_model.objects.filter(
            batch=obj
        ).filter(
            Q(role__iexact='student') | Q(role__iexact='alumni')
        ).count()

    def _get_alumni_cycle(self, obj):
        active_cycle = obj.alumni_survey_cycles.filter(
            survey_window='2_YEARS',
            status='ACTIVE',
            is_active=True
        ).order_by('-created_at').first()
        if active_cycle:
            return active_cycle
        return obj.alumni_survey_cycles.filter(
            survey_window='2_YEARS',
            is_active=True
        ).order_by('-created_at').first()

    def get_alumni_feedback_cycle_status(self, obj):
        cycle = self._get_alumni_cycle(obj)
        return cycle.status if cycle else None

    def get_alumni_feedback_due_at(self, obj):
        if obj.alumni_feedback_due_at:
            return obj.alumni_feedback_due_at

        cycle = self._get_alumni_cycle(obj)
        return cycle.due_at if cycle else None

    def get_alumni_feedback_response_count(self, obj):
        cycle = self._get_alumni_cycle(obj)
        if not cycle:
            return 0
        return cycle.responses.filter(is_active=True).values('student').distinct().count()

    def get_alumni_feedback_total_alumni(self, obj):
        from django.contrib.auth import get_user_model
        user_model = get_user_model()
        return user_model.objects.filter(
            batch=obj,
            role__iexact='alumni',
            is_active=True
        ).count()

    def get_alumni_feedback_response_rate(self, obj):
        total = self.get_alumni_feedback_total_alumni(obj)
        if not total:
            return 0
        responses = self.get_alumni_feedback_response_count(obj)
        return round((responses / total) * 100, 2)
