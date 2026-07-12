import uuid 
from django.db import models 
from django.core.exceptions import ValidationError
from django.db.models import Sum
from django.utils import timezone
from decimal import Decimal


class PEO(models.Model): 
    id = models.UUIDField( 
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False 
    ) 
    program = models.ForeignKey( 
        'core.Program', 
        on_delete=models.CASCADE, 
        related_name='peos' 
    ) 
    title = models.CharField(max_length=500, null=True, blank=True) 
    description = models.TextField( 
        blank=True, null=True 
    ) 
    order_number = models.IntegerField() 
    kpi_threshold = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('60.00')) 
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    )

    class Meta: 
        unique_together = ('program', 'order_number') 
        ordering = ['order_number']

    def __str__(self): 
        return f"PEO-{self.order_number}: {self.title}"
    
    def save(self, *args, **kwargs):
        skip_alumni_survey = kwargs.pop('skip_alumni_survey', False)
        is_new = self._state.adding
        original_description = None
        if not is_new:
            original = PEO.objects.filter(id=self.id).first()
            if original:
                original_description = original.description
        
        super().save(*args, **kwargs)
        
        if skip_alumni_survey:
            return

        if is_new or (original_description and original_description != self.description):
            AlumniSurveyQuestion.objects.filter(
                peo=self,
                is_active=True
            ).update(is_active=False)
            
            question_text = f"To what extent are you achieving this objective in your current professional role: {self.description}"
            AlumniSurveyQuestion.objects.create(
                peo=self,
                question_text=question_text,
                is_locked=True,
                is_active=True
            )


class AlumniSurveyQuestion(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    peo = models.ForeignKey(
        PEO,
        on_delete=models.CASCADE,
        related_name='alumni_survey_questions'
    )
    question_text = models.TextField()
    is_locked = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Alumni Survey Q for {self.peo}: {self.question_text[:50]}..."


class AlumniSurveyCycle(models.Model):
    SURVEY_WINDOW_CHOICES = [
        ('6_MONTHS', '6 Months Post Graduation'),
        ('1.5_YEARS', '1.5 Years Post Graduation'),
        ('2_YEARS', '2 Years Post Graduation'),
        ('3_YEARS', '3 Years Post Graduation'),
    ]
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('ACTIVE', 'Active'),
        ('CLOSED', 'Closed'),
    ]
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    batch = models.ForeignKey(
        'core.Batch',
        on_delete=models.CASCADE,
        related_name='alumni_survey_cycles'
    )
    survey_window = models.CharField(max_length=20, choices=SURVEY_WINDOW_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    due_at = models.DateTimeField(null=True, blank=True)
    response_threshold = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('50.00'))
    auto_extension_days = models.PositiveIntegerField(default=2)  # Changed from 5 to 2
    auto_extension_count = models.PositiveIntegerField(default=0)
    activated_by = models.ForeignKey(
        'core.CustomUser',
        on_delete=models.SET_NULL,
        related_name='activated_alumni_surveys',
        null=True,
        blank=True
    )
    activated_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Alumni Survey {self.batch} - {self.survey_window} ({self.status})"


class AlumniSurveyResponse(models.Model):
    EMPLOYMENT_STATUS_CHOICES = [
        ('EMPLOYED', 'Employed'),
        ('SELF_EMPLOYED', 'Self-Employed / Entrepreneur'),
        ('HIGHER_STUDIES', 'Higher Studies'),
        ('UNEMPLOYED', 'Unemployed / Looking for job'),
        ('HOUSEWIFE', 'Housewife / Homemaker'),
    ]
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    cycle = models.ForeignKey(
        AlumniSurveyCycle,
        on_delete=models.CASCADE,
        related_name='responses'
    )
    student = models.ForeignKey(
        'students.Student',
        on_delete=models.CASCADE,
        related_name='alumni_survey_responses'
    )
    # Employment status fields (once per student per cycle)
    employment_status = models.CharField(
        max_length=20,
        choices=EMPLOYMENT_STATUS_CHOICES,
        null=True,
        blank=True
    )
    organization_name = models.CharField(max_length=255, null=True, blank=True)
    current_designation = models.CharField(max_length=255, null=True, blank=True)
    # Question and score fields
    question = models.ForeignKey(
        AlumniSurveyQuestion,
        on_delete=models.PROTECT,
        related_name='responses'
    )
    score = models.IntegerField(choices=[(1, '1'), (2, '2'), (3, '3'), (4, '4'), (5, '5')])
    submitted_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('cycle', 'student', 'question')

    def __str__(self):
        return f"{self.student} - {self.question} ({self.score})"


def get_peo_indirect_score(peo_id, batch_id, survey_window=None):
    sources = []
    print("get_peo_indirect_score called with:")
    print(f"  peo_id: {peo_id}")
    print(f"  batch_id: {batch_id}")
    print(f"  survey_window: {survey_window}")
    
    # Check if there are questions for this PEO first
    questions = AlumniSurveyQuestion.objects.filter(peo__id=peo_id, is_active=True)
    print(f"  Found {questions.count()} active questions for this PEO")
    for q in questions:
        print(f"    - Question: {q.id}, PEO: {q.peo.id if q.peo else None}")
    
    responses_qs = AlumniSurveyResponse.objects.filter(
        question__peo__id=peo_id,
        cycle__batch_id=batch_id,
        is_active=True,
        question__is_active=True
    )
    print(f"  Found {responses_qs.count()} responses before survey_window filter")
    
    if survey_window:
        responses_qs = responses_qs.filter(cycle__survey_window=survey_window)
        print(f"  Found {responses_qs.count()} responses after survey_window filter")
    
    if responses_qs.exists():
        avg_score = responses_qs.aggregate(avg=models.Avg('score'))['avg']
        print(f"  avg_score from responses: {avg_score}")
        normalized_score = (avg_score / 5) * 100 if avg_score else 0
        sources.append({
            'source': 'Alumni Survey',
            'survey_window': survey_window,
            'score': normalized_score,
            'response_count': responses_qs.count()
        })
    
    overall = None
    if sources:
        overall = sum(s['score'] for s in sources) / len(sources)
    print(f"  Returning overall: {overall}")
    return {
        'sources': sources,
        'overall': overall
    } 


class GA(models.Model): 
    id = models.UUIDField( 
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False 
    ) 
    program = models.ForeignKey( 
        'core.Program', 
        on_delete=models.CASCADE, 
        related_name='gas' 
    ) 
    title = models.CharField(max_length=500, null=True, blank=True) 
    description = models.TextField( 
        blank=True, null=True 
    ) 
    order_number = models.IntegerField() 
    kpi_threshold = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('60.00')) 
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 

    class Meta: 
        unique_together = ('program', 'order_number') 
        ordering = ['order_number'] 

    def __str__(self): 
        return f"GA-{self.order_number}: {self.title}"

    def save(self, *args, **kwargs):
        skip_exit_survey = kwargs.pop('skip_exit_survey', False)
        is_new = self._state.adding
        # Get original description if updating
        original_description = None
        if not is_new:
            original = GA.objects.filter(id=self.id).first()
            if original:
                original_description = original.description
        
        super().save(*args, **kwargs)
        
        # Generate exit survey question if new or description changed (unless skipped)
        if not skip_exit_survey and (is_new or (original_description and original_description != self.description)):
            # Deactivate previous active questions for this GA
            ExitSurveyQuestion.objects.filter(
                ga=self,
                is_active=True
            ).update(is_active=False)
            
            # Create new question with prefix
            question_text = f"I am confident in {self.description}"
            ExitSurveyQuestion.objects.create(
                ga=self,
                question_text=question_text,
                is_locked=True,  # Lock the question by default
                is_active=True
            )


class GAPEOMapping(models.Model): 
    id = models.UUIDField( 
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False 
    ) 
    ga = models.ForeignKey( 
        GA, 
        on_delete=models.CASCADE, 
        related_name='peo_mappings' 
    ) 
    peo = models.ForeignKey( 
        PEO, 
        on_delete=models.CASCADE, 
        related_name='ga_mappings' 
    ) 
    weight = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00')) 
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 

    class Meta: 
        unique_together = ('ga', 'peo') 

    def clean(self):
        # Check that sum of weights for this PEO (excluding self equals <=100%
        total = GAPEOMapping.objects.filter(
            peo=self.peo,
            is_active=True
        ).exclude(id=self.id).aggregate(Sum('weight'))['weight__sum'] or Decimal('0.00')
        
        if total + self.weight > Decimal('100.00'):
            raise ValidationError(f"Total weight for PEO exceeds 100%")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self): 
        return f"{self.ga} -> {self.peo} ({self.weight}%)" 


class CLO(models.Model): 
    BLOOM_LEVELS = [
        ('K1', 'K1 - Remembering'),
        ('K2', 'K2 - Understanding'),
        ('K3', 'K3 - Applying'),
        ('K4', 'K4 - Analyzing'),
        ('K5', 'K5 - Evaluating'),
        ('K6', 'K6 - Creating'),
    ]
    id = models.UUIDField( 
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False 
    ) 
    course = models.ForeignKey( 
        'core.Course', 
        on_delete=models.CASCADE, 
        related_name='clos' 
    ) 
    curriculum_version = models.ForeignKey( 
        'curriculum.CurriculumVersion', 
        on_delete=models.CASCADE, 
        related_name='clos',
        null=True,
        blank=True
    ) 
    title = models.CharField(max_length=500, null=True, blank=True) 
    description = models.TextField( 
        blank=True, null=True 
    ) 
    order_number = models.IntegerField() 
    bloom_level = models.CharField(
        max_length=10, 
        choices=BLOOM_LEVELS,
        default='K2'
    )
    kpi_target = models.FloatField(default=60.0) 
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 

    class Meta: 
        unique_together = ('course', 'curriculum_version', 'order_number') 
        ordering = ['order_number'] 

    def __str__(self): 
        return f"CLO-{self.order_number}: {self.title}" 


class CLOGAMapping(models.Model): 
    id = models.UUIDField( 
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False 
    ) 
    clo = models.OneToOneField( 
        CLO, 
        on_delete=models.CASCADE, 
        related_name='ga_mapping'
    ) 
    ga = models.ForeignKey( 
        GA, 
        on_delete=models.CASCADE, 
        related_name='clo_mappings' 
    ) 
    weight = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('0.00')) 
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 

    class Meta: 
        pass

    def __str__(self): 
        return f"{self.clo} -> {self.ga} ({self.weight})" 


class CourseSession(models.Model): 
    ASSESSMENT_STATUS_CHOICES = [
        ('IN_PROGRESS', 'In Progress'),
        ('ASSESSMENT_DONE', 'Assessment Done'),
    ]
    id = models.UUIDField( 
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False 
    ) 
    course = models.ForeignKey( 
        'core.Course', 
        on_delete=models.CASCADE, 
        related_name='sessions' 
    ) 
    batch = models.ForeignKey( 
        'core.Batch', 
        on_delete=models.CASCADE, 
        related_name='sessions' 
    ) 
    semester = models.ForeignKey( 
        'core.Semester', 
        on_delete=models.CASCADE, 
        related_name='sessions',
        null=True, blank=True
    ) 
    instructor = models.ForeignKey( 
        'core.CustomUser', 
        on_delete=models.CASCADE, 
        related_name='teaching_sessions',
        null=True, blank=True
    ) 
    assessment_done = models.BooleanField(default=False)
    allow_result_editing = models.BooleanField(default=False)
    locked_at = models.DateTimeField(null=True, blank=True)
    unlocked_by = models.ForeignKey(
        'core.CustomUser', 
        on_delete=models.SET_NULL, 
        related_name='unlocked_sessions',
        null=True, blank=True
    )
    assessment_status = models.CharField(max_length=20, choices=ASSESSMENT_STATUS_CHOICES, default='IN_PROGRESS')
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 

    class Meta: 
        unique_together = ('course', 'batch', 'semester') 

    def __str__(self): 
        return f"{self.course} - {self.batch} ({self.instructor})"
    
    def save(self, *args, **kwargs):
        # Keep assessment_done and assessment_status in sync!
        if self.assessment_done:
            self.assessment_status = "ASSESSMENT_DONE"
        if self.assessment_status == "ASSESSMENT_DONE":
            self.assessment_done = True
        super().save(*args, **kwargs)


class CourseGAScore(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    course_session = models.ForeignKey(
        CourseSession,
        on_delete=models.CASCADE,
        related_name='ga_scores'
    )
    ga = models.ForeignKey(
        GA,
        on_delete=models.CASCADE,
        related_name='course_scores'
    )
    score = models.DecimalField(max_digits=5, decimal_places=2)
    enrolled_students = models.IntegerField(default=0)
    calculated_at = models.DateTimeField(auto_now_add=True)
    is_stale = models.BooleanField(default=False)
    locked = models.BooleanField(default=False)

    class Meta:
        unique_together = ('course_session', 'ga')

    def __str__(self):
        return f"{self.course_session.course} - {self.ga}: {self.score}"


class GACQIRecord(models.Model):
    STATUS_CHOICES = [
        ('NOT_TRIGGERED', 'Not Triggered'),
        ('PENDING_HOD_INPUT', 'Pending HOD Input'),
        ('SAVED', 'Saved'),
        ('EXPORTED', 'Exported'),
        ('PENDING', 'Pending'),  # Keep old status for compatibility
        ('SENT_BACK', 'Sent Back'),
        ('FULLY_APPROVED', 'Fully Approved'),
    ]
    CQI_LEVEL_CHOICES = [
        ('SEMESTER', 'Semester End CQI'),
        ('CUMULATIVE', 'Program End CQI'),
    ]
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    ga = models.ForeignKey(
        GA,
        on_delete=models.PROTECT,
        related_name='cqi_records'
    )
    batch = models.ForeignKey(
        'core.Batch',
        on_delete=models.CASCADE,
        related_name='ga_cqi_records',
        null=True, blank=True
    )
    cqi_level = models.CharField(max_length=30, choices=CQI_LEVEL_CHOICES,default='SEMESTER')
    semester = models.IntegerField(null=True, blank=True)
    attainment_value = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    kpi_threshold_at_trigger = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    root_cause = models.TextField(blank=True, null=True)
    remedial_plan = models.TextField(blank=True, null=True)
    hod_comment = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='NOT_TRIGGERED')
    submitted_by = models.ForeignKey(
        'core.CustomUser',
        on_delete=models.SET_NULL,
        related_name='submitted_ga_cqis',
        null=True,
        blank=True
    )
    approved_by = models.ForeignKey(
        'core.CustomUser',
        on_delete=models.SET_NULL,
        related_name='approved_ga_cqis',
        null=True,
        blank=True
    )
    is_audit_visible = models.BooleanField(default=True)
    is_locked = models.BooleanField(default=False)
    needs_recalculation = models.BooleanField(default=False)
    # NEW fields for GA-CQI Cohort
    issue_statement = models.TextField(blank=True, null=True)
    hod_action_plan = models.TextField(blank=True, null=True)
    triggered_at = models.DateTimeField(null=True, blank=True, auto_now_add=False)
    saved_by_hod = models.ForeignKey(
        'core.CustomUser',
        on_delete=models.SET_NULL,
        related_name='saved_ga_cqis',
        null=True,
        blank=True
    )
    saved_at = models.DateTimeField(null=True, blank=True, auto_now_add=False)
    is_active = models.BooleanField(default=True)  # Soft delete
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Ensure only one CQI record per (ga, batch, cqi_level, semester) for SEMESTER
        # And one per (ga, batch, cqi_level) for CUMULATIVE
        # Unique constraints are handled via raw SQL in migration 0012
        pass

    def __str__(self):
        return f"{self.ga} - {self.cqi_level} ({self.status})"


class PEOCQIRecord(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('APPROVED', 'Approved'),
    ]
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    peo = models.ForeignKey(
        PEO,
        on_delete=models.PROTECT,
        related_name='cqi_records'
    )
    batch = models.ForeignKey(
        'core.Batch',
        on_delete=models.CASCADE,
        related_name='peo_cqi_records'
    )
    attainment_value = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    kpi_threshold_at_trigger = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    root_cause = models.TextField(blank=True, null=True)
    remedial_plan = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='DRAFT')
    submitted_by = models.ForeignKey(
        'core.CustomUser',
        on_delete=models.SET_NULL,
        related_name='submitted_peo_cqis',
        null=True,
        blank=True
    )
    is_locked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('peo', 'batch')

    def __str__(self):
        return f"{self.peo} - {self.batch} ({self.status})"


class PEOCQISubmissionHistory(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    cqi_record = models.ForeignKey(
        PEOCQIRecord,
        on_delete=models.CASCADE,
        related_name='history'
    )
    root_cause_snapshot = models.TextField(blank=True, null=True)
    remedial_plan_snapshot = models.TextField(blank=True, null=True)
    status_at_time = models.CharField(max_length=30)
    submitted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.cqi_record} - {self.submitted_at}"


class StudentCLOScore(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    student = models.ForeignKey(
        'students.Student',
        on_delete=models.CASCADE,
        related_name='clo_scores'
    )
    clo = models.ForeignKey(
        CLO,
        on_delete=models.CASCADE,
        related_name='student_scores'
    )
    course_session = models.ForeignKey(
        CourseSession,
        on_delete=models.CASCADE,
        related_name='student_clo_scores'
    )
    attainment = models.DecimalField(max_digits=5, decimal_places=2)
    calculated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'clo', 'course_session')

    def __str__(self):
        return f"{self.student.user.full_name} - {self.clo}: {self.attainment}"


class GACQIResubmissionHistory(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    cqi_record = models.ForeignKey(
        GACQIRecord,
        on_delete=models.CASCADE,
        related_name='history'
    )
    root_cause_snapshot = models.TextField(blank=True, null=True)
    remedial_plan_snapshot = models.TextField(blank=True, null=True)
    hod_comment_snapshot = models.TextField(blank=True, null=True)
    status_at_time = models.CharField(max_length=30)
    submitted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.cqi_record} - {self.submitted_at}"


class ExitSurveyQuestion(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    ga = models.ForeignKey(
        GA,
        on_delete=models.CASCADE,
        related_name='exit_survey_questions'
    )
    question_text = models.TextField()
    is_active = models.BooleanField(default=True)
    is_locked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Exit Q for {self.ga}: {self.question_text[:50]}..."


class ExitSurveyTemplate(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    is_locked = models.BooleanField(default=False)
    locked_at = models.DateTimeField(null=True, blank=True)
    version = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Exit Survey Template v{self.version} (Locked: {self.is_locked})"


class ExitSurveyCycle(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('ACTIVE', 'Active'),
        ('CLOSED', 'Closed'),
    ]
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    batch = models.ForeignKey(
        'core.Batch',
        on_delete=models.CASCADE,
        related_name='exit_survey_cycles'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    activated_by = models.ForeignKey(
        'core.CustomUser',
        on_delete=models.SET_NULL,
        related_name='activated_exit_surveys',
        null=True,
        blank=True
    )
    activated_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Exit Survey Cycle for {self.batch} - {self.status}"


class ExitSurveyResponse(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    cycle = models.ForeignKey(
        ExitSurveyCycle,
        on_delete=models.CASCADE,
        related_name='responses',
        null=True,
        blank=True
    )
    student = models.ForeignKey(
        'students.Student',
        on_delete=models.CASCADE,
        related_name='exit_survey_responses'
    )
    question = models.ForeignKey(
        ExitSurveyQuestion,
        on_delete=models.PROTECT,
        related_name='responses'
    )
    rating_value = models.IntegerField(choices=[(1, '1'), (2, '2'), (3, '3'), (4, '4'), (5, '5')])
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'question', 'cycle')

    def __str__(self):
        return f"{self.student} - {self.question} ({self.rating_value})"


class GAReport(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    ga = models.ForeignKey(
        GA,
        on_delete=models.CASCADE,
        related_name='reports'
    )
    batch = models.ForeignKey(
        'core.Batch',
        on_delete=models.CASCADE,
        related_name='ga_reports'
    )
    direct_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    indirect_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    course_feedback_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    course_feedback_coverage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    exit_survey_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    exit_survey_coverage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    final_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    formula_applied = models.CharField(max_length=50, null=True, blank=True)
    breakdown = models.JSONField(null=True, blank=True)
    coverage = models.JSONField(null=True, blank=True)
    is_locked = models.BooleanField(default=False)
    needs_recalculation = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('ga', 'batch')
        ordering = ['-created_at']

    def __str__(self):
        return f"GA Report for {self.ga} - {self.batch}: {self.final_score}"


class CourseFeedbackGAScore(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    course = models.ForeignKey(
        'core.Course',
        on_delete=models.CASCADE,
        related_name='cf_ga_scores'
    )
    ga = models.ForeignKey(
        GA,
        on_delete=models.CASCADE,
        related_name='cf_scores'
    )
    batch = models.ForeignKey(
        'core.Batch',
        on_delete=models.CASCADE,
        related_name='cf_ga_scores'
    )
    score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    coverage_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    respondent_count = models.IntegerField(default=0)
    total_eligible = models.IntegerField(default=0)
    is_locked = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    calculated_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('course', 'ga', 'batch')
        ordering = ['-created_at']

    def __str__(self):
        return f"CF GA Score: {self.course} - {self.ga} - {self.batch}: {self.score}"


class ExitSurveyGAScore(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    ga = models.ForeignKey(
        GA,
        on_delete=models.CASCADE,
        related_name='exit_survey_scores'
    )
    batch = models.ForeignKey(
        'core.Batch',
        on_delete=models.CASCADE,
        related_name='exit_survey_ga_scores'
    )
    score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    coverage_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    respondent_count = models.IntegerField(default=0)
    total_eligible = models.IntegerField(default=0)
    is_locked = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    calculated_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('ga', 'batch')
        ordering = ['-created_at']

    def __str__(self):
        return f"Exit Survey GA Score: {self.ga} - {self.batch}: {self.score}"


class GAMasterCache(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    batch = models.ForeignKey(
        'core.Batch',
        on_delete=models.CASCADE,
        related_name='ga_master_caches'
    )
    is_fully_compiled = models.BooleanField(default=False)
    total_courses_expected = models.IntegerField(default=0)
    total_courses_finalized = models.IntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    needs_recalculation = models.BooleanField(default=False)

    class Meta:
        unique_together = ('batch',)
        ordering = ['-last_updated']

    def __str__(self):
        return f"GA Master: {self.batch}"


class StudentGAEntry(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    master_cache = models.ForeignKey(
        GAMasterCache,
        on_delete=models.CASCADE,
        related_name='student_entries'
    )
    student = models.ForeignKey(
        'students.Student',
        on_delete=models.CASCADE,
        related_name='ga_entries'
    )
    ga = models.ForeignKey(
        GA,
        on_delete=models.CASCADE,
        related_name='student_entries'
    )
    ga_score = models.DecimalField(max_digits=5, decimal_places=2)
    is_kpi_achieved = models.BooleanField()
    finalized_at = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('master_cache', 'student', 'ga')
        ordering = ['finalized_at']

    def __str__(self):
        return f"{self.student} - {self.ga}: {self.ga_score}%"


# Weight constants
W_DIRECT = Decimal('0.80')
W_CF = Decimal('0.15')
W_EXIT = Decimal('0.05')


def get_ga_indirect_score(ga_id, batch_id):
    """
    Returns indirect assessment scores for a given GA and batch.
    Sources:
    - Course Feedback
    - Exit Survey
    """
    sources = []
    
    # Source 1: Course Feedback
    cf_scores = CourseFeedbackGAScore.objects.filter(
        ga_id=ga_id,
        batch_id=batch_id,
        is_active=True,
        score__isnull=False
    )
    if cf_scores.exists():
        cf_aggregate = cf_scores.aggregate(
            avg_score=models.Avg('score'),
            avg_coverage=models.Avg('coverage_percent'),
            total_respondents=models.Sum('respondent_count')
        )
        sources.append({
            'source': 'Course Feedback',
            'score': float(cf_aggregate['avg_score']) if cf_aggregate['avg_score'] is not None else None,
            'coverage': float(cf_aggregate['avg_coverage']) if cf_aggregate['avg_coverage'] is not None else None,
            'response_count': cf_aggregate['total_respondents'] or 0
        })
    
    # Source 2: Exit Survey
    exit_score = ExitSurveyGAScore.objects.filter(
        ga_id=ga_id,
        batch_id=batch_id,
        is_active=True,
        score__isnull=False
    )
    if exit_score.exists():
        exit_aggregate = exit_score.aggregate(
            avg_score=models.Avg('score'),
            avg_coverage=models.Avg('coverage_percent'),
            total_respondents=models.Sum('respondent_count')
        )
        sources.append({
            'source': 'Exit Survey',
            'score': float(exit_aggregate['avg_score']) if exit_aggregate['avg_score'] is not None else None,
            'coverage': float(exit_aggregate['avg_coverage']) if exit_aggregate['avg_coverage'] is not None else None,
            'response_count': exit_aggregate['total_respondents'] or 0
        })
    
    # Calculate overall average if multiple sources
    overall = None
    if sources:
        overall = sum(s['score'] for s in sources) / len(sources)
    
    return {
        'sources': sources,
        'overall': overall
    }
