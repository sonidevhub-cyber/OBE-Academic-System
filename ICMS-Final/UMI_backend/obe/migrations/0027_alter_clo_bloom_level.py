# obe/migrations/00XX_alter_clo_bloom_level_and_more.py (auto-generated file mein add karein)

from django.db import migrations


def update_bloom_codes(apps, schema_editor):
    CLO = apps.get_model('obe', 'CLO')
    mapping = {'K1': 'C1', 'K2': 'C2', 'K3': 'C3', 'K4': 'C4', 'K5': 'C5', 'K6': 'C6'}
    for old_code, new_code in mapping.items():
        CLO.objects.filter(bloom_level=old_code).update(bloom_level=new_code)


def reverse_update(apps, schema_editor):
    CLO = apps.get_model('obe', 'CLO')
    mapping = {'C1': 'K1', 'C2': 'K2', 'C3': 'K3', 'C4': 'K4', 'C5': 'K5', 'C6': 'K6'}
    for new_code, old_code in mapping.items():
        CLO.objects.filter(bloom_level=new_code).update(bloom_level=old_code)


class Migration(migrations.Migration):

    dependencies = [
        ('obe', '0026_coursegascore_is_active_studentcloscore_is_active'),
    ]

    operations = [
        # ... yahan auto-generated AlterField operation already hogi ...
        migrations.RunPython(update_bloom_codes, reverse_update),
    ]