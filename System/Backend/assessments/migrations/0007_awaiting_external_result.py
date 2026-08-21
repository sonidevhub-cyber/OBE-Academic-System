from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('assessments', '0006_cqi_hod_comment'),
    ]

    operations = [
        migrations.AddField(
            model_name='assessment',
            name='is_locked',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='cloattainment',
            name='is_locked',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='cloattainment',
            name='report_status',
            field=models.CharField(
                choices=[('PROVISIONAL', 'Provisional'), ('FINAL', 'Final')],
                default='FINAL',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='assessment',
            name='assessment_type',
            field=models.CharField(
                choices=[
                    ('quiz', 'Quiz'),
                    ('assignment', 'Assignment'),
                    ('presentation', 'Presentation'),
                    ('midterm', 'Midterm'),
                    ('sessional', 'Sessional'),
                    ('final', 'Final'),
                ],
                max_length=20,
            ),
        ),
    ]
