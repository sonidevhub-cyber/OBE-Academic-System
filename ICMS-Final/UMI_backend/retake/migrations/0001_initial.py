# Generated manually for the additive Course Retake module.

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0018_batch_alumni_feedback_due_at"),
        ("students", "0007_student_is_late_submitter"),
        ("obe", "0022_gacqirecord_hod_action_plan_gacqirecord_is_active_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="CourseRetake",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "attempt_number",
                    models.PositiveSmallIntegerField(
                        choices=[(1, "1st Attempt"), (2, "2nd Attempt"), (3, "3rd Attempt")]
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("ongoing", "Ongoing"),
                            ("passed", "Passed"),
                            ("failed_again", "Failed Again"),
                        ],
                        default="ongoing",
                        max_length=20,
                    ),
                ),
                (
                    "is_active",
                    models.BooleanField(default=True),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True),
                ),
                (
                    "ga_score",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="retake_source",
                        to="obe.coursegascore",
                    ),
                ),
                (
                    "current_batch",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="retake_students",
                        to="core.batch",
                    ),
                ),
                (
                    "failed_batch",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="retakes_from_here",
                        to="core.batch",
                    ),
                ),
                (
                    "failed_course",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="retake_records",
                        to="core.course",
                    ),
                ),
                (
                    "retake_teacher",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="assigned_retakes",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="retakes",
                        to="students.student",
                    ),
                ),
            ],
            options={
                "ordering": ["student", "failed_course", "attempt_number"],
                "indexes": [
                    models.Index(fields=["student", "is_active"], name="retake_student_active_idx"),
                    models.Index(
                        fields=["retake_teacher", "is_active"],
                        name="retake_teacher_active_idx",
                    ),
                ],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("student", "failed_course", "attempt_number"),
                        name="unique_student_course_attempt",
                    )
                ],
            },
        ),
    ]
