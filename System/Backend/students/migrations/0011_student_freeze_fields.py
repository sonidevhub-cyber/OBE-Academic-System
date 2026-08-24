from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0027_remove_customuser_admission_type_and_more'),
        ('students', '0010_remove_student_admission_type_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='student',
            name='frozen_at_semester',
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='student',
            name='frozen_date',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='student',
            name='is_frozen',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='student',
            name='original_batch',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='original_profile_students',
                to='core.batch',
            ),
        ),
    ]
