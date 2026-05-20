from rest_framework import serializers

from core.models.batch import Batch


class BatchCreateSerializer(serializers.ModelSerializer):
    program_id = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = Batch
        fields = ['name', 'start_year', 'end_year', 'session_type', 'program_id']

    def validate(self, attrs):
        if attrs['end_year'] <= attrs['start_year']:
            raise serializers.ValidationError('End year must be greater than start year')
        return attrs

    def create(self, validated_data):
        from core.models.program import Program

        program_id = validated_data.pop('program_id')
        program = Program.objects.get(id=program_id, is_active=True)

        session_type = validated_data.get('session_type')
        current_semester = 1 if session_type == 'fall' else 2
        return Batch.objects.create(program=program, current_semester=current_semester, **validated_data)


class BatchListSerializer(serializers.ModelSerializer):
    program_name = serializers.CharField(source='program.name', read_only=True)
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
            'graduated_at',
            'is_active',
            'student_count',
        ]

    def get_student_count(self, obj):
        User = self.context['request'].user.__class__
        # Avoid importing user model directly in serializer for minimal coupling
        from django.contrib.auth import get_user_model

        user_model = get_user_model()
        return user_model.objects.filter(batch=obj, role='student').count()

