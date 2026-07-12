from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ("students", "0007_student_is_late_submitter"),
        ("retake", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ReportInvalidationLog",
            fields=[
                (
                    "id",
                    models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False),
                ),
                ("affected_student_report", models.BooleanField(default=False)),
                ("affected_batch_report", models.BooleanField(default=False)),
                ("triggered_at", models.DateTimeField(auto_now_add=True)),
                ("resolved_at", models.DateTimeField(blank=True, null=True)),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="report_invalidation_logs",
                        to="students.student",
                    ),
                ),
                (
                    "triggered_by_retake",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="invalidation_logs",
                        to="retake.courseretake",
                    ),
                ),
            ],
            options={
                "ordering": ["-triggered_at"],
            },
        ),
        migrations.AddIndex(
            model_name="reportinvalidationlog",
            index=models.Index(fields=["student", "resolved_at"], name="retake_inv_student_idx"),
        ),
        migrations.AddIndex(
            model_name="reportinvalidationlog",
            index=models.Index(fields=["triggered_by_retake", "resolved_at"], name="retake_inv_retake_idx"),
        ),
    ]
