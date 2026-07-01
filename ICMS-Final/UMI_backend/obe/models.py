import uuid 
from django.db import models 
from django.core.exceptions import ValidationError
from django.db.models import Sum
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
        is_new = self._state.adding
        original_description = None
        if not is_new:
            original = PEO.objects.filter(id=self.id).first()
            if original:
                original_description = original.description
        
        super().save(*args, **kwargs)
        
        if is_new or (original_description and original_description != self.description):
            AlumniSurveyQuestion.objects.filter(
                peo=self,
                is_active=True
            ).update(is_active=False)
            
            question_text = f"Aap apne current professional role mein is objective ko kis hadd tak achieve kar rahe hain: {self.description}"
            AlumniSurveyQuestion.objects.create(
                peo=self,
                question_text=question_text,
                is_locked=False,
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
    
    responses_qs = AlumniSurveyResponse.objects.filter(
        question__peo_id=peo_id,
        cycle__batch_id=batch_id,
        is_active=True,
        question__is_active=True
    )
    
    if survey_window:
        responses_qs = responses_qs.filter(cycle__survey_window=survey_window)
    
    if responses_qs.exists():
        avg_score = responses_qs.aggregate(avg=models.Avg('score'))['avg']
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
        is_new = self._state.adding
        # Get original description if updating
        original_description = None
        if not is_new:
            original = GA.objects.filter(id=self.id).first()
            if original:
                original_description = original.description
        
        super().save(*args, **kwargs)
        
        # Generate exit survey question if new or description changed
        if is_new or (original_description and original_description != self.description):
            # Deactivate previous active questions for this GA
            ExitSurveyQuestion.objects.filter(
                ga=self,
                is_active=True
            ).update(is_active=False)
            
            # Create new question
            question_text = f"Main is Graduate Attribute mein confident hoon: {self.description}"
            ExitSurveyQuestion.objects.create(
                ga=self,
                question_text=question_text,
                is_locked=False,
                is_active=True
            )
            
            # Unlock the exit survey template
            from django.utils import timezone
            templates = ExitSurveyTemplate.objects.filter(is_locked=True)
            for template in templates:
                template.is_locked = False
                template.version += 1
                template.locked_at = None
                template.save()
                
            # Also unlock all active questions
            ExitSurveyQuestion.objects.filter(is_active=True).update(is_locked=False)


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
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 

    class Meta: 
        unique_together = ('ga', 'peo') 

    def __str__(self): 
        return f"{self.ga} -> {self.peo}" 


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
    clo = models.ForeignKey( 
        CLO, 
        on_delete=models.CASCADE, 
        related_name='ga_mappings' 
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
        unique_together = ('clo', 'ga') 

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
        ('PENDING', 'Pending'),
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
        related_name='ga_cqi_records'
    )
    cqi_level = models.CharField(max_length=30, choices=CQI_LEVEL_CHOICES)
    semester = models.IntegerField(null=True, blank=True)
    attainment_value = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    kpi_threshold_at_trigger = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    root_cause = models.TextField(blank=True, null=True)
    remedial_plan = models.TextField(blank=True, null=True)
    hod_comment = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='PENDING')
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Ensure only one CQI record per (ga, batch, cqi_level, semester) for SEMESTER
        # And one per (ga, batch, cqi_level) for CUMULATIVE
        # Unique constraints are handled via raw SQL in migration 0012
        pass

    def __str__(self):
        return f"{self.ga} - {self.cqi_level} ({self.status})"


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
    direct_score = models.DecimalField(max_digits=5, decimal_places=2)
    indirect_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    final_score = models.DecimalField(max_digits=5, decimal_places=2)
    is_locked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('ga', 'batch')
        ordering = ['-created_at']

    def __str__(self):
        return f"GA Report for {self.ga} - {self.batch}: {self.final_score}"


def get_ga_indirect_score(ga_id, batch_id):
    """
    Returns indirect assessment scores for a given GA and batch.
    Currently only Exit Survey is a source.
    Course Feedback module (Sadia's module) will be added as a second indirect source here later —
    append to source list, do not rewrite this function's structure.
    """
    sources = []
    
    # Source 1: Exit Survey
    exit_responses = ExitSurveyResponse.objects.filter(
        question__ga_id=ga_id,
        student__batch_id=batch_id,
        question__is_active=True
    )
    if exit_responses.exists():
        avg_score = exit_responses.aggregate(avg=models.Avg('rating_value'))['avg']
        normalized_score = (avg_score / 5) * 100 if avg_score else 0
        sources.append({
            'source': 'Exit Survey',
            'score': normalized_score,
            'response_count': exit_responses.count()
        })
    
    # TODO: Source 2: Course Feedback (Sadia's module) - add here later
    # course_feedback_scores = ...
    # sources.append(...)
    
    # Calculate overall average if multiple sources
    overall = None
    if sources:
        overall = sum(s['score'] for s in sources) / len(sources)
    
    return {
        'sources': sources,
        'overall': overall
    }
