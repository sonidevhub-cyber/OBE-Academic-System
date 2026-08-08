from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0020_auto_20260723_2346'),
    ]

    operations = [
        migrations.AddField(
            model_name='semester',
            name='status',
            field=models.CharField(
                choices=[
                    ('ONGOING', 'Ongoing'),
                    ('AWAITING_EXTERNAL_RESULT', 'Awaiting External Result'),
                    ('RESULT_RECEIVED', 'Result Received'),
                    ('FINALIZED', 'Finalized'),
                ],
                default='ONGOING',
                max_length=32,
            ),
        ),
    ]
