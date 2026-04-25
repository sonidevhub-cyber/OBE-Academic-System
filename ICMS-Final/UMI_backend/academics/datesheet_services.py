from __future__ import annotations

from typing import Iterable, Optional

from django.db import transaction
from django.utils import timezone

from students.models import Student

from .models import Attendance, Course, DateSheet, DateSheetNotification, StudentEligibility


ELIGIBILITY_THRESHOLD = 75.0


def get_user_role(user) -> str:
    if not user or not getattr(user, "is_authenticated", False):
        return ""
    return str(getattr(user, "effective_role", None) or getattr(user, "active_role", None) or getattr(user, "role", "")).lower()


def get_user_department(user):
    if not user or not getattr(user, "is_authenticated", False):
        return None

    for attr in ("coordinator_profile", "hod_profile", "student"):
        profile = getattr(user, attr, None)
        if profile and getattr(profile, "department", None):
            return profile.department
    return None


def get_user_semester(user):
    if not user or not getattr(user, "is_authenticated", False):
        return None

    student = getattr(user, "student", None)
    if student and getattr(student, "semester", None):
        return student.semester
    return None


def get_student_profile(user) -> Optional[Student]:
    if not user or not getattr(user, "is_authenticated", False):
        return None
    student = getattr(user, "student", None)
    return student if isinstance(student, Student) else None


def calculate_attendance_percentage(student: Student, course: Course) -> float:
    records = Attendance.objects.filter(student=student, course=course)
    total = records.count()
    if total == 0:
        return 0.0

    present_count = records.filter(status__in=[Attendance.PRESENT, Attendance.LATE]).count()
    return round((present_count / total) * 100, 2)


def get_datesheet_students(datesheet: DateSheet) -> Iterable[Student]:
    return (
        Student.objects.select_related("department", "semester", "user")
        .filter(department=datesheet.department, semester=datesheet.semester)
        .order_by("name")
    )


@transaction.atomic
def sync_datesheet_eligibility(datesheet: DateSheet) -> list[StudentEligibility]:
    datesheet = DateSheet.objects.select_related("department", "semester").prefetch_related("items__course").get(pk=datesheet.pk)
    students = list(get_datesheet_students(datesheet))
    items = list(datesheet.items.select_related("course"))
    synced: list[StudentEligibility] = []
    active_pairs: set[tuple[str, int]] = set()

    for item in items:
        for student in students:
            active_pairs.add((student.student_id, item.course_id))
            attendance_percentage = calculate_attendance_percentage(student, item.course)
            eligible = attendance_percentage >= ELIGIBILITY_THRESHOLD

            eligibility, _ = StudentEligibility.objects.update_or_create(
                datesheet=datesheet,
                student=student,
                course=item.course,
                defaults={
                    "semester": datesheet.semester,
                    "attendance_percentage": attendance_percentage,
                    "is_eligible": eligible,
                },
            )
            if eligibility.overridden_by_hod:
                eligibility.attendance_percentage = attendance_percentage
                eligibility.semester = datesheet.semester
                if not eligibility.is_eligible:
                    eligibility.is_eligible = True
                eligibility.save(update_fields=["attendance_percentage", "semester", "is_eligible", "updated_at"])
            else:
                if eligibility.is_eligible != eligible:
                    eligibility.is_eligible = eligible
                    eligibility.save(update_fields=["is_eligible", "updated_at"])
            synced.append(eligibility)

    stale_record_ids = [
        record.pk
        for record in datesheet.eligibility_records.all().only("eligibility_id", "student_id", "course_id")
        if (record.student_id, record.course_id) not in active_pairs
    ]
    if stale_record_ids:
        StudentEligibility.objects.filter(pk__in=stale_record_ids).delete()

    return synced


@transaction.atomic
def create_approval_notifications(datesheet: DateSheet) -> list[DateSheetNotification]:
    notifications: list[DateSheetNotification] = []
    students = get_datesheet_students(datesheet)

    for student in students:
        if not getattr(student, "user_id", None):
            continue

        message = f"Approved DateSheet available for {datesheet.department.name}, {datesheet.semester.name}."
        notification, _ = DateSheetNotification.objects.get_or_create(
            user=student.user,
            datesheet=datesheet,
            message=message,
            defaults={"is_read": False},
        )
        notifications.append(notification)

    return notifications


def reset_eligibility_override(eligibility: StudentEligibility, reason: str, user) -> StudentEligibility:
    eligibility.overridden_by_hod = True
    eligibility.is_eligible = True
    eligibility.hod_reason = reason.strip()
    eligibility.overridden_by = user
    eligibility.save(update_fields=["overridden_by_hod", "is_eligible", "hod_reason", "overridden_by", "updated_at"])
    return eligibility


def mark_notifications_as_read(user) -> int:
    now = timezone.now()
    updated = DateSheetNotification.objects.filter(user=user, is_read=False).update(is_read=True, read_at=now)
    return updated
