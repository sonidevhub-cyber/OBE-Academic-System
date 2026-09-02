from rest_framework import serializers
from obe.models import GACQIRecord


class GACQICohortSerializer(serializers.ModelSerializer):
    ga_title = serializers.CharField(source='ga.title', read_only=True)
    ga_code = serializers.SerializerMethodField()
    batch_name = serializers.CharField(source='batch.name', read_only=True)
    saved_by_hod_name = serializers.CharField(
        source='saved_by_hod.full_name', read_only=True, allow_null=True
    )
    closed_by_name = serializers.CharField(
        source='closed_by.full_name', read_only=True, allow_null=True
    )
    implemented_in_batch_name = serializers.CharField(
        source='implemented_in_batch.name', read_only=True, allow_null=True
    )
    
    def get_ga_code(self, obj):
        return f'GA-{obj.ga.order_number}'
    
    class Meta:
        model = GACQIRecord
        fields = [
            'id', 'ga', 'ga_title', 'ga_code', 'batch', 'batch_name',
            'cqi_level', 'status', 'issue_statement', 'hod_action_plan',
            'root_cause',
            'triggered_at', 'saved_by_hod', 'saved_by_hod_name', 'saved_at',
            'remedy_text', 'closed_by', 'closed_by_name', 'closed_at',
            'is_active', 'attainment_value', 'kpi_threshold_at_trigger',
            'implemented_in_batch', 'implemented_in_batch_name',
            'action_taken_description', 'resulting_attainment',
        ]
        read_only_fields = [
            'id', 'triggered_at', 'saved_by_hod', 'saved_at', 'created_at',
            'updated_at', 'closed_by', 'closed_at'
        ]


class GACQICumulativeCloseSerializer(serializers.ModelSerializer):
    status = serializers.CharField(read_only=True)
    remedy_text = serializers.CharField(required=True, min_length=20)

    class Meta:
        model = GACQIRecord
        fields = ['id', 'remedy_text', 'status', 'closed_by', 'closed_at']
        read_only_fields = ['id', 'status', 'closed_by', 'closed_at']

    def validate_remedy_text(self, value):
        trimmed_value = value.strip()
        if len(trimmed_value) < 20:
            raise serializers.ValidationError(
                'Departmental Improvement Framework must be at least 20 characters.'
            )
        return trimmed_value
