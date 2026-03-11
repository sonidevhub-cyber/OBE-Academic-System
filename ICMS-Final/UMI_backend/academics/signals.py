from django.db.models.signals import post_save, post_delete, m2m_changed
from django.dispatch import receiver
from .models import Attendance, Result, Scholarship
from students.models import Student

# ===========================
# GPA calculation
# ===========================
def compute_gpa(student):
    pts = []
    for r in student.results.all():
        pct = r.percentage
        if pct >= 85: pts.append(4.0)
        elif pct >= 75: pts.append(3.5)
        elif pct >= 65: pts.append(3.0)
        elif pct >= 55: pts.append(2.5)
        elif pct >= 50: pts.append(2.0)
        else: pts.append(0.0)
    return round(sum(pts) / len(pts), 2) if pts else 0.0

# ===========================
# Attendance percentage
# ===========================
def compute_attendance_rate(student):
    total = student.attendances.count()
    if total == 0:
        return 0.0
    present = student.attendances.filter(status=Attendance.PRESENT).count()
    return round((present / total) * 100, 2)

# ===========================
# Refresh student analytics
# ===========================
def refresh_student_ai(student):
    student.attendance_percentage = compute_attendance_rate(student)
    student.gpa = compute_gpa(student)
    student.save(update_fields=["attendance_percentage", "gpa"])

# ===========================
# Update student on Attendance/Result changes
# ===========================
@receiver([post_save, post_delete], sender=Attendance)
@receiver([post_save, post_delete], sender=Result)
def update_student_ai(sender, instance, **kwargs):
    if hasattr(instance, 'student'):
        refresh_student_ai(instance.student)

# ===========================
# Update student when Scholarship changes
# ===========================
@receiver(m2m_changed, sender=Scholarship.students.through)
def update_student_scholarship(sender, instance, **kwargs):
    if hasattr(instance, 'students'):
        for student in instance.students.all():
            refresh_student_ai(student)