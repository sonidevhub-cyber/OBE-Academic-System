from rest_framework import serializers

from core.models.course import Course
from core.models.program import Program


class ProgramListSerializer(serializers.ModelSerializer):
    semesters = serializers.SerializerMethodField()
    course_count = serializers.SerializerMethodField()
    department = serializers.PrimaryKeyRelatedField(read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    department_code = serializers.CharField(source='department.code', read_only=True, allow_null=True)

    class Meta:
        model = Program
        fields = [
            'id',
            'custom_id',
            'name',
            'code',
            'department',
            'department_name',
            'department_code',
            'description',
            'total_semesters',
            'created_at',
            'semesters',
            'course_count',
        ]

    def get_semesters(self, obj):
        semesters_qs = getattr(obj, 'semesters', None)
        if semesters_qs is None:
            return []
        return [
            {'id': s.id, 'number': s.number, 'name': s.name}
            for s in semesters_qs.all().order_by('number')
        ]

    def get_course_count(self, obj):
        return Course.objects.filter(program=obj, is_active=True).count()


class ProgramDetailSerializer(serializers.ModelSerializer):
    semesters = serializers.SerializerMethodField()
    department = serializers.PrimaryKeyRelatedField(read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    department_code = serializers.CharField(source='department.code', read_only=True, allow_null=True)

    class Meta:
        model = Program
        fields = [
            'id',
            'name',
            'code',
            'department',
            'department_name',
            'department_code',
            'description',
            'total_semesters',
            'created_at',
            'is_active',
            'semesters',
        ]

    def get_semesters(self, obj):
        semesters = obj.semesters.all().order_by('number')
        return [
            {
                'id': sem.id,
                'number': sem.number,
                'name': sem.name,
                'courses': [
                    {
                        'id': c.id,
                        'name': c.name,
                        'code': c.code,
                        'course_type': c.course_type,
                        'credit_hours': c.credit_hours,
                        'semester_id': c.semester_id,
                        'is_active': c.is_active,
                    }
                    for c in sem.courses.filter(is_active=True).order_by('code')
                ],
            }
            for sem in semesters
        ]


class ProgramCreateSerializer(serializers.ModelSerializer):
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Program
        fields = ['name', 'code', 'description', 'total_semesters', 'created_by']

    def create(self, validated_data):
        return Program.objects.create(**validated_data)

