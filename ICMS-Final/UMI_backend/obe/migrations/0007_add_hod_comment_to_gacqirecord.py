from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('obe', '0006_add_missing_fields_and_studentcloscore'),
    ]

    operations = [
        migrations.AddField(
            model_name='gacqirecord',
            name='hod_comment',
            field=models.TextField(blank=True, null=True),
        ),
    ]
