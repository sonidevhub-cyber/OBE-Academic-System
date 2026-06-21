
from decimal import Decimal
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('obe', '0005_coursegascore_gacqirecord_gacqiresubmissionhistory_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='StudentCLOScore',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('attainment', models.DecimalField(decimal_places=2, max_digits=5)),
                ('calculated_at', models.DateTimeField(auto_now_add=True)),
                ('clo', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='student_scores', to='obe.clo')),
                ('course_session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='student_clo_scores', to='obe.coursesession')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='clo_scores', to='students.student')),
            ],
        ),
        migrations.AlterUniqueTogether(
            name='studentcloscore',
            unique_together={('student', 'clo', 'course_session')},
        ),
        migrations.AddField(
            model_name='coursegascore',
            name='enrolled_students',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='coursegascore',
            name='locked',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='gacqirecord',
            name='hod_comment',
            field=models.TextField(blank=True, null=True),
        ),
    ]

