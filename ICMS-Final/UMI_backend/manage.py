#!/usr/bin/env python
import os
import sys

def find_settings_module():
    # If user already set DJANGO_SETTINGS_MODULE, keep it.
    existing = os.environ.get('DJANGO_SETTINGS_MODULE')
    if existing:
        return existing

    # Try to auto-detect a folder that contains settings.py in the current directory.
    for entry in os.listdir('.'):
        if os.path.isdir(entry) and os.path.exists(os.path.join(entry, 'settings.py')):
            return f"{entry}.settings"

    # Fallback placeholder: replace 'ICMS_Final' with your Django project package name if needed.
    return 'ICMS_Final.settings'

def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', find_settings_module())
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and available on your PYTHONPATH? "
            "Activate a virtual environment if required."
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
