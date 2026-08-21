from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('obe', '0032_flexible_survey_answer_types'),
    ]

    operations = [
        migrations.AddField(
            model_name='coursesession',
            name='final_submitted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='coursesession',
            name='internal_complete_awaiting_final',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='coursesession',
            name='internals_locked',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='coursegascore',
            name='report_status',
            field=models.CharField(
                choices=[('PROVISIONAL', 'Provisional'), ('FINAL', 'Final')],
                default='FINAL',
                max_length=20,
            ),
        ),
    ]
