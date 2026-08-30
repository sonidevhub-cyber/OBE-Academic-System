from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0011_student_freeze_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='student',
            name='middle_name',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
    ]
