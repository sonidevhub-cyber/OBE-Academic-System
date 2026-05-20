import uuid 
from django.db import models 
 
 
class PEO(models.Model): 
    id = models.UUIDField( 
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False 
    ) 
    program = models.ForeignKey( 
<<<<<<< HEAD
        'core.Program', 
        on_delete=models.CASCADE, 
        related_name='peos' 
    ) 
    title = models.CharField(max_length=500, null=True, blank=True) 
=======
        'academic_structure.Program', 
        on_delete=models.CASCADE, 
        related_name='peos' 
    ) 
    title = models.CharField(max_length=500) 
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
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
<<<<<<< HEAD
        'core.Program', 
        on_delete=models.CASCADE, 
        related_name='gas' 
    ) 
    title = models.CharField(max_length=500, null=True, blank=True) 
=======
        'academic_structure.Program', 
        on_delete=models.CASCADE, 
        related_name='gas' 
    ) 
    code = models.CharField(max_length=50) 
    title = models.CharField(max_length=500) 

>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
    description = models.TextField( 
        blank=True, null=True 
    ) 
    order_number = models.IntegerField() 
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 
<<<<<<< HEAD
 
    class Meta: 
        unique_together = ('program', 'order_number') 
        ordering = ['order_number'] 
 
    def __str__(self): 
        return f"GA-{self.order_number}: {self.title}" 
=======

    class Meta: 
        unique_together = ('program', 'code') 
        ordering = ['order_number'] 

    def __str__(self): 
        return f"GA-{self.order_number}: {self.title}" 

>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
 
 
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
<<<<<<< HEAD
    BLOOM_LEVELS = [
        ('K1', 'K1 - Remembering'),
        ('K2', 'K2 - Understanding'),
        ('K3', 'K3 - Applying'),
        ('K4', 'K4 - Analyzing'),
        ('K5', 'K5 - Evaluating'),
        ('K6', 'K6 - Creating'),
    ]
=======
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
    id = models.UUIDField( 
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False 
    ) 
    course = models.ForeignKey( 
<<<<<<< HEAD
        'core.Course', 
=======
        'academic_structure.Course', 
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
        on_delete=models.CASCADE, 
        related_name='clos' 
    ) 
    batch = models.ForeignKey( 
<<<<<<< HEAD
        'core.Batch', 
        on_delete=models.CASCADE, 
        related_name='clos' 
    ) 
    title = models.CharField(max_length=500, null=True, blank=True) 
=======
        'academic_structure.Batch', 
        on_delete=models.CASCADE, 
        related_name='clos' 
    ) 
    title = models.CharField(max_length=500) 
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
    description = models.TextField( 
        blank=True, null=True 
    ) 
    order_number = models.IntegerField() 
<<<<<<< HEAD
    bloom_level = models.CharField(
        max_length=10, 
        choices=BLOOM_LEVELS,
        default='K2'
    )
    kpi_target = models.FloatField(default=60.0) 
=======
    kpi_target = models.FloatField() 
    # NO hardcoded value 
    # coordinator sets this e.g. 60.0 
     
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 
 
    class Meta: 
<<<<<<< HEAD
        unique_together = ('course', 'batch', 'order_number') 
=======
        unique_together = ( 
            'course', 'batch', 'order_number' 
        ) 
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
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
<<<<<<< HEAD
        choices=WEIGHT_CHOICES, default=3 
=======
        choices=WEIGHT_CHOICES 
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
    ) 
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 
 
    class Meta: 
        unique_together = ('clo', 'ga') 
 
    def __str__(self): 
<<<<<<< HEAD
        return f"{self.clo} -> {self.ga} ({self.get_weight_display()})" 
 
 
class CourseSession(models.Model): 
=======
        return f"{self.clo} -> {self.ga}" 
 
 
class CourseSession(models.Model): 
    STATUS_CHOICES = [ 
        ('pending', 'Pending'), 
        ('allocated', 'Allocated'), 
        ('completed', 'Completed'), 
    ] 
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
    id = models.UUIDField( 
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False 
    ) 
    course = models.ForeignKey( 
<<<<<<< HEAD
        'core.Course', 
=======
        'academic_structure.Course', 
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
        on_delete=models.CASCADE, 
        related_name='sessions' 
    ) 
    batch = models.ForeignKey( 
<<<<<<< HEAD
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
=======
        'academic_structure.Batch', 
        on_delete=models.CASCADE, 
        related_name='course_sessions' 
    ) 
    instructor = models.ForeignKey( 
        'instructors.Instructor', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='teaching_sessions' 
    ) 
    academic_year = models.CharField( 
        max_length=20 
    ) 
    # e.g. "Fall-2023", "Spring-2024" 
     
    semester_number = models.IntegerField() 
    status = models.CharField( 
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='pending' 
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
    ) 
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 
 
    class Meta: 
<<<<<<< HEAD
        unique_together = ('course', 'batch', 'semester') 
 
    def __str__(self): 
        return f"{self.course} - {self.batch} ({self.instructor})" 
 
 
class CurriculumVersion(models.Model): 
=======
        unique_together = ( 
            'course', 'batch', 'academic_year' 
        ) 
        ordering = ['-academic_year'] 
 
    def __str__(self): 
        return ( 
            f"{self.course} - " 
            f"{self.batch} - " 
            f"{self.academic_year}" 
        ) 
 
 
class CurriculumVersion(models.Model): 
    ACTION_CHOICES = [ 
        ('add', 'Add'), 
        ('remove', 'Remove'), 
    ] 
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
    id = models.UUIDField( 
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False 
    ) 
    batch = models.ForeignKey( 
<<<<<<< HEAD
        'core.Batch', 
        on_delete=models.CASCADE, 
        related_name='curriculum_versions' 
    ) 
    version_number = models.CharField(max_length=50, null=True, blank=True) 
    is_effective = models.BooleanField(default=False) 
=======
        'academic_structure.Batch', 
        on_delete=models.CASCADE, 
        related_name='curriculum_versions' 
    ) 
    course = models.ForeignKey( 
        'academic_structure.Course', 
        on_delete=models.CASCADE, 
        related_name='curriculum_versions' 
    ) 
    action = models.CharField( 
        max_length=10, 
        choices=ACTION_CHOICES 
    ) 
    semester_number = models.IntegerField() 
    note = models.TextField( 
        blank=True, null=True 
    ) 
    is_active = models.BooleanField(default=True) 
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 
 
    class Meta: 
<<<<<<< HEAD
        unique_together = ('batch', 'version_number') 
 
    def __str__(self): 
        return f"{self.batch} - v{self.version_number}" 
=======
        unique_together = ('batch', 'course') 
        ordering = ['-created_at'] 
 
    def __str__(self): 
        return ( 
            f"{self.action}: {self.course} " 
            f"for {self.batch}" 
        ) 
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
