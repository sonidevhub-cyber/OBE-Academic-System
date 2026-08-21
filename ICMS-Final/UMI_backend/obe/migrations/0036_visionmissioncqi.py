# Generated manually for Vision/Mission CQI integration

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('core', '0022_add_freeze_promotion_status'),
        ('obe', '0035_mission_missionkeyword_vision_visionkeyword_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='VisionMissionCQI',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('keyword_type', models.CharField(choices=[('MISSION', 'Mission'), ('VISION', 'Vision')], max_length=10)),
                ('attainment_value', models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True)),
                ('kpi_threshold_at_trigger', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ('hod_action_plan', models.TextField(blank=True, default='')),
                ('cqi_action_required', models.BooleanField(default=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('batch', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='vision_mission_cqi_records', to='core.batch')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_vision_mission_cqi_records', to=settings.AUTH_USER_MODEL)),
                ('mission_keyword', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='cqi_records', to='obe.missionkeyword')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_vision_mission_cqi_records', to=settings.AUTH_USER_MODEL)),
                ('vision_keyword', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='cqi_records', to='obe.visionkeyword')),
            ],
            options={
                'ordering': ['keyword_type', 'created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='visionmissioncqi',
            constraint=models.UniqueConstraint(condition=models.Q(('mission_keyword__isnull', False)), fields=('batch', 'mission_keyword'), name='uniq_vm_cqi_batch_mission_keyword'),
        ),
        migrations.AddConstraint(
            model_name='visionmissioncqi',
            constraint=models.UniqueConstraint(condition=models.Q(('vision_keyword__isnull', False)), fields=('batch', 'vision_keyword'), name='uniq_vm_cqi_batch_vision_keyword'),
        ),
    ]
