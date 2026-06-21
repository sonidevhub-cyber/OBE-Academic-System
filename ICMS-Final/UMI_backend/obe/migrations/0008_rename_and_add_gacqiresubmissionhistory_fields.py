from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('obe', '0007_add_hod_comment_to_gacqirecord'),
    ]

    operations = [
        # Rename reason_snapshot to root_cause_snapshot
        migrations.RenameField(
            model_name='gacqiresubmissionhistory',
            old_name='reason_snapshot',
            new_name='root_cause_snapshot',
        ),
        # Rename remedy_snapshot to remedial_plan_snapshot
        migrations.RenameField(
            model_name='gacqiresubmissionhistory',
            old_name='remedy_snapshot',
            new_name='remedial_plan_snapshot',
        ),
        # Add hod_comment_snapshot
        migrations.AddField(
            model_name='gacqiresubmissionhistory',
            name='hod_comment_snapshot',
            field=models.TextField(blank=True, null=True),
        ),
    ]
