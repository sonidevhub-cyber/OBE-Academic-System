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
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 

    class Meta: 
        unique_together = ('program', 'order_number') 
        ordering = ['order_number'] 

    def __str__(self): 
        return f"PEO-{self.order_number}: {self.title}" 


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
    calculated_at = models.DateTimeField(auto_now_add=True)
    is_stale = models.BooleanField(default=False)

    class Meta:
        unique_together = ('course_session', 'ga')

    def __str__(self):
        return f"{self.course_session.course} - {self.ga}: {self.score}"


class GACQIRecord(models.Model):
    STATUS_CHOICES = [
        ('PENDING_HOD_APPROVAL', 'Pending HOD Approval'),
        ('SENT_BACK', 'Sent Back'),
        ('FULLY_APPROVED', 'Fully Approved'),
    ]
    TRIGGER_TYPE_CHOICES = [
        ('SEMESTER_EARLY_WARNING', 'Semester-End Early Warning'),
        ('PROGRAM_MASTER_CQI', 'Program-Level Master CQI'),
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
    trigger_type = models.CharField(max_length=30, choices=TRIGGER_TYPE_CHOICES)
    affected_course_sessions = models.ManyToManyField(CourseSession, related_name='ga_cqi_records')
    reason = models.TextField(blank=True)
    remedy = models.TextField(blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='PENDING_HOD_APPROVAL')
    hod_rejection_comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.ga} - {self.trigger_type} ({self.status})"


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
    reason_snapshot = models.TextField()
    remedy_snapshot = models.TextField()
    status_at_time = models.CharField(max_length=30)
    submitted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.cqi_record} - {self.submitted_at}" 
