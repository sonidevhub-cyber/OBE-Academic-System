
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    all_migrations = [
        ("core", "0011_customuser_active_role"),
        ("core", "0012_alter_course_course_type"),
        ("core", "0013_course_parent_course"),
        ("core", "0014_batch_curriculum_version"),
        
        ("academic_structure", "0001_initial"),  # already applied
        ("academic_structure", "0002_semester_course"), # already added
        
        ("academics", "0001_initial"),
        ("academics", "0002_initial"),
        ("academics", "0003_remove_attendanceeditpermission_attendance_and_more"),
        ("academics", "0004_alter_semester_program"),
        ("academics", "0005_course_batch"),
        ("academics", "0006_remove_course_batch"),
        
        ("curriculum", "0001_initial"),
        ("curriculum", "0002_alter_curriculumversion_batch"),
        ("curriculum", "0003_alter_curriculumversion_unique_together_and_more"),
        ("curriculum", "0004_alter_curriculumversion_unique_together_and_more"),
        ("curriculum", "0005_alter_curriculumversion_unique_together"),
        
        ("coordinators", "0001_initial"),
        ("coordinators", "0002_initial"),
        ("coordinators", "0003_alter_teacherallocation_batch"),
        ("coordinators", "0004_alter_teacherallocation_unique_together"),
        
        ("instructors", "0001_initial"),
        ("instructors", "0002_instructor_image"),
        ("instructors", "0003_instructor_address_instructor_department_name_and_more"),
        ("instructors", "0004_instructor_blood_group_instructor_gender"),
        
        ("obe", "0001_initial"),
        ("obe", "0002_ga_kpi_target_performanceindicator_clopimapping"),
        ("obe", "0003_alter_clo_unique_together_clo_curriculum_version_and_more"),
        ("obe", "0004_delete_curriculumversion"),
        
        ("students", "0001_initial"),
        ("students", "0002_student_address_student_blood_group_and_more"),
        ("students", "0003_student_custom_id"),
        ("students", "0004_student_image"),
        
        ("admin_management", "0001_initial"),
        ("admin_management", "0002_initial"),
    ]
    
    for app, name in all_migrations:
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
            print(f"Already in DB: {app}.{name}")
            
print("Done!")
