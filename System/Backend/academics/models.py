from django.conf import settings
from django.db import models
from core.models.batch import Batch # Import Batch model
class Semester(models.Model):
    semester_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    semester_code = models.CharField(max_length=10, unique=True)
    program_old = models.CharField(max_length=100) # Keep for migration if needed
    capacity = models.PositiveIntegerField(default=30)
    # Replaced Department with Program from core
    program = models.ForeignKey('core.Program', on_delete=models.CASCADE, related_name="academics_semesters", null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.semester_code})"

    @property
    def is_base_semester(self):
        """Check if this semester is a base semester (odd numbered)"""
        try:
            semester_num = int(self.name.split()[-1])
            return semester_num % 2 == 1
        except (ValueError, IndexError):
            return False

    @property
    def base_semester(self):
        """Get the base semester for this semester"""
        if self.is_base_semester:
            return self
        try:
            semester_num = int(self.name.split()[-1])
            base_num = semester_num - 1
            base_name = f"Semester {base_num}"
            return Semester.objects.filter(
                program=self.program,
                name=base_name
            ).first()
        except (ValueError, IndexError, Semester.DoesNotExist):
            return None
    
    def get_students(self):
        """Get all students enrolled in this semester"""
        return self.students.filter(is_active=True) if hasattr(self, 'students') else []

# ---------- Course ----------
class Course(models.Model):
    COURSE_TYPE_CHOICES = [
        ('LECTURE', 'Lecture'),
        ('LAB', 'Lab'),
    ]

    course_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=10, unique=True)
    description = models.TextField(blank=True)
    credits = models.PositiveIntegerField(default=3)
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name="courses", null=True, blank=True)
    course_type = models.CharField(max_length=10, choices=COURSE_TYPE_CHOICES, default='LECTURE')
    parent_course = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        related_name='lab_courses',
        null=True,
        blank=True,
    )

    def __str__(self):
        return f"{self.name} ({self.code})"

class StudentAcademicHistory(models.Model):
    history_id = models.BigAutoField(primary_key=True)  # ✔ ONLY ONE PK

    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="academic_history")
    semester = models.ForeignKey("Semester", on_delete=models.CASCADE)

    gpa = models.FloatField()
    cgpa = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ['student', 'semester']

    def __str__(self):
        return f"{self.student.name} - {self.semester.name}"