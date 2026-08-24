from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0024_merge_20260821_1637'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='admission_type',
            field=models.CharField(
                choices=[
                    ('regular', 'Regular'),
                    ('lateral', 'Lateral Entry'),
                    ('transfer', 'Transfer'),
                ],
                default='regular',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='customuser',
            name='entry_semester',
            field=models.PositiveSmallIntegerField(default=1),
        ),
    ]
