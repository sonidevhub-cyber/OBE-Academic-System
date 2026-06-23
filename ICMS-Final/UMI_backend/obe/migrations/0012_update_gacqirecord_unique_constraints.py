
from django.db import migrations


def update_constraints(apps, schema_editor):
    """Use raw SQL to create unique partial indexes for GACQIRecord."""
    from django.db import connection
    
    table_name = "obe_gacqirecord"
    
    with connection.cursor() as cursor:
        # Step 1: Drop old unique constraint if it exists
        try:
            cursor.execute(f"""
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_name = %s 
                AND constraint_type = 'UNIQUE'
                AND constraint_name = 'obe_gacqirecord_ga_id_batch_id_cqi_level_key'
            """, [table_name])
            if cursor.fetchone():
                cursor.execute(f'ALTER TABLE "{table_name}" DROP CONSTRAINT "obe_gacqirecord_ga_id_batch_id_cqi_level_key"')
                print("Dropped old unique constraint")
        except Exception as e:
            print(f"Could not drop old constraint: {e}")
        
        # Step 2: Create unique partial indexes (PostgreSQL supports this)
        try:
            # Unique index for SEMESTER level
            cursor.execute(f"""
                CREATE UNIQUE INDEX IF NOT EXISTS "unique_semester_ga_cqi"
                ON "{table_name}" ("ga_id", "batch_id", "cqi_level", "semester")
                WHERE "cqi_level" = 'SEMESTER'
            """)
            print("Created unique_semester_ga_cqi index")
            
            # Unique index for CUMULATIVE level
            cursor.execute(f"""
                CREATE UNIQUE INDEX IF NOT EXISTS "unique_cumulative_ga_cqi"
                ON "{table_name}" ("ga_id", "batch_id", "cqi_level")
                WHERE "cqi_level" = 'CUMULATIVE'
            """)
            print("Created unique_cumulative_ga_cqi index")
        except Exception as e:
            print(f"Could not create indexes: {e}")


class Migration(migrations.Migration):

    dependencies = [
        ('obe', '0011_add_kpi_threshold_to_peo'),
    ]

    operations = [
        migrations.RunPython(update_constraints, migrations.RunPython.noop),
    ]

