from django.db import migrations, models


def move_repeat_students_to_freeze(apps, schema_editor):
    User = apps.get_model('core', 'CustomUser')
    User.objects.filter(role='student', promotion_status='repeat').update(promotion_status='freeze')


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0021_semester_status'),
    ]

    operations = [
        migrations.AlterField(
            model_name='customuser',
            name='promotion_status',
            field=models.CharField(
                choices=[
                    ('none', 'None'),
                    ('provisional', 'Provisional'),
                    ('confirmed', 'Confirmed'),
                    ('repeat', 'Repeat'),
                    ('freeze', 'Freeze'),
                ],
                default='none',
                max_length=20,
            ),
        ),
        migrations.RunPython(move_repeat_students_to_freeze, migrations.RunPython.noop),
    ]
