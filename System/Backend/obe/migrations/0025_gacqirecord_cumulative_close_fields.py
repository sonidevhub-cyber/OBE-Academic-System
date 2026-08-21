from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('obe', '0024_studentgaentry'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='gacqirecord',
            name='cqi_level',
            field=models.CharField(
                choices=[('CUMULATIVE', 'Program End CQI')],
                default='CUMULATIVE',
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='gacqirecord',
            name='closed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='gacqirecord',
            name='closed_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='closed_ga_cqis',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='gacqirecord',
            name='remedy_text',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='gacqirecord',
            name='status',
            field=models.CharField(
                choices=[
                    ('OPEN', 'Open'),
                    ('CLOSED_IMPLEMENTED', 'Closed / Implemented'),
                    ('NOT_TRIGGERED', 'Not Triggered'),
                    ('PENDING_HOD_INPUT', 'Pending HOD Input'),
                    ('SAVED', 'Saved'),
                    ('EXPORTED', 'Exported'),
                    ('PENDING', 'Pending'),
                    ('SENT_BACK', 'Sent Back'),
                    ('FULLY_APPROVED', 'Fully Approved'),
                ],
                default='NOT_TRIGGERED',
                max_length=30,
            ),
        ),
    ]
