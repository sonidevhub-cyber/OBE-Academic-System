from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0003_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='AttendanceUpdateRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('attendance_date', models.DateField()),
                ('reason', models.TextField()),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected'), ('used', 'Used')], default='pending', max_length=10)),
                ('admin_notes', models.TextField(blank=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('requested_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attendance_update_requests', to='register.user')),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_attendance_update_requests', to='register.user')),
                ('timetable', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attendance_update_requests', to='academics.timetable')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='attendanceupdaterequest',
            index=models.Index(fields=['status', 'attendance_date'], name='attendance_a_status_3fef11_idx'),
        ),
        migrations.AddIndex(
            model_name='attendanceupdaterequest',
            index=models.Index(fields=['requested_by', 'created_at'], name='attendance_a_request_e06ec5_idx'),
        ),
    ]
