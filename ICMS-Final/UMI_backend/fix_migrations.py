
import os
import django
from django.conf import settings

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    # Insert core.0002 to core.0010 (all fake)
    core_migrations = [
        ("core", "0002_program_semester_batch_alter_customuser_batch_and_more"),
        ("core", "0003_program_description"),
        ("core", "0004_batch_custom_id_customuser_custom_id_and_more"),
        ("core", "0005_course_custom_id"),
        ("core", "0006_customuser_designation_customuser_phone_and_more"),
        ("core", "0007_alter_customuser_original_batch"),
        ("core", "0008_populate_custom_ids"),
        ("core", "0009_reformat_custom_ids"),
        ("core", "0010_lower_case_ids"),
    ]
    
    # Insert academic_structure.0002
    academic_migrations = [
        ("academic_structure", "0002_semester_course"),
    ]
    
    for app, name in core_migrations + academic_migrations:
        cursor.execute(
            "SELECT id FROM django_migrations WHERE app = %s AND name = %s",
            [app, name]
        )
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO django_migrations (app, name, applied) VALUES (%s, %s, NOW())",
                [app, name]
            )
            print(f"Inserted fake migration: {app}.{name}")
        else:
            print(f"Migration already exists: {app}.{name}")

print("Done!")
