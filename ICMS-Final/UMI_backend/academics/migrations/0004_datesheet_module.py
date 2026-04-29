# Generated manually for the DateSheet module.

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0003_course_type_parent_course"),
        ("students", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="DateSheet",
            fields=[
                ("datesheet_id", models.AutoField(primary_key=True, serialize=False)),
                ("status", models.CharField(choices=[("draft", "Draft"), ("pending", "Pending Approval"), ("approved", "Approved"), ("rejected", "Rejected")], db_index=True, default="draft", max_length=20)),
                ("review_comment", models.TextField(blank=True)),
                ("rejection_reason", models.TextField(blank=True)),
                ("submitted_at", models.DateTimeField(blank=True, null=True)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="created_datesheets", to=settings.AUTH_USER_MODEL)),
                ("department", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="datesheets", to="academics.department")),
                ("reviewed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="reviewed_datesheets", to=settings.AUTH_USER_MODEL)),
                ("semester", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="datesheets", to="academics.semester")),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="DateSheetItem",
            fields=[
                ("datesheet_item_id", models.AutoField(primary_key=True, serialize=False)),
                ("exam_date", models.DateField()),
                ("start_time", models.TimeField()),
                ("end_time", models.TimeField()),
                ("exam_type", models.CharField(choices=[("Mid", "Mid"), ("Final", "Final")], default="Mid", max_length=10)),
                ("course", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="datesheet_items", to="academics.course")),
                ("datesheet", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="academics.datesheet")),
            ],
            options={
                "ordering": ["exam_date", "start_time"],
                "unique_together": {("datesheet", "course", "exam_date", "start_time")},
            },
        ),
        migrations.CreateModel(
            name="StudentEligibility",
            fields=[
                ("eligibility_id", models.AutoField(primary_key=True, serialize=False)),
                ("attendance_percentage", models.FloatField(default=0)),
                ("is_eligible", models.BooleanField(default=False)),
                ("overridden_by_hod", models.BooleanField(default=False)),
                ("hod_reason", models.TextField(blank=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("course", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="datesheet_eligibility", to="academics.course")),
                ("datesheet", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="eligibility_records", to="academics.datesheet")),
                ("overridden_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="eligibility_overrides", to=settings.AUTH_USER_MODEL)),
                ("semester", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="datesheet_eligibility", to="academics.semester")),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="datesheet_eligibility", to="students.student")),
            ],
            options={
                "ordering": ["student__name", "course__name"],
                "unique_together": {("datesheet", "student", "course")},
            },
        ),
        migrations.CreateModel(
            name="DateSheetNotification",
            fields=[
                ("notification_id", models.AutoField(primary_key=True, serialize=False)),
                ("message", models.CharField(max_length=255)),
                ("is_read", models.BooleanField(default=False)),
                ("read_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("datesheet", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to="academics.datesheet")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="datesheet_notifications", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
                "unique_together": {("user", "datesheet", "message")},
            },
        ),
    ]
