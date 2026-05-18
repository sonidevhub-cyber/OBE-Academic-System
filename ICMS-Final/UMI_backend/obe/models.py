import uuid 
from django.db import models 
 
 
class PEO(models.Model): 
    id = models.UUIDField( 
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False 
    ) 
    program = models.ForeignKey( 
        'academic_structure.Program', 
        on_delete=models.CASCADE, 
        related_name='peos' 
    ) 
    title = models.CharField(max_length=500) 
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
        'academic_structure.Program', 
        on_delete=models.CASCADE, 
        related_name='gas' 
    ) 
    code = models.CharField(max_length=50) 
    title = models.CharField(max_length=500) 

    description = models.TextField( 
        blank=True, null=True 
    ) 
    order_number = models.IntegerField() 
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 

    class Meta: 
        unique_together = ('program', 'code') 
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
    id = models.UUIDField( 
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False 
    ) 
    course = models.ForeignKey( 
        'academic_structure.Course', 
        on_delete=models.CASCADE, 
        related_name='clos' 
    ) 
    batch = models.ForeignKey( 
        'academic_structure.Batch', 
        on_delete=models.CASCADE, 
        related_name='clos' 
    ) 
    title = models.CharField(max_length=500) 
    description = models.TextField( 
        blank=True, null=True 
    ) 
    order_number = models.IntegerField() 
    kpi_target = models.FloatField() 
    # NO hardcoded value 
    # coordinator sets this e.g. 60.0 
     
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 
 
    class Meta: 
        unique_together = ( 
            'course', 'batch', 'order_number' 
        ) 
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
        choices=WEIGHT_CHOICES 
    ) 
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 
 
    class Meta: 
        unique_together = ('clo', 'ga') 
 
    def __str__(self): 
        return f"{self.clo} -> {self.ga}" 
 
 
class CourseSession(models.Model): 
    STATUS_CHOICES = [ 
        ('pending', 'Pending'), 
        ('allocated', 'Allocated'), 
        ('completed', 'Completed'), 
    ] 
    id = models.UUIDField( 
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False 
    ) 
    course = models.ForeignKey( 
        'academic_structure.Course', 
        on_delete=models.CASCADE, 
        related_name='sessions' 
    ) 
    batch = models.ForeignKey( 
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
    ) 
    is_active = models.BooleanField(default=True) 
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 
 
    class Meta: 
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
    id = models.UUIDField( 
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False 
    ) 
    batch = models.ForeignKey( 
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
    created_at = models.DateTimeField( 
        auto_now_add=True 
    ) 
 
    class Meta: 
        unique_together = ('batch', 'course') 
        ordering = ['-created_at'] 
 
    def __str__(self): 
        return ( 
            f"{self.action}: {self.course} " 
            f"for {self.batch}" 
        ) 
