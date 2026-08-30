# Generated manually for batch framework snapshot recovery audit.

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('core', '0027_remove_customuser_admission_type_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='BatchFrameworkSnapshotFillAudit',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('snapshot_field', models.CharField(choices=[('ga', 'GA'), ('peo', 'PO'), ('vision_mission', 'Vision/Mission')], max_length=20)),
                ('filled_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('snapshot_summary', models.JSONField(blank=True, default=dict)),
                ('batch', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='framework_snapshot_fill_audits', to='core.batch')),
                ('filled_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='framework_snapshot_fills', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-filled_at'],
                'unique_together': {('batch', 'snapshot_field')},
            },
        ),
    ]
