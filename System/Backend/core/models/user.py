import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager


"""Custom user model for EduOBE.

This app-based EduOBE build keeps all core academic entities inside `core.models`.
"""


class CustomUserManager(BaseUserManager):
    def create_user(self, email, full_name, password=None, role='student', **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, full_name=full_name, role=role, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, full_name, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'SAC')
        return self.create_user(email, full_name, password, **extra_fields)

from core.utils import generate_custom_id, get_role_prefix

class CustomUser(AbstractBaseUser, PermissionsMixin): 
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False) 
    custom_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    email = models.EmailField(unique=True) 
    full_name = models.CharField(max_length=255) 
     
    # Primary role
    role = models.CharField(
        max_length=20,
        choices=[
            ('SAC', 'SAC'),
            ('hod', 'HOD'),
            ('coordinator', 'Coordinator'),
            ('instructor', 'Instructor'),
            ('student', 'Student'),
            ('alumni', 'Alumni'),
        ]
    )

    # Secondary role — only for faculty
    # Allows one person to be both
    # HOD + Coordinator at same time
    secondary_role = models.CharField(
        max_length=20,
        choices=[
            ('none', 'None'),
            ('hod', 'HOD'),
            ('coordinator', 'Coordinator'),
        ],
        default='none'
    )

    # Currently active role for multi-role users
    active_role = models.CharField(
        max_length=20,
        null=True,
        blank=True
    )
    # Rule: secondary_role only set when
    # role == 'instructor' or role == 'hod'
    # or role == 'coordinator'
    # Designation is stored separately in the designation field
 
    # Program assignment for coordinator 
    # ManyToMany — coordinator can handle 
    # multiple programs 
    programs = models.ManyToManyField(
        'core.Program',
        blank=True,
        related_name='coordinators'
    )
    # Only relevant for role=coordinator 
    # or secondary_role=coordinator 
 
    # Batch assignment for students/alumni 
    batch = models.ForeignKey( 
        'core.Batch',

        null=True, 
        blank=True, 
        on_delete=models.SET_NULL, 
        related_name='students' 
    ) 
    original_batch = models.ForeignKey( 
        'core.Batch', 
        null=True, 
        blank=True, 
        on_delete=models.SET_NULL, 
        related_name='original_students' 
    ) 
 
    # Promotion — students only 
    current_semester = models.IntegerField( 
        null=True, blank=True 
    ) 
    promotion_status = models.CharField(
        max_length=20,
        choices=[
            ('none', 'None'),
            ('provisional', 'Provisional'),
            ('confirmed', 'Confirmed'),
            ('repeat', 'Repeat'),
            ('freeze', 'Freeze'),
        ],
        default='none'
    )
 
    is_active = models.BooleanField(default=True) 
    is_staff = models.BooleanField(default=False) 
    must_change_password = models.BooleanField(default=True) 
    
    # New fields for faculty management
    designation = models.CharField(max_length=100, null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    profile_pic = models.ImageField(upload_to='faculty_pics/', null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True) 
 
    objects = CustomUserManager()

    USERNAME_FIELD = 'email' 
    REQUIRED_FIELDS = ['full_name', 'role']

    def save(self, *args, **kwargs):
        # Generate custom_id if it's missing OR if it's a random UUID string (previous format)
        is_uuid = False
        if self.custom_id:
            try:
                import uuid
                uuid.UUID(self.custom_id)
                is_uuid = True
            except ValueError:
                is_uuid = False

        if not self.custom_id or is_uuid:
            prefix = get_role_prefix(self.role)
            dept_code = None
            
            # Try to get department code for faculty/students
            if self.role in ['instructor', 'hod', 'coordinator']:
                # For faculty, check if they have instructor profile or program assignment
                if hasattr(self, 'instructor_profile') and self.instructor_profile.department:
                    dept_code = self.instructor_profile.department.code
                elif self.programs.exists():
                    dept_code = self.programs.first().code
            elif self.role == 'student' and self.batch:
                dept_code = self.batch.program.code
            
            self.custom_id = generate_custom_id(prefix, role=self.role, dept_code=dept_code)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.email} ({self.custom_id})"
