from django.db import models
from django.conf import settings
from register.identifiers import generate_employee_id


class Principal(models.Model):

    STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive"),
        ("retired", "Retired"),
    ]

    # Linked Auth User (Admin will create it)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="principal_profile",
        null=True,
        blank=True
    )

    # ========== Employment Details ==========
    employee_id = models.CharField(
        max_length=50,
        unique=True,
        null=True,
        blank=True
    )

    rank = models.CharField(
        max_length=100,
        null=True,
        blank=True
    )

    department = models.CharField(
        max_length=120,
        null=True,
        blank=True
    )

    # ========== Personal Info ==========
    first_name = models.CharField(
        max_length=120,
        null=True,
        blank=True
    )

    last_name = models.CharField(
        max_length=120,
        null=True,
        blank=True
    )

    gender = models.CharField(
        max_length=20,
        null=True,
        blank=True
    )

    phone = models.CharField(
        max_length=20,
        null=True,
        blank=True
    )

    email = models.EmailField(
        null=True,
        blank=True
    )

    # ========== Dates ==========
    joining_date = models.DateField(
        null=True,
        blank=True
    )

    retirement_date = models.DateField(
        null=True,
        blank=True
    )

    # ========== Status ==========
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="active"
    )

    # Which Admin Created The Record
    created_by_admin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_principals"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    # ========== Profile Picture ==========
    profile_pic = models.ImageField(
        upload_to='principal_profiles/',
        null=True,
        blank=True
    )

    def __str__(self):
        return f"{self.first_name or ''} {self.last_name or ''} ({self.employee_id or 'N/A'})"

    def save(self, *args, **kwargs):
        if not self.employee_id:
            self.employee_id = generate_employee_id('principal')
        if self.user and not self.user.employee_id:
            self.user.employee_id = self.employee_id
            if not self.user.username:
                self.user.username = self.employee_id
            self.user.save(update_fields=['employee_id', 'username'])
        super().save(*args, **kwargs)
