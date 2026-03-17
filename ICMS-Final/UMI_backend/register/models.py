from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    role = models.CharField(
        max_length=20,
        choices=[
            ("student", "Student"),
            ("instructor", "Instructor"),
            ("coordinator", "Coordinator"),
            ("admin", "Admin"),
            ("hod", "HOD"),
            ("super_admin", "Super Admin"),
            ("principal", "Principal")
        ],
        default="student"
    )
    # Multi-role support - JSON field to store multiple roles
    roles = models.JSONField(default=list, blank=True)
    # Current active role
    active_role = models.CharField(max_length=20, null=True, blank=True)
    
    # full name store karne ke liye ek extra field
    name = models.CharField(max_length=100, null=True, blank=True)
    # profile image field
    profile_image = models.ImageField(upload_to='uploads/admin_images/', null=True, blank=True)
    # Temporary field to match database
    is_coordinator = models.BooleanField(default=False)
    # System-generated employee identifier for staff/admin roles
    employee_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    
    def add_role(self, role):
        """Add a role to user's roles list"""
        if role not in self.roles:
            self.roles.append(role)
            self.save()
    
    def remove_role(self, role):
        """Remove a role from user's roles list"""
        if role in self.roles:
            self.roles.remove(role)
            if self.active_role == role:
                self.active_role = self.roles[0] if self.roles else self.role
            self.save()
    
    def has_role(self, role):
        """Check if user has a specific role"""
        return role in self.roles or self.role == role
    
    def get_current_role(self):
        """Get current active role"""
        return self.active_role or self.role

    def get_permission_codes(self):
        """Return effective RBAC permission codes for this user."""
        try:
            from rbac.services import get_user_permission_codes
            return get_user_permission_codes(self)
        except Exception:
            return []

    def has_permission(self, permission_code: str) -> bool:
        """RBAC permission check used by APIs."""
        try:
            from rbac.services import user_has_permission
            return user_has_permission(self, permission_code)
        except Exception:
            return False
    
    @property
    def effective_role(self):
        """Get the role that should be used for permissions"""
        return self.active_role or self.role

    def __str__(self):
        return self.username
    
    def save(self, *args, **kwargs):
        # If this user is a Django superuser, ensure they have super_admin role and flags
        if getattr(self, 'is_superuser', False):
            self.role = 'super_admin'
            self.active_role = 'super_admin'
            self.is_staff = True

        # Ensure primary role is in roles list
        if self.role and self.role not in self.roles:
            self.roles.append(self.role)
        # Set active role if not set
        if not self.active_role:
            self.active_role = self.role
        
        # Auto-add roles based on profile relationships
        if hasattr(self, 'instructor_profile'):
            if 'instructor' not in self.roles:
                self.roles.append('instructor')
        
        if hasattr(self, 'coordinator_profile'):
            if 'coordinator' not in self.roles:
                self.roles.append('coordinator')
        
        if hasattr(self, 'hod_profile'):
            if 'hod' not in self.roles:
                self.roles.append('hod')

        # Ensure super admin gets SAC employee ID if missing
        if self.role == 'super_admin' and not self.employee_id:
            try:
                from .identifiers import generate_employee_id
                self.employee_id = generate_employee_id(role='super_admin')
                if not self.username:
                    self.username = self.employee_id
            except Exception:
                pass

        super().save(*args, **kwargs)


class IdentifierConfig(models.Model):
    """
    Configurable identifier prefixes and sequences.
    Use department-specific rows to override prefixes per department.
    """
    ROLE_CHOICES = [
        ('SAC', 'Super Admin'),
        ('JSC', 'Admin (JSC)'),
        ('PRINCIPAL', 'Principal'),
        ('INSTRUCTOR', 'Instructor'),
        ('HOD', 'HOD'),
        ('COORDINATOR', 'Coordinator'),
        ('STUDENT', 'Student'),
    ]

    role_key = models.CharField(max_length=20, choices=ROLE_CHOICES)
    department = models.ForeignKey(
        "academics.Department", on_delete=models.SET_NULL, null=True, blank=True
    )
    prefix = models.CharField(max_length=20)
    next_sequence = models.IntegerField(default=1)
    padding = models.IntegerField(default=3)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('role_key', 'department')
        ordering = ['role_key']

    def __str__(self):
        dept = self.department.code if self.department else "GLOBAL"
        return f"{self.role_key}:{dept} -> {self.prefix}{self.next_sequence:0{self.padding}d}"
class PrincipalRegistrationRequest(models.Model):
    name = models.CharField(max_length=100)
    username = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255)
    college_name = models.CharField(max_length=150)
    experience = models.CharField(max_length=50)
    contact = models.CharField(max_length=20)

    status = models.CharField(
        max_length=20,
        choices=[
            ("pending", "Pending"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
        ],
        default="pending"
    )

    created_at = models.DateTimeField(auto_now_add=True)    
