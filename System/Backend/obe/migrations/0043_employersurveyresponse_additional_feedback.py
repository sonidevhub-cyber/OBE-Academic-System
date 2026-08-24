from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('obe', '0042_delete_academicconfig'),
    ]

    operations = [
        migrations.AddField(
            model_name='employersurveyresponse',
            name='additional_feedback',
            field=models.TextField(blank=True, null=True),
        ),
    ]
