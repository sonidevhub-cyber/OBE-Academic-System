from django.db import models
from django.conf import settings

class Instructor(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='instructor_profile',
        null=True,
        blank=True
    )
    name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=15, blank=True, null=True)
    gender = models.CharField(max_length=20, blank=True, null=True)
    blood_group = models.CharField(max_length=10, blank=True, null=True)
    department = models.CharField(max_length=100)
    department_name = models.CharField(max_length=100, blank=True, null=True)
    employment_type = models.CharField(
        max_length=20, 
        choices=[('PERMANENT', 'Permanent'), ('VISITING', 'Visiting'), ('INTERNEE', 'Internee')],
        default='PERMANENT'
    )
    qualification = models.CharField(max_length=100, blank=True, null=True)
    experience = models.IntegerField(default=0)
    joining_date = models.DateField(null=True, blank=True)
    employee_id = models.CharField(max_length=50, blank=True, null=True)
    designation = models.CharField(max_length=100, default="Lecturer")
    address = models.TextField(blank=True, null=True)
    specialization = models.CharField(max_length=100, blank=True, null=True)
    experience_years = models.IntegerField(default=0)
    hire_date = models.DateField(null=True, blank=True)
    image = models.ImageField(upload_to='instructors/', null=True, blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name