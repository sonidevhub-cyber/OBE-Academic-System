from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ("obe", "0022_gacqirecord_hod_action_plan_gacqirecord_is_active_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="GAMasterCache",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("is_fully_compiled", models.BooleanField(default=False)),
                ("total_courses_expected", models.IntegerField(default=0)),
                ("total_courses_finalized", models.IntegerField(default=0)),
                ("last_updated", models.DateTimeField(auto_now=True)),
                ("is_active", models.BooleanField(default=True)),
                ("needs_recalculation", models.BooleanField(default=False)),
                (
                    "batch",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ga_master_caches",
                        to="core.batch",
                    ),
                ),
            ],
            options={
                "ordering": ["-last_updated"],
                "unique_together": {("batch",)},
            },
        ),
        migrations.AddField(
            model_name="gacqirecord",
            name="needs_recalculation",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="gareport",
            name="needs_recalculation",
            field=models.BooleanField(default=False),
        ),
    ]
