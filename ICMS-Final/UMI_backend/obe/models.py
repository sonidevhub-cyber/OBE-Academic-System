import uuid 
from django.db import models 
 
 
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
    kpi_target = models.FloatField(default=60.0) 
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 
 
    class Meta: 
        unique_together = ('program', 'order_number') 
        ordering = ['order_number'] 
 
    def __str__(self): 
        return f"GA-{self.order_number}: {self.title}" 
 
 
class PerformanceIndicator(models.Model): 
    id = models.UUIDField( 
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False 
    ) 
    ga = models.ForeignKey( 
        GA, 
        on_delete=models.CASCADE, 
        related_name='performance_indicators' 
    ) 
    code = models.CharField(max_length=20) 
    description = models.TextField() 
    kpi = models.FloatField(default=60.0) 
    created_at = models.DateTimeField(auto_now_add=True) 
 
    class Meta: 
        ordering = ['code'] 
 
    def __str__(self): 
        return f"PI-{self.code}: {self.ga.title}" 
 
 
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
    batch = models.ForeignKey( 
        'core.Batch', 
        on_delete=models.CASCADE, 
        related_name='clos' 
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
        unique_together = ('course', 'batch', 'order_number') 
        ordering = ['order_number'] 
 
    def __str__(self): 
        return f"CLO-{self.order_number}: {self.title}" 
 
 
class CLOGAMapping(models.Model): 
    WEIGHT_CHOICES = [ 
        (1, 'Low'), 
        (2, 'Medium'), 
        (3, 'High'), 
    ] 
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
    weight = models.IntegerField( 
        choices=WEIGHT_CHOICES, default=3 
    ) 
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 
 
    class Meta: 
        unique_together = ('clo', 'ga') 
 
    def __str__(self): 
        return f"{self.clo} -> {self.ga} ({self.get_weight_display()})" 
 
 
class CLOPIMapping(models.Model): 
    WEIGHT_CHOICES = [ 
        (1, 'Low'), 
        (2, 'Medium'), 
        (3, 'High'), 
    ] 
    id = models.UUIDField( 
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False 
    ) 
    clo = models.ForeignKey( 
        CLO, 
        on_delete=models.CASCADE, 
        related_name='pi_mappings' 
    ) 
    pi = models.ForeignKey( 
        PerformanceIndicator, 
        on_delete=models.CASCADE, 
        related_name='clo_mappings' 
    ) 
    weight = models.IntegerField( 
        choices=WEIGHT_CHOICES, default=3 
    ) 
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 
 
    class Meta: 
        unique_together = ('clo', 'pi') 
 
    def __str__(self): 
        return f"{self.clo} -> {self.pi} ({self.get_weight_display()})" 
 
 
class CourseSession(models.Model): 
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
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 
 
    class Meta: 
        unique_together = ('course', 'batch', 'semester') 
 
    def __str__(self): 
        return f"{self.course} - {self.batch} ({self.instructor})" 
 
 
class CurriculumVersion(models.Model): 
    id = models.UUIDField( 
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False 
    ) 
    batch = models.ForeignKey( 
        'core.Batch', 
        on_delete=models.CASCADE, 
        related_name='curriculum_versions' 
    ) 
    version_number = models.CharField(max_length=50, null=True, blank=True) 
    is_effective = models.BooleanField(default=False) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 
 
    class Meta: 
        unique_together = ('batch', 'version_number') 
 
    def __str__(self): 
        return f"{self.batch} - v{self.version_number}" 
