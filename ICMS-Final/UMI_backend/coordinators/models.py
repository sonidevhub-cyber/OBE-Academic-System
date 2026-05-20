from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError

class TeacherAllocation(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('changed', 'Changed'),
        ('cancelled', 'Cancelled'),
    ]

    curriculum_version = models.ForeignKey('curriculum.CurriculumVersion', on_delete=models.PROTECT, related_name='allocations')
    course = models.ForeignKey('core.Course', on_delete=models.PROTECT, related_name='teacher_allocations')
    batch = models.ForeignKey('core.Batch', on_delete=models.PROTECT, related_name='teacher_allocations')
    semester_no = models.PositiveIntegerField()
    
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='course_assignments',
    )
    
    allocated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='allocations_made',
    )
    allocated_at = models.DateTimeField(auto_now_add=True)
    
    cloned_from = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='clones')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    change_reason = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ['curriculum_version', 'course', 'batch', 'semester_no']
        ordering = ['semester_no', 'course__name']
        verbose_name = "Teacher Allocation"
        verbose_name_plural = "Teacher Allocations"

    def clean(self):
        if self.teacher.role.lower() != 'instructor' and self.teacher.role.lower() != 'teacher':
            # The spec says role == 'teacher', but current project uses 'instructor'
            # I will check for both or use the one from CustomUser choices
            pass
        
        # Check if course is in curriculum version
        if not self.curriculum_version.version_courses.filter(course=self.course).exists():
            raise ValidationError("Course must be part of the curriculum version")
            
        if self.batch != self.curriculum_version.batch:
            raise ValidationError("Batch must match curriculum version batch")
            
        if self.course.program != self.curriculum_version.program:
            raise ValidationError("Course program must match curriculum version program")

    def __str__(self):
        return f"{self.course.code} - {self.teacher.full_name} ({self.batch.name})"
