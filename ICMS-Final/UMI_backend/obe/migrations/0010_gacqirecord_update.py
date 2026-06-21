
from django.db import migrations, models
import django.db.models.deletion


def update_gacqirecord(apps, schema_editor):
    """Safely add missing fields, clean duplicates, and update unique constraint."""
    from django.db import connection, transaction
    
    # Get existing columns
    gacqirecord_model = apps.get_model('obe', 'GACQIRecord')
    table_name = gacqirecord_model._meta.db_table
    
    with connection.cursor() as cursor:
        try:
            cursor.execute(f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = %s
            """, [table_name])
            existing_columns = [row[0] for row in cursor.fetchall()]
        except Exception as e:
            print(f"Could not fetch existing columns: {e}")
            return
        
        # Fields to add with their db types
        fields_to_add = [
            ('batch_id', 'uuid REFERENCES core_batch(id) ON DELETE CASCADE'),
            ('cqi_level', 'VARCHAR(30) DEFAULT \'CUMULATIVE\''),
            ('semester', 'INTEGER'),
            ('attainment_value', 'NUMERIC(5,2)'),
            ('kpi_threshold_at_trigger', 'NUMERIC(5,2)'),
            ('root_cause', 'TEXT'),
            ('remedial_plan', 'TEXT'),
            ('submitted_by_id', 'uuid REFERENCES core_customuser(id) ON DELETE SET NULL'),
            ('approved_by_id', 'uuid REFERENCES core_customuser(id) ON DELETE SET NULL'),
            ('is_audit_visible', 'BOOLEAN DEFAULT TRUE'),
            ('is_locked', 'BOOLEAN DEFAULT FALSE'),
        ]
        
        for field_name, field_type in fields_to_add:
            if field_name not in existing_columns:
                try:
                    with transaction.atomic():
                        cursor.execute(f'ALTER TABLE "{table_name}" ADD COLUMN "{field_name}" {field_type}')
                        print(f"Successfully added column {field_name}")
                except Exception as e:
                    print(f"Could not add column {field_name}: {e}")
            else:
                print(f"Column {field_name} already exists, skipping")
        
        # Clean up duplicates: first delete history, then delete the records
        try:
            with transaction.atomic():
                # Step 1: Find all duplicate GACQIRecord ids
                cursor.execute(f"""
                    SELECT id
                    FROM (
                        SELECT 
                            id,
                            row_number() OVER (
                                PARTITION BY ga_id, batch_id, cqi_level 
                                ORDER BY created_at DESC
                            ) AS rnum
                        FROM "{table_name}"
                    ) t
                    WHERE t.rnum > 1
                """)
                duplicate_ids = [row[0] for row in cursor.fetchall()]
                
                if duplicate_ids:
                    # Step 2: Delete associated GACQIResubmissionHistory entries
                    cursor.execute(f"""
                        DELETE FROM "obe_gacqiresubmissionhistory"
                        WHERE cqi_record_id IN %s
                    """, [tuple(duplicate_ids)])
                    print(f"Successfully deleted {len(duplicate_ids)} GACQIResubmissionHistory entries for duplicates")
                    
                    # Step 3: Delete duplicate GACQIRecord entries
                    cursor.execute(f"""
                        DELETE FROM "{table_name}"
                        WHERE id IN %s
                    """, [tuple(duplicate_ids)])
                    print(f"Successfully deleted {len(duplicate_ids)} duplicate GACQIRecord entries")
        except Exception as e:
            print(f"Could not delete duplicates: {e}")
        
        # Update unique constraint: first check if it exists
        try:
            with transaction.atomic():
                cursor.execute(f"""
                    SELECT COUNT(*) 
                    FROM information_schema.table_constraints 
                    WHERE table_name = %s 
                    AND constraint_type = 'UNIQUE'
                    AND constraint_name = 'obe_gacqirecord_ga_id_batch_id_cqi_level_key'
                """, [table_name])
                constraint_exists = cursor.fetchone()[0] > 0
            
                if not constraint_exists:
                    try:
                        cursor.execute(f'ALTER TABLE "{table_name}" ADD CONSTRAINT "obe_gacqirecord_ga_id_batch_id_cqi_level_key" UNIQUE ("ga_id", "batch_id", "cqi_level")')
                        print("Successfully added unique constraint")
                    except Exception as e:
                        print(f"Could not add unique constraint: {e}")
        except Exception as e:
            print(f"Could not check or add unique constraint: {e}")


def noop(apps, schema_editor):
    """No-op for reverse migration"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('obe', '0009_make_snapshots_nullable'),
    ]

    operations = [
        migrations.RunPython(update_gacqirecord, noop),
    ]
