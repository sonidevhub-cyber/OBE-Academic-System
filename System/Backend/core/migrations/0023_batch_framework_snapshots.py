from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0022_add_freeze_promotion_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='batch',
            name='peo_snapshot',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='batch',
            name='vision_mission_snapshot',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
