from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0025_user_lateral_entry_fields'),
        ('students', '0008_alter_student_department'),
    ]

    operations = [
        migrations.AddField(
            model_name='student',
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
            model_name='student',
            name='entry_semester',
            field=models.PositiveSmallIntegerField(default=1),
        ),
        migrations.CreateModel(
            name='CreditTransfer',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('exempted_course_code', models.CharField(max_length=50)),
                ('course_name', models.CharField(max_length=255)),
                ('credited_hours', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('historical_clo_attainment', models.JSONField(blank=True, default=dict)),
                ('is_approved', models.BooleanField(default=True)),
                ('remarks', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'equivalent_course',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='credit_transfer_equivalences',
                        to='core.course',
                    ),
                ),
                (
                    'student',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='credit_transfers',
                        to='students.student',
                    ),
                ),
            ],
            options={
                'ordering': ['student', 'exempted_course_code'],
                'unique_together': {('student', 'exempted_course_code', 'equivalent_course')},
            },
        ),
    ]
