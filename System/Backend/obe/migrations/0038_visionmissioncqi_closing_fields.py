from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('core', '0022_add_freeze_promotion_status'),
        ('obe', '0037_gacqirecord_action_taken_description_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='visionmissioncqi',
            name='action_taken_description',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='visionmissioncqi',
            name='closed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='visionmissioncqi',
            name='closed_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='closed_vision_mission_cqi_records', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='visionmissioncqi',
            name='implemented_in_batch',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='closed_vision_mission_cqi_records', to='core.batch'),
        ),
        migrations.AddField(
            model_name='visionmissioncqi',
            name='is_locked',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='visionmissioncqi',
            name='resulting_attainment',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True),
        ),
        migrations.AddField(
            model_name='visionmissioncqi',
            name='status',
            field=models.CharField(choices=[('OPEN', 'Open'), ('CLOSED_IMPLEMENTED', 'Closed Implemented')], default='OPEN', max_length=30),
        ),
    ]
