from rest_framework import serializers 
from curriculum.models import CurriculumVersion
from .models import (
    PEO, GA, GAPEOMapping, 
    CLO, CLOGAMapping, 
    CourseSession,
    CourseGAScore,
    GACQIRecord,
    GACQIResubmissionHistory,
    StudentCLOScore
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
            'kpi_threshold', 'is_active', 'created_at' 
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
    course_code = serializers.CharField(source='course_session.course.code', read_only=True)

    class Meta:
        model = CourseGAScore
        fields = ['id', 'course_session', 'course_code', 'ga', 'ga_title', 'score', 'enrolled_students', 'calculated_at', 'is_stale']
        read_only_fields = ['id', 'calculated_at']


class GACQIResubmissionHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = GACQIResubmissionHistory
        fields = ['id', 'cqi_record', 'root_cause_snapshot', 'remedial_plan_snapshot', 'hod_comment_snapshot', 'status_at_time', 'submitted_at']
        read_only_fields = ['id', 'submitted_at']


class GACQIRecordSerializer(serializers.ModelSerializer):
    history = GACQIResubmissionHistorySerializer(many=True, read_only=True)
    ga_title = serializers.CharField(source='ga.title', read_only=True)
    ga_code = serializers.SerializerMethodField()
    batch_name = serializers.CharField(source='batch.name', read_only=True)
    contributing_courses = serializers.SerializerMethodField()

    def get_ga_code(self, obj):
        return f'GA-{obj.ga.order_number}'
        
    def get_contributing_courses(self, obj):
        # Get all course sessions for the batch (ASSESSMENT_DONE only)
        cs_qs = CourseSession.objects.filter(
            batch=obj.batch,
            is_active=True,
            assessment_status='ASSESSMENT_DONE'
        ).select_related('course', 'semester')
        
        courses = []
        for session in cs_qs:
            # Get the CourseGAScore for this session and GA
            score = CourseGAScore.objects.filter(
                course_session=session,
                ga=obj.ga
            ).first()
            if score:
                courses.append({
                    'course_code': session.course.code,
                    'course_name': session.course.name,
                    'course_ga_score': float(score.score),
                    'enrolled_students': score.enrolled_students,
                    'semester': session.semester.number if session.semester else None,
                })
                
        # Sort ascending by course_ga_score (so lowest scores come first)
        courses.sort(key=lambda x: x['course_ga_score'])
        return courses
 
    class Meta:
        model = GACQIRecord
        fields = [
            'id', 'ga', 'ga_title', 'ga_code', 'batch', 'batch_name', 'cqi_level', 'semester',
            'attainment_value', 'kpi_threshold_at_trigger',
            'root_cause', 'remedial_plan', 'hod_comment', 'status',
            'submitted_by', 'approved_by', 'is_audit_visible', 'is_locked',
            'created_at', 'updated_at', 'history', 'contributing_courses'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'history', 'contributing_courses', 'is_locked']


class CourseSessionSerializer(
    serializers.ModelSerializer
): 
    course_name = serializers.CharField(
        source='course.name', read_only=True
    ) 
    course_code = serializers.CharField(
        source='course.code', read_only=True
    ) 
    batch_name = serializers.CharField(
        source='batch.name', read_only=True
    ) 
    semester_name = serializers.CharField(
        source='semester.name', read_only=True
    ) 
    semester_number = serializers.IntegerField(
        source='semester.number', read_only=True
    ) 
    instructor_name = serializers.CharField(
        source='instructor.full_name',
        read_only=True
    ) 

    class Meta: 
        model = CourseSession 
        fields = [ 
            'id', 'course', 'batch', 'semester',
            'instructor', 'course_name', 'course_code',
            'batch_name', 'semester_name', 'semester_number', 'instructor_name', 
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


class StudentCLOScoreSerializer(serializers.ModelSerializer):
    clo_code = serializers.SerializerMethodField()

    def get_clo_code(self, obj):
        return f'CLO-{obj.clo.order_number}'

    class Meta:
        model = StudentCLOScore
        fields = ['id', 'student', 'clo', 'clo_code', 'course_session', 'attainment', 'calculated_at']
        read_only_fields = ['id', 'calculated_at'] 
