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


class BatchListSerializer(serializers.ModelSerializer):
    program_name = serializers.CharField(source='program.name', read_only=True)
    curriculum_version_no = serializers.CharField(source='curriculum_version.version_no', read_only=True)
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = Batch
        fields = [
            'id',
            'custom_id',
            'name',
            'program_name',
            'session_type',
            'start_year',
            'end_year',
            'current_semester',
            'status',
            'curriculum_version_no',
            'graduated_at',
            'is_active',
            'student_count',
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