from typing import Optional


def is_department_scoped_admin(user) -> bool:
    return bool(
        user
        and getattr(user, "is_authenticated", False)
        and getattr(user, "role", "") == "admin"
        and not getattr(user, "is_superuser", False)
    )


def get_user_assigned_department_id(user) -> Optional[int]:
    if not user or not getattr(user, "is_authenticated", False):
        return None

    # Prefer explicit admin profile if present.
    try:
        admin_profile = getattr(user, "admin_profile", None)
        if admin_profile and getattr(admin_profile, "department_id", None):
            return int(admin_profile.department_id)
    except Exception:
        pass

    # Legacy fallback: parse from user.last_name format "...|dept_<id>".
    try:
        last_name = str(getattr(user, "last_name", "") or "")
        if "|dept_" in last_name:
            tail = last_name.split("|dept_")[-1]
            digits = "".join(ch for ch in tail if ch.isdigit())
            if digits:
                return int(digits)
    except Exception:
        pass

    return None


def can_access_department(user, department_id: Optional[int]) -> bool:
    if not is_department_scoped_admin(user):
        return True
    assigned = get_user_assigned_department_id(user)
    if assigned is None or department_id is None:
        return False
    return int(assigned) == int(department_id)
