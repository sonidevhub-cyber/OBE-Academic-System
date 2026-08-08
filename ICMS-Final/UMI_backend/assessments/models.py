import uuid
from django.db import models
from decimal import Decimal
from students.models import Student


# ✅ ASSESSMENT TYPES
ASSESSMENT_TYPES = [
    ('quiz', 'Quiz'),
    ('assignment', 'Assignment'),
    ('presentation', 'Presentation'),
    ('midterm', 'Midterm'),
    ('final', 'Final'),
]

# ✅ BLOOM LEVELS (STANDARD)
BLOOM_CHOICES = [
    ('K1', 'Remember'),
    ('K2', 'Understand'),
    ('K3', 'Apply'),
    ('K4', 'Analyze'),
    ('K5', 'Evaluate'),
    ('K6', 'Create'),
]

# ✅ STANDARD WEIGHTAGE
WEIGHTAGE_MAP = {
    'quiz': 5,
    'assignment': 5,
    'presentation': 10,
    'midterm': 30,
    'final': 50,
}

INTERNAL_ASSESSMENT_TYPES = {'quiz', 'assignment', 'presentation', 'midterm'}


# 🔥 MAIN ASSESSMENT MODEL
class Assessment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    course = models.ForeignKey('core.Course', on_delete=models.CASCADE, null=True, blank=True)
    batch = models.ForeignKey('core.Batch', on_delete=models.CASCADE,null=True, blank=True)
    semester = models.ForeignKey('core.Semester', on_delete=models.CASCADE ,null=True, blank=True)

    instructor = models.ForeignKey('core.CustomUser', on_delete=models.CASCADE)

    title = models.CharField(max_length=255)
    assessment_type = models.CharField(max_length=20, choices=ASSESSMENT_TYPES)

    total_marks = models.DecimalField(max_digits=6, decimal_places=2)
    weightage = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    assessment_date = models.DateField()

    # 🔥 IMPORTANT (OBE FLOW)
    is_finalized = models.BooleanField(default=False)
    is_locked = models.BooleanField(default=False)
    
    # 🔥 RETAKE SUPPORT
    course_retake = models.ForeignKey('retake.CourseRetake', on_delete=models.CASCADE, null=True, blank=True, related_name='assessments')
    
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        self.weightage = Decimal(WEIGHTAGE_MAP.get(self.assessment_type, 0))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} ({self.assessment_type})"


# 🔥 QUESTIONS (CLO + BLOOM)
class Question(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    assessment = models.ForeignKey(
        Assessment,
        on_delete=models.CASCADE,
        related_name='questions'
    )

    clo = models.ForeignKey('obe.CLO', on_delete=models.CASCADE)

    description = models.TextField()
    bloom_level = models.CharField(max_length=2, choices=BLOOM_CHOICES)

    marks = models.DecimalField(max_digits=6, decimal_places=2)

    def __str__(self):
        return f"{self.clo} - {self.marks}"


# 🔥 CORE OBE MODEL (MOST IMPORTANT)
class StudentQuestionMark(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    student = models.ForeignKey(Student, on_delete=models.CASCADE)

    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='student_marks'
    )

    marks_obtained = models.DecimalField(max_digits=6, decimal_places=2)
    
    # 🔥 RETAKE SUPPORT
    course_retake = models.ForeignKey('retake.CourseRetake', on_delete=models.CASCADE, null=True, blank=True, related_name='student_question_marks')

    class Meta:
        unique_together = ('student', 'question', 'course_retake')

    def __str__(self):
        return f"{self.student} - {self.question}"


# 🔥 STUDENT TOTAL MARKS
class StudentAssessment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='assessments'
    )

    assessment = models.ForeignKey(
        Assessment,
        on_delete=models.CASCADE,
        related_name='student_assessments'
    )

    marks_obtained = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    percentage = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    
    # 🔥 RETAKE SUPPORT
    course_retake = models.ForeignKey('retake.CourseRetake', on_delete=models.CASCADE, null=True, blank=True, related_name='student_assessments')

    def save(self, *args, **kwargs):
        total = self.assessment.total_marks

        if total > 0:
            self.percentage = (self.marks_obtained / total) * 100
        else:
            self.percentage = 0

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student} - {self.assessment}"


# 🔥 RUBRICS SYSTEM (PRESENTATION)
class Rubric(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    assessment = models.ForeignKey(
        Assessment,
        on_delete=models.CASCADE,
        related_name='rubrics'
    )

    title = models.CharField(max_length=255)
    max_score = models.DecimalField(max_digits=5, decimal_places=2)

    def __str__(self):
        return self.title


class StudentRubricScore(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    rubric = models.ForeignKey(Rubric, on_delete=models.CASCADE)

    score = models.DecimalField(max_digits=5, decimal_places=2)


# 🔥 CLO ATTAINMENT (COURSE LEVEL)
class CLOAttainment(models.Model):
    REPORT_STATUS_CHOICES = [
        ('PROVISIONAL', 'Provisional'),
        ('FINAL', 'Final'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    clo = models.ForeignKey('obe.CLO', on_delete=models.CASCADE)

    course = models.ForeignKey('core.Course', on_delete=models.CASCADE, null=True, blank=True)
    batch = models.ForeignKey('core.Batch', on_delete=models.CASCADE)
    semester = models.ForeignKey('core.Semester', on_delete=models.CASCADE)

    attained_percentage = models.DecimalField(max_digits=6, decimal_places=2)

    kpi_target = models.DecimalField(max_digits=5, decimal_places=2, default=60)

    is_achieved = models.BooleanField(default=False)
    is_locked = models.BooleanField(default=False)
    report_status = models.CharField(max_length=20, choices=REPORT_STATUS_CHOICES, default='FINAL')

    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        self.is_achieved = self.attained_percentage >= self.kpi_target
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.clo} → {self.attained_percentage}%"


# 🔥 THRESHOLD (COORDINATOR CONTROL)
class CourseThreshold(models.Model):
    course = models.ForeignKey('core.Course', on_delete=models.CASCADE)
    semester = models.ForeignKey('core.Semester', on_delete=models.CASCADE)

    threshold = models.DecimalField(max_digits=5, decimal_places=2, default=50)

    def __str__(self):
        return f"{self.course} - {self.threshold}%"


# 🔥 FINAL RESULT
class FinalResult(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    course = models.ForeignKey('core.Course', on_delete=models.CASCADE)

    total_percentage = models.DecimalField(max_digits=6, decimal_places=2)

    gpa = models.DecimalField(max_digits=3, decimal_places=2, default=0)

    grade = models.CharField(max_length=5)
    is_pass = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.student} - {self.course} ({self.grade})"

from core.models import CustomUser

class CQI(models.Model):

    course = models.ForeignKey('core.Course', on_delete=models.CASCADE)
    batch = models.ForeignKey('core.Batch', on_delete=models.CASCADE, null=True, blank=True)
    semester = models.ForeignKey('core.Semester', on_delete=models.CASCADE)

    clo = models.ForeignKey('obe.CLO', on_delete=models.CASCADE)
    clo_attainment = models.ForeignKey(
        'assessments.CLOAttainment',
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    reason = models.TextField()
    action_plan = models.TextField()

    instructor = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="cqi_created"
    )

    reviewed_by = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="cqi_reviewed"
    )

    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('approved', 'Approved'),
            ('rejected', 'Rejected'),
        ],
        default='pending'
    )

    coordinator_comment = models.TextField(null=True, blank=True)
    hod_comment = models.TextField(null=True, blank=True)
    show_next_offering = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['course', 'batch', 'semester', 'clo', 'instructor']
