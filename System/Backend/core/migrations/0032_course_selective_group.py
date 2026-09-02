from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('electives', '0002_selective_group_eligibility_rule'),
        ('core', '0031_course_elective_group_course_offering_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='course',
            name='selective_group',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='courses', to='electives.selectivegroup'),
        ),
    ]
