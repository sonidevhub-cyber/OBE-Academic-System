from django.db import models
from django.conf import settings

class Student(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)

    student_id = models.CharField(max_length=20, primary_key=True, unique=True)
    name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=15, blank=True, null=True)
    department = models.ForeignKey(
        "academics.Department", on_delete=models.SET_NULL, null=True, blank=True
    )
    semester = models.ForeignKey(
        "academics.Semester", on_delete=models.SET_NULL, null=True, blank=True
    )
    date_of_birth = models.DateField(null=True, blank=True)
    father_guardian = models.CharField(max_length=100, blank=True, null=True)
    image = models.ImageField(upload_to="student_images/", null=True, blank=True)

    # New fields for detailed form
    first_name = models.CharField(max_length=50, blank=True, null=True)
    last_name = models.CharField(max_length=50, blank=True, null=True)
    password = models.CharField(max_length=128, blank=True, null=True)
    registration_number = models.CharField(max_length=20, blank=True, null=True)
    gender = models.CharField(
        max_length=10,
        choices=[('male', 'Male'), ('female', 'Female'), ('other', 'Other')],
        default='male',
        blank=True,
        null=True
    )
    blood_group = models.CharField(max_length=5, blank=True, null=True)
    guardian_name = models.CharField(max_length=100, blank=True, null=True)
    guardian_contact = models.CharField(max_length=15, blank=True, null=True)
    address = models.TextField(blank=True, null=True)

    batch = models.CharField(max_length=20, blank=True, null=True)  # e.g., "2025-2029"
    enrollment_date = models.DateField(auto_now_add=True)  # Admission date
    gpa = models.FloatField(default=0.0)                   # GPA
    cgpa = models.FloatField(default=0.0)                  # Cumulative GPA
    previous_cgpa = models.FloatField(default=0.0)         # For CGPA tracking
    performance_notes = models.TextField(blank=True, null=True)

    courses = models.ManyToManyField("academics.Course", related_name="students", blank=True)

    def save(self, *args, **kwargs):
        if not self.student_id and self.department:
            # Generate department-based student ID
            dept_code = self.department.code.lower()
            
            # Find the highest existing number for this department
            existing_students = Student.objects.filter(
                student_id__startswith=dept_code
            ).values_list('student_id', flat=True)
            
            max_num = 0
            for student_id in existing_students:
                try:
                    # Extract number from student_id (e.g., 'cs001' -> 1)
                    num_part = student_id[len(dept_code):]
                    num = int(num_part)
                    max_num = max(max_num, num)
                except (ValueError, IndexError):
                    continue
            
            # Generate next ID
            next_num = max_num + 1
            self.student_id = f"{dept_code}{str(next_num).zfill(3)}"
        
        super().save(*args, **kwargs)

    def get_next_semester(self):
        """
        Get the next semester in sequence for the student's department
        """
        if not self.semester or not self.department:
            return None
        try:
            current_num = int(self.semester.name.split()[-1])
            next_num = current_num + 1
            from academics.models import Semester
            return Semester.objects.filter(
                department=self.department,
                name=f"Semester {next_num}"
            ).first()
        except (ValueError, IndexError):
            return None

    def _str_(self):
        return self.name