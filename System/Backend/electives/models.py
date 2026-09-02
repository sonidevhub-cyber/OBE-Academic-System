import uuid
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.db.models import Q


class SelectiveGroup(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group_name = models.CharField(max_length=255)
    curriculum_version = models.ForeignKey(
        'curriculum.CurriculumVersion',
        on_delete=models.CASCADE,
        related_name='selective_groups',
    )
    semester = models.ForeignKey(
        'core.Semester',
        on_delete=models.CASCADE,
        related_name='selective_groups',
    )
    semester_no = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('curriculum_version', 'semester', 'group_name', 'is_active')

    def __str__(self):
        return f"{self.group_name} (Sem {self.semester.number})"

    def save(self, *args, **kwargs):
        if not self.semester_no and self.semester_id:
            self.semester_no = self.semester.number
        super().save(*args, **kwargs)

    def get_course_count(self):
        from core.models.course import Course
        return Course.objects.filter(
            selective_group=self,
            is_active=True,
        ).count()

    @property
    def has_eligibility_rules(self):
        return self.eligibility_rules.filter(is_active=True).exists()


class EligibilityRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    selective_group = models.ForeignKey(
        SelectiveGroup,
        on_delete=models.CASCADE,
        related_name='eligibility_rules',
    )
    course = models.ForeignKey(
        'core.Course',
        on_delete=models.CASCADE,
        related_name='selective_eligibility_rules',
    )
    student_attribute_field = models.CharField(max_length=100)
    student_attribute_value = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.course.code}: {self.student_attribute_field}={self.student_attribute_value}"

    def clean(self):
        from core.models.course import Course

        if self.course.offering_type != Course.OFFERING_SELECTIVE:
            raise ValidationError({
                'course': 'EligibilityRule can only apply to SELECTIVE courses.'
            })

        if self.course.selective_group_id != self.selective_group_id:
            raise ValidationError({
                'course': 'Course must belong to the same selective_group as this rule.'
            })

        dup_rules = EligibilityRule.objects.filter(
            selective_group=self.selective_group,
            course=self.course,
            student_attribute_field=self.student_attribute_field,
            is_active=True,
        )
        if self.pk:
            dup_rules = dup_rules.exclude(pk=self.pk)
        if dup_rules.exists():
            raise ValidationError({
                'student_attribute_field': (
                    f'Duplicate attribute_field "{self.student_attribute_field}" '
                    f'for course {self.course.code} in this selective group.'
                )
            })

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ElectiveGroup(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group_name = models.CharField(max_length=255)
    batch = models.ForeignKey(
        'core.Batch',
        on_delete=models.CASCADE,
        related_name='elective_groups',
    )
    semester = models.ForeignKey(
        'core.Semester',
        on_delete=models.CASCADE,
        related_name='elective_groups',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('batch', 'semester', 'group_name', 'is_active')

    def __str__(self):
        return f"{self.group_name} ({self.batch.custom_id} - Sem {self.semester.number})"


class ElectiveSelectionWindow(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(
        'core.Batch',
        on_delete=models.CASCADE,
        related_name='elective_windows',
    )
    semester = models.ForeignKey(
        'core.Semester',
        on_delete=models.CASCADE,
        related_name='elective_windows',
    )
    is_open = models.BooleanField(default=False)
    opened_by = models.ForeignKey(
        'core.CustomUser',
        on_delete=models.SET_NULL,
        related_name='opened_elective_windows',
        null=True,
        blank=True,
    )
    opened_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        'core.CustomUser',
        on_delete=models.SET_NULL,
        related_name='closed_elective_windows',
        null=True,
        blank=True,
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    max_electives_allowed = models.IntegerField(default=1)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('batch', 'semester')

    def __str__(self):
        status = "Open" if self.is_open else "Closed"
        return f"{self.batch.custom_id} Sem {self.semester.number} - {status}"


class StudentElectiveEnrollment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        'students.Student',
        on_delete=models.CASCADE,
        related_name='elective_enrollments',
    )
    course = models.ForeignKey(
        'core.Course',
        on_delete=models.CASCADE,
        related_name='student_elective_enrollments',
    )
    semester = models.ForeignKey(
        'core.Semester',
        on_delete=models.CASCADE,
        related_name='student_elective_enrollments',
    )
    batch = models.ForeignKey(
        'core.Batch',
        on_delete=models.CASCADE,
        related_name='student_elective_enrollments',
    )
    enrolled_by = models.ForeignKey(
        'core.CustomUser',
        on_delete=models.SET_NULL,
        related_name='assigned_elective_enrollments',
        null=True,
        blank=True,
    )
    enrolled_at = models.DateTimeField(default=timezone.now)
    is_locked = models.BooleanField(default=False)
    locked_by = models.ForeignKey(
        'core.CustomUser',
        on_delete=models.SET_NULL,
        related_name='locked_elective_enrollments',
        null=True,
        blank=True,
    )
    locked_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-enrolled_at']

    def __str__(self):
        return f"{self.student.custom_id} -> {self.course.code} ({self.batch.custom_id} Sem {self.semester.number})"

    def _check_selective_eligibility(self, course, student, selective_group):
        group_rules = EligibilityRule.objects.filter(
            selective_group=selective_group,
            is_active=True,
        )

        if not group_rules.exists():
            return True

        course_rules = group_rules.filter(course=course)
        if not course_rules.exists():
            return True

        for rule in course_rules:
            field = rule.student_attribute_field
            expected = rule.student_attribute_value

            actual = None
            if hasattr(student, field):
                actual = getattr(student, field)
            elif hasattr(student, 'user') and student.user and hasattr(student.user, field):
                actual = getattr(student.user, field)

            if actual is not None and str(actual) == str(expected):
                return True

        return False

    def clean(self):
        from core.models.course import Course

        if self.is_locked:
            raise ValidationError('Enrollment is locked and cannot be modified.')

        course = self.course

        if course.offering_type == Course.OFFERING_COMPULSORY:
            raise ValidationError({
                'course': 'Compulsory courses must not use StudentElectiveEnrollment.'
            })

        if course.offering_type == Course.OFFERING_SELECTIVE:
            selective_group = course.selective_group
            if selective_group is None:
                raise ValidationError({
                    'course': 'SELECTIVE course must have a selective_group set.'
                })

            qs = StudentElectiveEnrollment.objects.filter(
                student=self.student,
                batch=self.batch,
                semester=self.semester,
                is_active=True,
                course__selective_group=selective_group,
            )
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                existing = qs.select_related('course').first()
                raise ValidationError(
                    f'You may only select one course from {selective_group.group_name}. '
                    f'You already selected {existing.course.name} ({existing.course.code}).'
                )

            if self.enrolled_by_id is None:
                window = ElectiveSelectionWindow.objects.filter(
                    batch=self.batch,
                    semester=self.semester,
                    is_active=True,
                ).first()

                if not window or not window.is_open:
                    raise ValidationError(
                        'Elective selection window is not open for this batch and semester.'
                    )

            if not self._check_selective_eligibility(course, self.student, selective_group):
                raise ValidationError({
                    'course': 'You are not eligible to enroll in this selective course.'
                })

        elif course.offering_type == Course.OFFERING_ELECTIVE:
            window = ElectiveSelectionWindow.objects.filter(
                batch=self.batch,
                semester=self.semester,
                is_active=True,
            ).first()

            if not window or not window.is_open:
                raise ValidationError(
                    'Elective selection window is not open for this batch and semester.'
                )

            group = course.elective_group

            if group is not None:
                qs = StudentElectiveEnrollment.objects.filter(
                    student=self.student,
                    batch=self.batch,
                    semester=self.semester,
                    is_active=True,
                    course__elective_group=group,
                )
                if self.pk:
                    qs = qs.exclude(pk=self.pk)
                if qs.exists():
                    existing = qs.select_related('course').first()
                    raise ValidationError(
                        f'You may only select one course from {group.group_name}. '
                        f'You already selected {existing.course.name} ({existing.course.code}).'
                    )
            else:
                qs = StudentElectiveEnrollment.objects.filter(
                    student=self.student,
                    batch=self.batch,
                    semester=self.semester,
                    is_active=True,
                    course__elective_group__isnull=True,
                    course__offering_type=Course.OFFERING_ELECTIVE,
                )
                if self.pk:
                    qs = qs.exclude(pk=self.pk)
                existing_count = qs.count()
                if existing_count >= window.max_electives_allowed:
                    raise ValidationError(
                        f'You may only select up to {window.max_electives_allowed} open elective(s). '
                        f'You have already selected {existing_count}.'
                    )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
