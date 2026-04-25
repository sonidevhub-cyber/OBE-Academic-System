from __future__ import annotations

import re
from typing import Iterable, Optional, Tuple

from django.apps import apps
from django.db import models, transaction

from .models import IdentifierConfig

_ROLE_KEY_MAP = {
    "super_admin": ("SAC", "SAC"),
    "admin": ("JSC", "JSC"),
    "department_admin": ("JSC", "JSC"),
    "principal": ("PRINCIPAL", "PRN"),
    "instructor": ("INSTRUCTOR", "INS"),
    "hod": ("HOD", "HOD"),
    "coordinator": ("COORDINATOR", "COO"),
    "student": ("STUDENT", "STD"),
}

_EMPLOYEE_ID_MODELS = (
    ("register", "User", "employee_id"),
    ("instructors", "Instructor", "employee_id"),
    ("coordinators", "Coordinator", "employee_id"),
    ("hods", "HOD", "employee_id"),
    ("principal", "Principal", "employee_id"),
)


def _resolve_role_key(role: str) -> Tuple[str, str]:
    key = str(role or "").strip().lower()
    if not key:
        raise ValueError("role is required")
    role_key, default_prefix = _ROLE_KEY_MAP.get(key, (key.upper(), key.upper()))
    return role_key, default_prefix


def _format_identifier(prefix: str, sequence: int, padding: int) -> str:
    if padding and padding > 0:
        return f"{prefix}{sequence:0{padding}d}"
    return f"{prefix}{sequence}"


def _find_max_sequence(prefix: str, model_specs: Iterable[Tuple[str, str, str]]) -> int:
    if not prefix:
        return 0
    pattern = re.compile(rf"^{re.escape(prefix)}(\\d+)$")
    max_seq = 0
    for app_label, model_name, field_name in model_specs:
        try:
            model = apps.get_model(app_label, model_name)
        except Exception:
            continue
        if not model:
            continue
        try:
            qs = model.objects.filter(**{f"{field_name}__startswith": prefix}).values_list(
                field_name, flat=True
            )
        except Exception:
            continue
        for value in qs:
            if not value:
                continue
            match = pattern.match(str(value))
            if not match:
                continue
            try:
                seq = int(match.group(1))
            except ValueError:
                continue
            if seq > max_seq:
                max_seq = seq
    return max_seq


def _get_config(role_key: str, department) -> Optional[IdentifierConfig]:
    qs = IdentifierConfig.objects.select_for_update().filter(
        role_key=role_key, is_active=True
    )
    if department is not None:
        config = qs.filter(department=department).first()
        if config:
            return config
    return qs.filter(department__isnull=True).first()


def generate_employee_id(role: str, department=None) -> str:
    """Generate a unique employee_id using IdentifierConfig if available."""
    role_key, default_prefix = _resolve_role_key(role)

    with transaction.atomic():
        config = _get_config(role_key, department)
        if not config:
            # Initialize a default config if missing to avoid collisions.
            next_sequence = _find_max_sequence(default_prefix, _EMPLOYEE_ID_MODELS) + 1
            target_department = department if department is not None else None
            config = IdentifierConfig.objects.create(
                role_key=role_key,
                department=target_department,
                prefix=default_prefix,
                next_sequence=next_sequence,
                padding=3,
                is_active=True,
            )

        identifier = _format_identifier(config.prefix, config.next_sequence, config.padding)
        config.next_sequence += 1
        config.save(update_fields=["next_sequence"])
        return identifier


def generate_registration_number(student=None, department=None, batch=None) -> str:
    """Generate a registration number for a student."""
    role_key = "STUDENT"

    default_prefix_parts = []
    if batch:
        default_prefix_parts.append(str(batch))
    if department is not None and getattr(department, "code", None):
        default_prefix_parts.append(str(department.code).upper())
    if not default_prefix_parts:
        default_prefix_parts.append("REG")
    default_prefix = "-".join(default_prefix_parts) + "-"

    with transaction.atomic():
        config = _get_config(role_key, department)
        if not config:
            next_sequence = _find_max_sequence(
                default_prefix, [("students", "Student", "registration_number")]
            ) + 1
            target_department = department if department is not None else None
            config = IdentifierConfig.objects.create(
                role_key=role_key,
                department=target_department,
                prefix=default_prefix,
                next_sequence=next_sequence,
                padding=3,
                is_active=True,
            )

        registration_number = _format_identifier(
            config.prefix, config.next_sequence, config.padding
        )
        config.next_sequence += 1
        config.save(update_fields=["next_sequence"])
        return registration_number


def identifier_in_use(
    identifier: str,
    exclude_user_id: Optional[int] = None,
    exclude_student_id: Optional[str] = None,
) -> bool:
    """Check if an identifier is already used across user/student/staff records."""
    value = str(identifier or "").strip()
    if not value:
        return False

    # Check auth users (username or employee_id)
    try:
        user_model = apps.get_model("register", "User")
        if user_model:
            qs = user_model.objects.filter(
                models.Q(username__iexact=value) | models.Q(employee_id__iexact=value)
            )
            if exclude_user_id:
                qs = qs.exclude(id=exclude_user_id)
            if qs.exists():
                return True
    except Exception:
        pass

    # Check students (registration_number or student_id)
    try:
        student_model = apps.get_model("students", "Student")
        if student_model:
            qs = student_model.objects.filter(
                models.Q(registration_number__iexact=value) | models.Q(student_id__iexact=value)
            )
            if exclude_student_id:
                qs = qs.exclude(student_id=exclude_student_id)
            if qs.exists():
                return True
    except Exception:
        pass

    # Check staff profile models by employee_id
    for app_label, model_name, field_name in _EMPLOYEE_ID_MODELS:
        if app_label == "register" and model_name == "User":
            continue
        try:
            model = apps.get_model(app_label, model_name)
            if not model:
                continue
            if model.objects.filter(**{f"{field_name}__iexact": value}).exists():
                return True
        except Exception:
            continue

    return False


__all__ = [
    "generate_employee_id",
    "generate_registration_number",
    "identifier_in_use",
]
