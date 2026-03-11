from django.db import models
from django.utils import timezone
from datetime import date, datetime
from django.core.validators import MinValueValidator, MaxValueValidator

class StudentAttendance(models.Model):
    STATUS_CHOICES = [
        ('Present', 'Present'),
        ('Absent', 'Absent'),
        ('Late', 'Late'),
        ('Excused', 'Excused'),
    ]
    
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE)
    course = models.ForeignKey('academics.Course', on_delete=models.CASCADE)
    instructor = models.ForeignKey('instructors.Instructor', on_delete=models.CASCADE)
    timetable = models.ForeignKey('academics.Timetable', on_delete=models.CASCADE)
    date = models.DateField(default=date.today)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='Present')
    is_locked = models.BooleanField(default=False)
    marked_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    notes = models.TextField(blank=True, help_text="Additional notes for attendance")
    location_verified = models.BooleanField(default=False, help_text="GPS/Location verification")
    
    class Meta:
        unique_together = ['student', 'timetable', 'date']
        ordering = ['-date', '-marked_at']
        indexes = [
            models.Index(fields=['date', 'status']),
            models.Index(fields=['student', 'date']),
            models.Index(fields=['course', 'date']),
        ]
    
    def __str__(self):
        return f"{self.student.name} - {self.course.name} - {self.date} ({self.status})"
    
    @property
    def attendance_percentage(self):
        """Calculate student's attendance percentage for this course"""
        total_classes = StudentAttendance.objects.filter(
            student=self.student,
            course=self.course
        ).count()
        
        present_classes = StudentAttendance.objects.filter(
            student=self.student,
            course=self.course,
            status__in=['Present', 'Late']
        ).count()
        
        return (present_classes / total_classes * 100) if total_classes > 0 else 0

class FacultyAttendance(models.Model):
    STATUS_CHOICES = [
        ('Present', 'Present'),
        ('Absent', 'Absent'),
        ('Late', 'Late'),
    ]
    
    instructor = models.ForeignKey('instructors.Instructor', on_delete=models.CASCADE, null=True, blank=True)
    coordinator = models.ForeignKey('coordinators.Coordinator', on_delete=models.CASCADE, null=True, blank=True)
    hod = models.ForeignKey('hods.HOD', on_delete=models.CASCADE, null=True, blank=True)
    date = models.DateField(default=date.today)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='Present')
    auto_marked = models.BooleanField(default=False)  # System marked when teaching
    self_marked = models.BooleanField(default=False)  # Self marked
    is_locked = models.BooleanField(default=False)
    marked_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-date', '-marked_at']
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(instructor__isnull=False) |
                    models.Q(coordinator__isnull=False) |
                    models.Q(hod__isnull=False)
                ),
                name='faculty_attendance_has_faculty'
            )
        ]
    
    def get_faculty_name(self):
        if self.instructor:
            return self.instructor.name
        elif self.coordinator:
            return self.coordinator.name
        elif self.hod:
            return self.hod.name
        return "Unknown"
    
    def get_faculty_type(self):
        if self.instructor:
            return "Instructor"
        elif self.coordinator:
            return "Coordinator"
        elif self.hod:
            return "HOD"
        return "Unknown"
    
    def get_department(self):
        if self.instructor:
            return self.instructor.department
        elif self.coordinator:
            return self.coordinator.department
        elif self.hod:
            return self.hod.department
        return None
    
    def __str__(self):
        return f"{self.get_faculty_name()} - {self.date} ({self.status})"

class AttendanceEditRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    REQUEST_TYPE_CHOICES = [
        ('student', 'Student Attendance'),
        ('faculty', 'Faculty Attendance'),
    ]
    
    request_type = models.CharField(max_length=10, choices=REQUEST_TYPE_CHOICES)
    student_attendance = models.ForeignKey(StudentAttendance, on_delete=models.CASCADE, null=True, blank=True)
    faculty_attendance = models.ForeignKey(FacultyAttendance, on_delete=models.CASCADE, null=True, blank=True)
    requested_by = models.ForeignKey('register.User', on_delete=models.CASCADE)
    reason = models.TextField()
    proposed_status = models.CharField(max_length=10, choices=StudentAttendance.STATUS_CHOICES)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey('register.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_requests')
    admin_notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-requested_at']


class AttendanceUpdateRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('used', 'Used'),
    ]

    requested_by = models.ForeignKey('register.User', on_delete=models.CASCADE, related_name='attendance_update_requests')
    timetable = models.ForeignKey('academics.Timetable', on_delete=models.CASCADE, related_name='attendance_update_requests')
    attendance_date = models.DateField()
    reason = models.TextField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    admin_notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        'register.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_attendance_update_requests'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'attendance_date']),
            models.Index(fields=['requested_by', 'created_at']),
        ]

    def __str__(self):
        return f"{self.timetable_id} {self.attendance_date} ({self.status})"
    
class AttendanceSettings(models.Model):
    """Global attendance settings for the institution"""
    minimum_attendance_percentage = models.FloatField(
        default=75.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(100.0)],
        help_text="Minimum required attendance percentage"
    )
    late_arrival_threshold_minutes = models.IntegerField(
        default=15,
        help_text="Minutes after class start time to mark as late"
    )
    auto_lock_attendance_hours = models.IntegerField(
        default=24,
        help_text="Hours after which attendance is automatically locked"
    )
    allow_future_attendance = models.BooleanField(
        default=False,
        help_text="Allow marking attendance for future dates"
    )
    require_location_verification = models.BooleanField(
        default=False,
        help_text="Require GPS/location verification for attendance"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Attendance Settings"
        verbose_name_plural = "Attendance Settings"
    
    def __str__(self):
        return f"Attendance Settings (Min: {self.minimum_attendance_percentage}%)"
    
    @classmethod
    def get_settings(cls):
        """Get or create attendance settings"""
        settings, created = cls.objects.get_or_create(pk=1)
        return settings

class AttendanceAlert(models.Model):
    """Attendance alerts for low attendance students"""
    ALERT_TYPES = [
        ('low_attendance', 'Low Attendance'),
        ('critical_attendance', 'Critical Attendance'),
        ('improvement', 'Attendance Improved'),
    ]
    
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE)
    course = models.ForeignKey('academics.Course', on_delete=models.CASCADE)
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPES)
    attendance_percentage = models.FloatField()
    message = models.TextField()
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['student', 'is_resolved']),
            models.Index(fields=['course', 'alert_type']),
        ]
    
    def __str__(self):
        return f"{self.student.name} - {self.alert_type} ({self.attendance_percentage}%)"

class BulkAttendanceSession(models.Model):
    """Track bulk attendance marking sessions"""
    instructor = models.ForeignKey('instructors.Instructor', on_delete=models.CASCADE)
    timetable = models.ForeignKey('academics.Timetable', on_delete=models.CASCADE)
    date = models.DateField()
    total_students = models.IntegerField()
    marked_students = models.IntegerField()
    session_start = models.DateTimeField(auto_now_add=True)
    session_end = models.DateTimeField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-session_start']
        unique_together = ['instructor', 'timetable', 'date']
    
    def __str__(self):
        return f"{self.instructor.name} - {self.timetable.course.name} - {self.date}"
