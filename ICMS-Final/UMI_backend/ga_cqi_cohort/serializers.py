from rest_framework import serializers
from obe.models import GACQIRecord


class GACQICohortSerializer(serializers.ModelSerializer):
    ga_title = serializers.CharField(source='ga.title', read_only=True)
    ga_code = serializers.SerializerMethodField()
    batch_name = serializers.CharField(source='batch.name', read_only=True)
    saved_by_hod_name = serializers.CharField(
        source='saved_by_hod.full_name', read_only=True, allow_null=True
    )
    
    def get_ga_code(self, obj):
        return f'GA-{obj.ga.order_number}'
    
    class Meta:
        model = GACQIRecord
        fields = [
            'id', 'ga', 'ga_title', 'ga_code', 'batch', 'batch_name',
            'cqi_level', 'status', 'issue_statement', 'hod_action_plan',
            'triggered_at', 'saved_by_hod', 'saved_by_hod_name', 'saved_at',
            'is_active', 'attainment_value', 'kpi_threshold_at_trigger'
        ]
        read_only_fields = [
            'id', 'triggered_at', 'saved_by_hod', 'saved_at', 'created_at',
            'updated_at'
        ]
