from django.db import models
from register.models import User

class Instructor(models.Model):
    GENDER_CHOICES = (
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    )
    
    BLOOD_GROUP_CHOICES = (
        ('A+', 'A+'),
        ('A-', 'A-'),
        ('B+', 'B+'),
        ('B-', 'B-'),
        ('AB+', 'AB+'),
        ('AB-', 'AB-'),
        ('O+', 'O+'),
        ('O-', 'O-'),
    )
    
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="instructor_profile"
    )
    employee_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    department = models.ForeignKey("academics.Department", on_delete=models.SET_NULL, null=True, blank=True)
    designation = models.CharField(max_length=100, null=True, blank=True)
    hire_date = models.DateField(null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, null=True, blank=True)
    blood_group = models.CharField(max_length=3, choices=BLOOD_GROUP_CHOICES, null=True, blank=True)
    salary = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    specialization = models.CharField(max_length=100)
    address = models.CharField(max_length=200, null=True, blank=True)
    experience_years = models.IntegerField(default=0)
    image = models.ImageField(upload_to="instructors/", null=True, blank=True)
    password = models.CharField(max_length=128, null=True, blank=True)

    # --- AI fields ---
    ai_profile_notes = models.TextField(null=True, blank=True)
    ai_last_generated = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.user.email



