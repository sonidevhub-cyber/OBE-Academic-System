from django.db import migrations, models
import django.db.models.deletion
import uuid
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('electives', '0001_initial'),
        ('curriculum', '0004_curriculumcoursehistory'),
    ]

    operations = [
        migrations.CreateModel(
            name='SelectiveGroup',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('group_name', models.CharField(max_length=255)),
                ('semester_no', models.PositiveIntegerField()),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('curriculum_version', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='selective_groups', to='curriculum.curriculumversion')),
                ('semester', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='selective_groups', to='core.semester')),
            ],
            options={
                'ordering': ['-created_at'],
                'unique_together': {('curriculum_version', 'semester', 'group_name', 'is_active')},
            },
        ),
        migrations.CreateModel(
            name='EligibilityRule',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('student_attribute_field', models.CharField(max_length=100)),
                ('student_attribute_value', models.CharField(max_length=255)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('course', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='selective_eligibility_rules', to='core.course')),
                ('selective_group', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='eligibility_rules', to='electives.selectivegroup')),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
    ]
