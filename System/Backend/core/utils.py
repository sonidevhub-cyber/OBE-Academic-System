import random
import string
from django.apps import apps

def generate_custom_id(prefix, role=None, dept_code=None):
    """Generate a sequential custom ID with a prefix and optional department code."""
    User = apps.get_model('core', 'CustomUser')
    
    # Filter by role to get sequential count
    if role:
        count = User.objects.filter(role=role).count() + 1
    else:
        count = User.objects.count() + 1
        
    if dept_code:
        return f"{dept_code.upper()}-{prefix}-{count:03d}"
    return f"{prefix}-{count:03d}"

def get_role_prefix(role):
    mapping = {
        'SAC': 'sac',
        'student': 'stu',
        'instructor': 'ins',
        'hod': 'hod',
        'coordinator': 'cod',
        'alumni': 'alm'
    }
    return mapping.get(role, 'usr')
