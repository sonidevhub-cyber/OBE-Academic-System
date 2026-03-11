from django.db import models
from register.models import User

class HOD(models.Model):
    GENDER_CHOICES = (
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    )
    
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="hod_profile"
    )
    employee_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    name = models.CharField(max_length=100)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    department = models.ForeignKey("academics.Department", on_delete=models.SET_NULL, null=True, blank=True)
    designation = models.CharField(max_length=100, default='Head of Department')
    hire_date = models.DateField(null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, null=True, blank=True)
    specialization = models.CharField(max_length=100)
    experience_years = models.IntegerField(default=0)
    image = models.ImageField(upload_to="hod_images/", null=True, blank=True)
    is_active = models.BooleanField(default=True)
    retirement_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # HOD can also act as instructor - default is False, enable only when instructor role is explicitly assigned
    can_act_as_instructor = models.BooleanField(default=False)
    instructor_specialization = models.CharField(max_length=100, blank=True)
    instructor_experience_years = models.IntegerField(default=0)

    class Meta:
        verbose_name = "Head of Department"
        verbose_name_plural = "Heads of Department"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.department.name if self.department else 'No Department'}"


class HODRegistrationRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('retired', 'Retired')
    ]

    name = models.CharField(max_length=100)
    email = models.EmailField()
    employee_id = models.CharField(max_length=50)
    phone = models.CharField(max_length=20)
    department = models.ForeignKey('academics.Department', on_delete=models.CASCADE)
    designation = models.CharField(max_length=100, default='HOD')
    experience_years = models.IntegerField(default=0)
    specialization = models.CharField(max_length=100)
    password = models.CharField(max_length=128)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    hod_request_status = models.CharField(max_length=20, choices=[
        ('pending_approval', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('account_created', 'Account Created')
    ], default='pending_approval')
    
    # Additional fields to preserve HOD information when retired
    image = models.ImageField(upload_to="hod_request_images/", null=True, blank=True)
    hire_date = models.DateField(null=True, blank=True)
    retired_date = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    
    class Meta:
        ordering = ['-requested_at']
    
    def __str__(self):
        return f"{self.name} - {self.status}"
    
