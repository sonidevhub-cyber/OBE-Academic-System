from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('obe', '0008_rename_and_add_gacqiresubmissionhistory_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='gacqiresubmissionhistory',
            name='root_cause_snapshot',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='gacqiresubmissionhistory',
            name='remedial_plan_snapshot',
            field=models.TextField(blank=True, null=True),
        ),
    ]
