from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from core.models.course import Course

# ============================================================
# CURRICULUM VERSION
# ============================================================

class CurriculumVersion(models.Model):

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('finalized', 'Finalized'),
        ('archived', 'Archived'),
    ]

    CURRICULUM_MODE_CHOICES = [
        ('progressive', 'Progressive'),
        ('complete', 'Complete'),
    ]

    program = models.ForeignKey(
        'core.Program',
        on_delete=models.PROTECT,
        related_name='obe_curriculum_versions'
    )

    # IMPORTANT:
    # Batch assignment should come from Batch.curriculum_version.
    # This allows multiple batches to share one curriculum version.
    #
    # DO NOT use CurriculumVersion.batch for the new logic.
    # If this field is already present in your database, we can
    # remove it after checking existing usages.
    
    version_no = models.CharField(
        max_length=20
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )

    curriculum_mode = models.CharField(
        max_length=20,
        choices=CURRICULUM_MODE_CHOICES,
        default='progressive'
    )

    cloned_from = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='clones'
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_curriculums'
    )

    activated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='finalized_curriculums'
    )

    activated_at = models.DateTimeField(
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    # IMPORTANT:
    # This is NOT the batch lock.
    # Archived versions can remain is_active=True because
    # they are needed for audit/history.
    is_active = models.BooleanField(
        default=True
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['program', 'version_no'],
                name='unique_program_curriculum_version'
            )
        ]

        ordering = ['-created_at']

        verbose_name = "Curriculum Version"
        verbose_name_plural = "Curriculum Versions"

    # ========================================================
    # EDITABILITY
    # ========================================================

    def is_editable(self):
        """
        Only draft versions can be edited.

        Finalized:
            Cannot edit directly.
            Clone/branch first.

        Archived:
            Cannot edit.
            Kept for audit/history.
        """
        return self.status == 'draft'

    # ========================================================
    # CLEAN
    # ========================================================

    def clean(self):
        """
        Prevent direct editing of finalized/archived versions.

        A finalized/archived version must not be modified.
        Changes should happen through cloning/branching.
        """

        if self.pk:

            try:
                old_instance = CurriculumVersion.objects.get(
                    pk=self.pk
                )

                # If old version was already finalized/archived
                # and user is trying to save it without changing
                # status, block the edit.
                if (
                    old_instance.status in ['finalized', 'archived']
                    and self.status == old_instance.status
                ):
                    raise ValidationError(
                        "Finalized/Archived curriculum version "
                        "cannot be edited directly. "
                        "Create a new version by cloning."
                    )

            except CurriculumVersion.DoesNotExist:
                pass

    # ========================================================
    # DISPLAY
    # ========================================================

    def __str__(self):

        batches = self.assigned_batches.all()

        batch_names = ", ".join(
            [b.name for b in batches]
        )

        if batch_names:
            return (
                f"{self.program.name} - "
                f"{batch_names} "
                f"({self.version_no})"
            )

        return (
            f"{self.program.name} "
            f"({self.version_no})"
        )


# ============================================================
# CURRICULUM VERSION COURSE
# ============================================================

class CurriculumVersionCourse(models.Model):

    version = models.ForeignKey(
        CurriculumVersion,
        on_delete=models.CASCADE,
        related_name='version_courses'
    )

    course = models.ForeignKey(
        'core.Course',
        on_delete=models.PROTECT,
        related_name='version_assignments'
    )

    semester_no = models.PositiveIntegerField()

    is_active = models.BooleanField(
        default=True
    )

    class Meta:

        constraints = [
            models.UniqueConstraint(
                fields=[
                    'version',
                    'course',
                    'semester_no'
                ],
                name='unique_version_course_semester'
            )
        ]

        ordering = [
            'semester_no',
            'course__name'
        ]

        verbose_name = "Curriculum Version Course"
        verbose_name_plural = "Curriculum Version Courses"

    # ========================================================
    # CLEAN
    # ========================================================

    def clean(self):

        # Course must belong to same program
        if self.course.program_id != self.version.program_id:
            raise ValidationError(
                "Course program must match curriculum version program."
            )

        # Semester cannot exceed program semesters
        if (
            self.semester_no >
            self.version.program.total_semesters
        ):
            raise ValidationError(
                f"Semester number cannot exceed "
                f"program total semesters "
                f"({self.version.program.total_semesters})."
            )

        # Version must be draft
        if not self.version.is_editable():
            raise ValidationError(
                "Finalized/Archived curriculum version "
                "cannot be modified. "
                "Create a new version by cloning."
            )

    def __str__(self):

        return (
            f"{self.version.version_no} - "
            f"{self.course.name} "
            f"(Sem {self.semester_no})"
        )
class CurriculumCourseHistory(models.Model):

    ACTION_CHOICES = [
        ('added', 'Course Added'),
        ('removed', 'Course Removed'),
        ('updated', 'Course Updated'),
        ('semester_changed', 'Semester Changed'),
    ]

    version = models.ForeignKey(
        CurriculumVersion,
        on_delete=models.CASCADE,
        related_name='course_history'
    )

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='curriculum_history'
    )

    action = models.CharField(
        max_length=50,
        choices=ACTION_CHOICES
    )

    old_semester = models.IntegerField(
        null=True,
        blank=True
    )

    new_semester = models.IntegerField(
        null=True,
        blank=True
    )

    old_data = models.JSONField(
        null=True,
        blank=True
    )

    new_data = models.JSONField(
        null=True,
        blank=True
    )

    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    reason = models.TextField(
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return (
            f"{self.course} - "
            f"{self.action}"
        )    