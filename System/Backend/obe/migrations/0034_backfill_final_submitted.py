from django.db import migrations


def backfill_final_submitted(apps, schema_editor):
    Assessment = apps.get_model("assessments", "Assessment")
    CourseSession = apps.get_model("obe", "CourseSession")
    Semester = apps.get_model("core", "Semester")

    final_assessments = Assessment.objects.filter(
        assessment_type="final",
        is_finalized=True,
        course_retake__isnull=True,
        course__isnull=False,
        batch__isnull=False,
        semester__isnull=False,
    ).values("course_id", "batch_id", "semester_id").distinct()

    touched_pairs = set()
    for final_assessment in final_assessments:
        CourseSession.objects.filter(
            course_id=final_assessment["course_id"],
            batch_id=final_assessment["batch_id"],
            semester_id=final_assessment["semester_id"],
            is_active=True,
        ).update(
            final_submitted=True,
            internal_complete_awaiting_final=False,
            assessment_done=True,
            assessment_status="ASSESSMENT_DONE",
        )
        touched_pairs.add((final_assessment["batch_id"], final_assessment["semester_id"]))

    for batch_id, semester_id in touched_pairs:
        sessions = list(CourseSession.objects.filter(
            batch_id=batch_id,
            semester_id=semester_id,
            is_active=True,
        ))
        if not sessions:
            continue

        if all(session.final_submitted for session in sessions):
            status = "RESULT_RECEIVED"
        elif all(session.internal_complete_awaiting_final for session in sessions):
            status = "AWAITING_EXTERNAL_RESULT"
        else:
            status = "ONGOING"

        Semester.objects.filter(id=semester_id).exclude(status="FINALIZED").update(status=status)


class Migration(migrations.Migration):

    dependencies = [
        ("assessments", "0007_awaiting_external_result"),
        ("obe", "0033_awaiting_external_result"),
    ]

    operations = [
        migrations.RunPython(backfill_final_submitted, migrations.RunPython.noop),
    ]
