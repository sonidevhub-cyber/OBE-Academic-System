from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError

class CurriculumVersion(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('archived', 'Archived'),
    ]

    program = models.ForeignKey('core.Program', on_delete=models.PROTECT, related_name='obe_curriculum_versions')
    batch = models.ForeignKey('core.Batch', on_delete=models.PROTECT, related_name='obe_curriculum_versions')
    version_no = models.CharField(max_length=20)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    cloned_from = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='clones')
    
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_curriculums')
    activated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='activated_curriculums')
    activated_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ['program', 'batch']
        ordering = ['-created_at']
        verbose_name = "Curriculum Version"
        verbose_name_plural = "Curriculum Versions"

    def is_editable(self):
        return self.status == 'draft'

    def clean(self):
        if self.pk:
            old_instance = CurriculumVersion.objects.get(pk=self.pk)
            if old_instance.status in ['active', 'archived'] and self.status == old_instance.status:
                # Allow status change from active to archived, but not editing content
                raise ValidationError("Active/Archived version edit nahi ho sakti")

    def __str__(self):
        return f"{self.program.name} - {self.batch.name} ({self.version_no})"

class CurriculumVersionCourse(models.Model):
    version = models.ForeignKey(CurriculumVersion, on_delete=models.CASCADE, related_name='version_courses')
    course = models.ForeignKey('core.Course', on_delete=models.PROTECT, related_name='version_assignments')
    semester_no = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ['version', 'course', 'semester_no']
        ordering = ['semester_no', 'course__name']
        verbose_name = "Curriculum Version Course"
        verbose_name_plural = "Curriculum Version Courses"

    def clean(self):
        if self.course.program != self.version.program:
            raise ValidationError("Course program must match version program")
        if self.semester_no > self.version.program.total_semesters:
            raise ValidationError(f"Semester number cannot exceed program total semesters ({self.version.program.total_semesters})")
        if not self.version.is_editable():
            raise ValidationError("Version must be in draft status to add/edit courses")

    def __str__(self):
        return f"{self.version.version_no} - {self.course.name} (Sem {self.semester_no})"
