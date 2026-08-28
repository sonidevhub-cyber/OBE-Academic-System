import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0025_user_lateral_entry_fields'),
        ('obe', '0040_alter_clogamapping_clo_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='AcademicConfig',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    'obe_lateral_policy',
                    models.CharField(
                        choices=[
                            ('PRO_RATA', 'Exclusion / Pro-Rata'),
                            ('CREDIT_TRANSFER', 'Credit Transfer / Equivalence Mapping'),
                        ],
                        default='PRO_RATA',
                        max_length=20,
                    ),
                ),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'batch',
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='academic_config',
                        to='core.batch',
                    ),
                ),
                (
                    'program',
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='academic_config',
                        to='core.program',
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name='academicconfig',
            constraint=models.CheckConstraint(
                condition=models.Q(program__isnull=False) | models.Q(batch__isnull=False),
                name='academic_config_requires_scope',
            ),
        ),
    ]
