from rest_framework import serializers 
from curriculum.models import CurriculumVersion
from .models import ( 
    PEO, GA, GAPEOMapping, 
    CLO, CLOGAMapping, 
    CourseSession,
    CourseGAScore,
    GACQIRecord,
    GACQIResubmissionHistory
) 
from django.core.exceptions import ValidationError
from django.db.models import Sum
from decimal import Decimal


class PEOSerializer(serializers.ModelSerializer): 
    class Meta: 
        model = PEO 
        fields = [ 
            'id', 'program', 'title', 
            'description', 'order_number', 
            'is_active', 'created_at' 
        ] 
        read_only_fields = ['id', 'created_at'] 


class GASerializer(serializers.ModelSerializer): 
    class Meta: 
        model = GA 
        fields = [ 
            'id', 'program', 'title', 
            'description', 'order_number', 'kpi_threshold',
            'is_active', 'created_at' 
        ] 
        read_only_fields = ['id', 'created_at'] 


class GAPEOMappingSerializer( 
    serializers.ModelSerializer 
): 
    ga_title = serializers.CharField( 
        source='ga.title', read_only=True 
    ) 
    peo_title = serializers.CharField( 
        source='peo.title', read_only=True 
    ) 

    class Meta: 
        model = GAPEOMapping 
        fields = [ 
            'id', 'ga', 'peo', 
            'ga_title', 'peo_title', 
            'is_active', 'created_at' 
        ] 
        read_only_fields = ['id', 'created_at'] 


class CLOSerializer(serializers.ModelSerializer): 
    course_name = serializers.CharField( 
        source='course.name', read_only=True 
    ) 
    version_no = serializers.CharField( 
        source='curriculum_version.version_no', read_only=True 
    ) 

    class Meta: 
        model = CLO 
        fields = [ 
            'id', 'course', 'curriculum_version', 
            'course_name', 'version_no', 
            'title', 'description', 
            'order_number', 'bloom_level', 'kpi_target', 
            'is_active', 'created_at' 
        ] 
        read_only_fields = ['id', 'created_at'] 


class CLOGAMappingSerializer( 
    serializers.ModelSerializer 
): 
    clo_title = serializers.CharField( 
        source='clo.title', read_only=True 
    ) 
    ga_title = serializers.CharField( 
        source='ga.title', read_only=True 
    ) 

    class Meta: 
        model = CLOGAMapping 
        fields = [ 
            'id', 'clo', 'ga', 'weight', 
            'clo_title', 'ga_title', 
            'is_active', 'created_at' 
        ] 
        read_only_fields = ['id', 'created_at']


class CourseGAScoreSerializer(serializers.ModelSerializer):
    ga_title = serializers.CharField(source='ga.title', read_only=True)

    class Meta:
        model = CourseGAScore
        fields = ['id', 'course_session', 'ga', 'ga_title', 'score', 'calculated_at', 'is_stale']
        read_only_fields = ['id', 'calculated_at']


class GACQIResubmissionHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = GACQIResubmissionHistory
        fields = ['id', 'cqi_record', 'reason_snapshot', 'remedy_snapshot', 'status_at_time', 'submitted_at']
        read_only_fields = ['id', 'submitted_at']


class GACQIRecordSerializer(serializers.ModelSerializer):
    history = GACQIResubmissionHistorySerializer(many=True, read_only=True)
    ga_title = serializers.CharField(source='ga.title', read_only=True)

    class Meta:
        model = GACQIRecord
        fields = [
            'id', 'ga', 'ga_title', 'trigger_type', 'affected_course_sessions',
            'reason', 'remedy', 'status', 'hod_rejection_comment',
            'created_at', 'updated_at', 'history'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'history']


class CourseSessionSerializer( 
    serializers.ModelSerializer 
): 
    course_name = serializers.CharField( 
        source='course.name', read_only=True 
    ) 
    batch_name = serializers.CharField( 
        source='batch.name', read_only=True 
    ) 
    semester_name = serializers.CharField( 
        source='semester.name', read_only=True 
    ) 
    instructor_name = serializers.CharField( 
        source='instructor.full_name', 
        read_only=True 
    ) 

    class Meta: 
        model = CourseSession 
        fields = [ 
            'id', 'course', 'batch', 'semester',
            'instructor', 'course_name', 
            'batch_name', 'semester_name', 'instructor_name', 
            'is_active', 'assessment_status', 'created_at' 
        ] 
        read_only_fields = ['id', 'created_at'] 


class CurriculumVersionSerializer( 
    serializers.ModelSerializer 
): 
    batch_name = serializers.CharField( 
        source='batch.name', read_only=True 
    ) 

    class Meta: 
        model = CurriculumVersion 
        fields = [ 
            'id', 'batch', 
            'batch_name', 'version_no', 
            'status', 'is_active', 'created_at' 
        ] 
        read_only_fields = ['id', 'created_at'] 
