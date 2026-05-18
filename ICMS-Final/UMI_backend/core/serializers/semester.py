from rest_framework import serializers

from core.models.semester import Semester


class SemesterSerializer(serializers.ModelSerializer):
    program_id = serializers.UUIDField(source='program.id', read_only=True)

    class Meta:
        model = Semester
        fields = ['id', 'number', 'name', 'program_id']

