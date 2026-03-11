from django.db.models.signals import post_save, m2m_changed
from django.dispatch import receiver
from django.db.models import Avg
from .models import Attendance, Result, Scholarship, StudentAcademicHistory
from students.models import Student
from datetime import timedelta

# GPA calculate
def compute_gpa(student):
    pts = []
    for r in student.results.all():
        pct = r.percentage
        if pct >= 85:
            pts.append(4.0)
        elif pct >= 75:
            pts.append(3.5)
        elif pct >= 65:
            pts.append(3.0)
        elif pct >= 55:
            pts.append(2.5)
        elif pct >= 50:
            pts.append(2.0)
        else:
            pts.append(0.0)
    return round(sum(pts) / len(pts), 2) if pts else 0.0

# Attendance %
def compute_attendance_rate(student):
    total = student.attendances.count()
    if total == 0:
        return 0.0
    present = student.attendances.filter(status=Attendance.PRESENT).count()
    return round((present / total) * 100, 2)

# Refresh student AI fields
def refresh_student_ai(student):
    student.attendance_percentage = compute_attendance_rate(student)
    student.gpa = compute_gpa(student)
    student.save(update_fields=["attendance_percentage", "gpa"])

# Signals to update GPA & Attendance automatically
@receiver(post_save, sender=Attendance)
@receiver(post_save, sender=Result)
def update_student_ai(sender, instance, **kwargs):
    refresh_student_ai(instance.student)

# Update student data when scholarship M2M changes
@receiver(m2m_changed, sender=Scholarship.students.through)
def update_student_scholarship(sender, instance, **kwargs):
    if hasattr(instance, 'students'):
        for student in instance.students.all():
            refresh_student_ai(student)

# Signal for final result submission, CGPA calculation, and promotion
@receiver(post_save, sender=Result)
def handle_final_result_submission(sender, instance, created, **kwargs):
    """
    When a final result is saved, check if all finals for the semester are submitted.
    If yes, calculate semester GPA, update CGPA, create history, and promote if passed.
    """
    if not instance.exam_type or 'final' not in instance.exam_type.lower():
        return

    student = instance.student
    semester = instance.course.semester if instance.course else None
    if not semester or semester != student.semester:
        return

    # Check if all courses for the semester have final results
    semester_courses = semester.courses.all()
    final_results = Result.objects.filter(
        student=student,
        course__in=semester_courses,
        exam_type__icontains='final'
    )

    if final_results.count() != semester_courses.count():
        return  # Not all finals submitted yet

    # All finals submitted, calculate semester GPA
    semester_gpa = compute_gpa(student)

    # Update student GPA and CGPA
    student.gpa = semester_gpa
    student.previous_cgpa = student.cgpa
    student.cgpa = (student.previous_cgpa + semester_gpa) / 2
    student.save(update_fields=['gpa', 'cgpa', 'previous_cgpa'])

    # Create academic history record
    StudentAcademicHistory.objects.create(
        student=student,
        semester=semester,
        gpa=semester_gpa,
        cgpa=student.cgpa
    )

    # Check if passed (no F grades and GPA >= 2.0)
    failing_results = final_results.filter(grade='F')
    if failing_results.exists() or semester_gpa < 2.0:
        return  # Not passed, no promotion

    # Promote to next semester
    next_semester = student.get_next_semester()
    if next_semester:
        student.semester = next_semester
        student.save()