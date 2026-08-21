from rest_framework import serializers 
from curriculum.models import CurriculumVersion
from .models import (
    PEO, GA, GAPEOMapping, 
    CLO, CLOGAMapping, 
    CourseSession,
    CourseGAScore,
    GACQIRecord,
    GACQIResubmissionHistory,
    StudentCLOScore,
    ExitSurveyQuestion,
    ExitSurveyCycle,
    ExitSurveyResponse,
    AlumniSurveyQuestion,
    AlumniSurveyCycle,
    AlumniSurveyResponse,
    AlumniSurveySubmission,
    EmployerSurveyCycle,
    EmployerSurveyResponse,
    PEOCQIRecord,
    PEOCQISubmissionHistory,
    SurveyQuestion,
    Vision, Mission, VisionKeyword, MissionKeyword,
    VisionMissionMapping, PEOKeywordMapping,
    VisionMissionCQIRecord,
)
from django.core.exceptions import ValidationError
from django.db.models import Sum
from decimal import Decimal


class PEOSerializer(serializers.ModelSerializer): 
    alumni_survey_question_text = serializers.SerializerMethodField()

    def get_alumni_survey_question_text(self, obj):
        question = obj.alumni_survey_questions.filter(is_active=True).order_by('-created_at').first()
        return question.question_text if question else None

    def create(self, validated_data):
        validated_data.pop('skip_alumni_survey', None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('skip_alumni_survey', None)
        return super().update(instance, validated_data)

    class Meta: 
        model = PEO 
        fields = [ 
            'id', 'program', 'title', 
            'description', 'order_number', 
            'kpi_threshold', 'is_active', 'created_at',
            'alumni_survey_question_text'
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

    def create(self, validated_data):
        # Pop out any extra kwargs that aren't model fields
        validated_data.pop('skip_exit_survey', None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Pop out any extra kwargs that aren't model fields
        validated_data.pop('skip_exit_survey', None)
        return super().update(instance, validated_data) 


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
            'is_active', 'created_at',
            'weight'
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
        
    def get_contributing_courses(self, obj):
        cs_qs = CourseSession.objects.filter(
            batch=obj.batch,
            is_active=True,
            assessment_status='ASSESSMENT_DONE'
        ).select_related('course', 'semester')
        
        courses = []
        for session in cs_qs:
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
        courses.sort(key=lambda x: x['course_ga_score'])
        return courses

    class Meta:
        model = GACQIRecord
        fields = [
            'id', 'ga', 'ga_title', 'ga_code', 'batch', 'batch_name', 'cqi_level', 'semester',
            'attainment_value', 'kpi_threshold_at_trigger',
            'root_cause', 'remedial_plan', 'hod_comment', 'status',
            'submitted_by', 'approved_by', 'is_audit_visible', 'is_locked',
            'created_at', 'updated_at', 'history', 'contributing_courses',
            'issue_statement', 'hod_action_plan', 'triggered_at', 
            'saved_by_hod', 'saved_by_hod_name', 'saved_at',
            'remedy_text', 'closed_by', 'closed_by_name', 'closed_at',
            'implemented_in_batch', 'implemented_in_batch_name',
            'action_taken_description', 'resulting_attainment',
            'is_active'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'history', 'contributing_courses',
            'is_locked', 'triggered_at', 'saved_at', 'saved_by_hod',
            'closed_by', 'closed_at', 'resulting_attainment', 'implemented_in_batch_name'
        ]


class PEOCQISubmissionHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PEOCQISubmissionHistory
        fields = ['id', 'cqi_record', 'root_cause_snapshot', 'remedial_plan_snapshot', 'status_at_time', 'submitted_at']
        read_only_fields = ['id', 'submitted_at']


class PEOCQIRecordSerializer(serializers.ModelSerializer):
    history = PEOCQISubmissionHistorySerializer(many=True, read_only=True)
    peo_title = serializers.CharField(source='peo.title', read_only=True)
    peo_code = serializers.SerializerMethodField()
    batch_name = serializers.CharField(source='batch.name', read_only=True)
    contributing_gas = serializers.SerializerMethodField()
    closed_by_name = serializers.CharField(
        source='closed_by.full_name', read_only=True, allow_null=True
    )
    implemented_in_batch_name = serializers.CharField(
        source='implemented_in_batch.name', read_only=True, allow_null=True
    )

    def get_peo_code(self, obj):
        return f'PEO-{obj.peo.order_number}'
        
    def get_contributing_gas(self, obj):
        mappings = GAPEOMapping.objects.filter(
            peo=obj.peo,
            is_active=True
        ).select_related('ga')
        
        gas = []
        for mapping in mappings:
            from .services import calculate_weighted_ga_score
            ga_result = calculate_weighted_ga_score(mapping.ga, obj.batch)
            if ga_result and ga_result['final_score']:
                gas.append({
                    'ga_id': str(mapping.ga.id),
                    'ga_code': f'GA-{mapping.ga.order_number}',
                    'ga_title': mapping.ga.title,
                    'ga_score': ga_result['final_score'],
                    'weight': float(mapping.weight)
                })
        return gas

    class Meta:
        model = PEOCQIRecord
        fields = [
            'id', 'peo', 'peo_title', 'peo_code', 'batch', 'batch_name',
            'attainment_value', 'kpi_threshold_at_trigger',
            'root_cause', 'remedial_plan', 'status',
            'submitted_by', 'is_locked',
            'created_at', 'updated_at', 'history', 'contributing_gas',
            'implemented_in_batch', 'implemented_in_batch_name',
            'action_taken_description', 'resulting_attainment',
            'closed_by', 'closed_by_name', 'closed_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'history', 'contributing_gas',
            'is_locked', 'resulting_attainment', 'closed_by', 'closed_at',
            'implemented_in_batch_name'
        ]


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


class ExitSurveyQuestionSerializer(serializers.ModelSerializer):
    ga_title = serializers.CharField(source='ga.title', read_only=True)
    ga_description = serializers.CharField(source='ga.description', read_only=True)
    ga_order_number = serializers.IntegerField(source='ga.order_number', read_only=True)
    ga_code = serializers.SerializerMethodField()

    def get_ga_code(self, obj):
        return f"GA-{obj.ga.order_number}"
    
    class Meta:
        model = ExitSurveyQuestion
        fields = ['id', 'ga', 'ga_title', 'ga_description', 'ga_order_number', 'ga_code', 'question_text', 'is_locked', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ExitSurveyCycleSerializer(serializers.ModelSerializer):
    batch_name = serializers.CharField(source='batch.name', read_only=True)
    activated_by_name = serializers.CharField(source='activated_by.full_name', read_only=True, allow_null=True)
    response_count = serializers.SerializerMethodField()
    
    def get_response_count(self, obj):
        return obj.responses.values('student').distinct().count()
    
    class Meta:
        model = ExitSurveyCycle
        fields = ['id', 'batch', 'batch_name', 'status', 'activated_by', 'activated_by_name', 'activated_at', 'closed_at', 'response_count', 'created_at']
        read_only_fields = ['id', 'created_at', 'activated_at', 'closed_at', 'response_count']


class ExitSurveyResponseSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source='question.question_text', read_only=True)
    ga_title = serializers.CharField(source='question.ga.title', read_only=True)
    
    class Meta:
        model = ExitSurveyResponse
        fields = ['id', 'cycle', 'student', 'question', 'question_text', 'ga_title', 'rating_value', 'submitted_at']
        read_only_fields = ['id', 'submitted_at']


class AlumniSurveyQuestionSerializer(serializers.ModelSerializer):
    peo_title = serializers.CharField(source='peo.title', read_only=True)
    peo_description = serializers.CharField(source='peo.description', read_only=True)
    
    class Meta:
        model = AlumniSurveyQuestion
        fields = ['id', 'peo', 'peo_title', 'peo_description', 'question_text', 'is_locked', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class AlumniSurveyCycleSerializer(serializers.ModelSerializer):
    batch_name = serializers.CharField(source='batch.name', read_only=True)
    activated_by_name = serializers.CharField(source='activated_by.full_name', read_only=True, allow_null=True)
    response_count = serializers.SerializerMethodField()
    eligible_alumni_count = serializers.SerializerMethodField()
    response_rate = serializers.SerializerMethodField()
    
    def get_response_count(self, obj):
        submission_count = obj.submissions.filter(is_active=True).values('student').distinct().count()
        if submission_count:
            return submission_count
        return obj.responses.values('student').distinct().count()

    def get_eligible_alumni_count(self, obj):
        from django.contrib.auth import get_user_model
        user_model = get_user_model()
        return user_model.objects.filter(
            batch=obj.batch,
            role__iexact='alumni',
            is_active=True
        ).count()

    def get_response_rate(self, obj):
        eligible = self.get_eligible_alumni_count(obj)
        if not eligible:
            return 0
        return round((self.get_response_count(obj) / eligible) * 100, 2)
    
    class Meta:
        model = AlumniSurveyCycle
        fields = ['id', 'batch', 'batch_name', 'survey_window', 'status', 'due_at', 'response_threshold', 'auto_extension_days', 'auto_extension_count', 'activated_by', 'activated_by_name', 'activated_at', 'closed_at', 'response_count', 'eligible_alumni_count', 'response_rate', 'created_at']
        read_only_fields = ['id', 'created_at', 'activated_at', 'closed_at', 'response_count', 'eligible_alumni_count', 'response_rate']


class AlumniSurveyResponseSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source='question.question_text', read_only=True)
    peo_title = serializers.CharField(source='question.peo.title', read_only=True)
    
    class Meta:
        model = AlumniSurveyResponse
        fields = ['id', 'cycle', 'student', 'question', 'question_text', 'peo_title', 'score', 'submitted_at', 'employment_status', 'organization_name', 'current_designation']
        read_only_fields = ['id', 'submitted_at']


class SurveyQuestionSerializer(serializers.ModelSerializer):
    peo_title = serializers.CharField(source='peo.title', read_only=True, allow_null=True)
    peo_order_number = serializers.IntegerField(source='peo.order_number', read_only=True, allow_null=True)
    peo_id = serializers.PrimaryKeyRelatedField(source='peo', read_only=True, allow_null=True)
    program_id = serializers.PrimaryKeyRelatedField(source='program', read_only=True, allow_null=True)
    is_general = serializers.SerializerMethodField()
    effective_options = serializers.SerializerMethodField()

    def get_is_general(self, obj):
        return not bool(obj.peo_id)

    def get_effective_options(self, obj):
        return list(obj.effective_options())

    class Meta:
        model = SurveyQuestion
        fields = [
            'id', 'survey_type', 'program', 'program_id', 'peo', 'peo_id',
            'peo_title', 'peo_order_number', 'question_text',
            'question_type', 'custom_options', 'effective_options',
            'is_locked',
            'is_active', 'is_general', 'version_snapshot_id', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'program_id', 'peo_id', 'peo_title', 'peo_order_number', 'is_general', 'effective_options', 'version_snapshot_id', 'created_at', 'updated_at']
        extra_kwargs = {
            'program': {'required': False, 'allow_null': True},
            'peo': {'required': False, 'allow_null': True},
            'is_active': {'required': False},
            'is_locked': {'required': False},
            'question_type': {'required': False},
            'custom_options': {'required': False, 'allow_null': True},
        }


class EmployerSurveyCycleSerializer(serializers.ModelSerializer):
    batch_name = serializers.CharField(source='batch.name', read_only=True)
    linked_alumni_cycle_id = serializers.PrimaryKeyRelatedField(source='linked_alumni_cycle', read_only=True, allow_null=True)
    response_count = serializers.SerializerMethodField()
    pending_count = serializers.SerializerMethodField()

    def get_response_count(self, obj):
        return obj.responses.filter(submitted_at__isnull=False).count()

    def get_pending_count(self, obj):
        return obj.responses.filter(submitted_at__isnull=True, token_used_at__isnull=True, is_active=True).count()

    class Meta:
        model = EmployerSurveyCycle
        fields = [
            'id', 'batch', 'batch_name', 'linked_alumni_cycle', 'linked_alumni_cycle_id',
            'survey_window', 'status', 'due_at', 'response_threshold',
            'auto_extension_days', 'auto_extension_count', 'activated_by',
            'activated_at', 'closed_at', 'is_active', 'created_at',
            'response_count', 'pending_count',
        ]
        read_only_fields = [
            'id', 'batch_name', 'linked_alumni_cycle_id', 'activated_by',
            'activated_at', 'closed_at', 'created_at', 'response_count', 'pending_count',
        ]


class EmployerSurveyResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployerSurveyResponse
        fields = [
            'id', 'cycle', 'alumni_survey_submission', 'alumni_student',
            'employer_email', 'employer_contact_name', 'employer_organization',
            'employer_designation', 'employee_name_at_org', 'response_token', 'token_sent_at',
            'token_used_at', 'submitted_at', 'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'response_token', 'token_sent_at', 'token_used_at', 'submitted_at', 'created_at', 'updated_at']


# ========== VISION & MISSION SERIALIZERS ==========

class VisionSerializer(serializers.ModelSerializer):
    department_code = serializers.CharField(source='department.code', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = Vision
        fields = [
            'id', 'department', 'department_code', 'department_name',
            'statement', 'is_active', 'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'department_code', 'department_name', 'created_by', 'created_at', 'updated_at']


class MissionSerializer(serializers.ModelSerializer):
    department_code = serializers.CharField(source='department.code', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = Mission
        fields = [
            'id', 'department', 'department_code', 'department_name',
            'statement', 'is_active', 'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'department_code', 'department_name', 'created_by', 'created_at', 'updated_at']


class VisionKeywordSerializer(serializers.ModelSerializer):
    class Meta:
        model = VisionKeyword
        fields = ['id', 'vision', 'text', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class MissionKeywordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MissionKeyword
        fields = ['id', 'mission', 'text', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class VisionMissionMappingSerializer(serializers.ModelSerializer):
    mission_keyword_text = serializers.CharField(source='mission_keyword.text', read_only=True)
    vision_keyword_text = serializers.CharField(source='vision_keyword.text', read_only=True)

    class Meta:
        model = VisionMissionMapping
        fields = [
            'id', 'mission_keyword', 'mission_keyword_text',
            'vision_keyword', 'vision_keyword_text',
            'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'mission_keyword_text', 'vision_keyword_text', 'created_at']


class PEOKeywordMappingSerializer(serializers.ModelSerializer):
    mission_keyword_text = serializers.CharField(source='mission_keyword.text', read_only=True, allow_null=True)
    vision_keyword_text = serializers.CharField(source='vision_keyword.text', read_only=True, allow_null=True)
    peo_order_number = serializers.IntegerField(source='peo.order_number', read_only=True)
    peo_title = serializers.CharField(source='peo.title', read_only=True, allow_null=True)

    class Meta:
        model = PEOKeywordMapping
        fields = [
            'id', 'peo', 'peo_order_number', 'peo_title',
            'mission_keyword', 'mission_keyword_text',
            'vision_keyword', 'vision_keyword_text',
            'is_active', 'created_at'
        ]
        read_only_fields = [
            'id', 'peo_order_number', 'peo_title',
            'mission_keyword_text', 'vision_keyword_text', 'created_at'
        ]


class VisionMissionCQIRecordSerializer(serializers.ModelSerializer):
    department_code = serializers.CharField(source='department.code', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    reviewed_by_name = serializers.CharField(
        source='reviewed_by.full_name', read_only=True, allow_null=True
    )

    class Meta:
        model = VisionMissionCQIRecord
        fields = [
            'id', 'department', 'department_code', 'department_name',
            'statement_type', 'trigger_type', 'review_date',
            'reviewed_by', 'reviewed_by_name',
            'previous_statement_snapshot', 'decision', 'justification',
            'new_statement', 'status', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'department_code', 'department_name',
            'reviewed_by', 'reviewed_by_name', 'review_date',
            'status', 'created_at', 'updated_at'
        ]

    def validate(self, attrs):
        decision = attrs.get('decision')
        new_statement = attrs.get('new_statement')
        justification = attrs.get('justification')

        if decision == 'REVISED' and not new_statement:
            raise serializers.ValidationError({
                'new_statement': 'new_statement is required when decision is "Revised".'
            })
        if decision == 'RETAINED':
            attrs['new_statement'] = None
        if not justification or not str(justification).strip():
            raise serializers.ValidationError({
                'justification': 'justification is mandatory.'
            })
        return attrs
