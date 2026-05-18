from django.conf import settings
from django.db import models
from datetime import date

# ---------- Semester ----------
class Semester(models.Model):
    semester_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    semester_code = models.CharField(max_length=10, unique=True)
    program_old = models.CharField(max_length=100) # Keep for migration if needed
    capacity = models.PositiveIntegerField(default=30)
    # Replaced Department with Program from academic_structure
    program = models.ForeignKey('academic_structure.Program', on_delete=models.CASCADE, related_name="academics_semesters", null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.semester_code})"

    @property
    def is_base_semester(self):
        """Check if this semester is a base semester (odd numbered)"""
        try:
            semester_num = int(self.name.split()[-1])
            return semester_num % 2 == 1
        except (ValueError, IndexError):
            return False

    @property
    def base_semester(self):
        """Get the base semester for this semester"""
        if self.is_base_semester:
            return self
        try:
            semester_num = int(self.name.split()[-1])
            base_num = semester_num - 1
            base_name = f"Semester {base_num}"
            return Semester.objects.filter(
                program=self.program,
                name=base_name
            ).first()
        except (ValueError, IndexError, Semester.DoesNotExist):
            return None
    
    def get_students(self):
        """Get all students enrolled in this semester"""
        return self.students.filter(is_active=True) if hasattr(self, 'students') else []

# ---------- Course ----------
class Course(models.Model):
    COURSE_TYPE_CHOICES = [
        ('LECTURE', 'Lecture'),
        ('LAB', 'Lab'),
    ]

    course_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=10, unique=True)
    description = models.TextField(blank=True)
    credits = models.PositiveIntegerField(default=3)
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name="courses", null=True, blank=True)
    course_type = models.CharField(max_length=10, choices=COURSE_TYPE_CHOICES, default='LECTURE')
    parent_course = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        related_name='lab_courses',
        null=True,
        blank=True,
    )

    def __str__(self):
        return f"{self.name} ({self.code})"

# ---------- Timetable ----------
class Timetable(models.Model):
    DAY_CHOICES = [
        ('monday', 'Monday'),
        ('tuesday', 'Tuesday'),
        ('wednesday', 'Wednesday'),
        ('thursday', 'Thursday'),
        ('friday', 'Friday'),
        ('saturday', 'Saturday'),
        ('sunday', 'Sunday'),
    ]
    
    APPROVAL_STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    timetable_id = models.AutoField(primary_key=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="timetables")
    # Replaced Instructor with settings.AUTH_USER_MODEL
    instructor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="timetables")
    day = models.CharField(max_length=10, choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    room = models.CharField(max_length=50, blank=True)
    approval_status = models.CharField(max_length=10, choices=APPROVAL_STATUS_CHOICES, default='draft')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_timetables")
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_timetables")
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    
    class Meta:
        unique_together = ['course', 'day', 'start_time']
        ordering = ['day', 'start_time']
    
    def __str__(self):
        return f"{self.course.name} - {self.day} {self.start_time}-{self.end_time}"

# ---------- Attendance ----------
class Attendance(models.Model):
    PRESENT = "Present"
    ABSENT = "Absent"
    LATE = "Late"
    STATUS_CHOICES = [(PRESENT, "Present"), (ABSENT, "Absent"), (LATE, "Late")]

    attendance_id = models.AutoField(primary_key=True)
    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="attendances")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="attendances", null=True, blank=True)
    # Replaced Instructor with settings.AUTH_USER_MODEL
    instructor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="marked_attendances", null=True, blank=True)
    timetable = models.ForeignKey(Timetable, on_delete=models.CASCADE, related_name="attendances", null=True, blank=True)
    date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)
    # Replaced Instructor with settings.AUTH_USER_MODEL
    marked_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="attendance_records")
    is_submitted = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=True)
    admin_approved_edit = models.BooleanField(default=False)
    marked_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        unique_together = ("student", "timetable", "date")
        ordering = ["-date", "-marked_at"]

    def __str__(self):
        return f"{self.student.name} - {self.timetable.course.name} - {self.date} ({self.status})"
    
    def can_be_marked_now(self):
        """Check if attendance can be marked based on timetable slot"""
        from django.utils import timezone
        current_time = timezone.now().time()
        current_day = timezone.now().strftime('%A').lower()
        
        return (
            self.timetable.day == current_day and
            self.timetable.start_time <= current_time <= self.timetable.end_time
        )
    
    def is_editable(self):
        """Check if attendance record can be edited"""
        return self.can_edit and (not self.is_submitted or self.admin_approved_edit)

# ---------- Faculty Attendance ----------
class FacultyAttendance(models.Model):
    PRESENT = "Present"
    ABSENT = "Absent"
    LATE = "Late"
    STATUS_CHOICES = [(PRESENT, "Present"), (ABSENT, "Absent"), (LATE, "Late")]
    
    faculty_attendance_id = models.AutoField(primary_key=True)
    # Replaced Instructor, Coordinator, HOD with settings.AUTH_USER_MODEL
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="faculty_attendances", null=True, blank=True)
    date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=PRESENT)
    marked_by_system = models.BooleanField(default=False)  # Auto-marked when teaching
    marked_by_self = models.BooleanField(default=False)    # Self-marked
    timetable = models.ForeignKey(Timetable, on_delete=models.CASCADE, related_name="faculty_attendances", null=True, blank=True)
    is_submitted = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=True)
    admin_approved_edit = models.BooleanField(default=False)
    marked_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ["-date", "-marked_at"]
    
    def __str__(self):
        faculty_name = self.get_faculty_name()
        return f"{faculty_name} - {self.date} ({self.status})"
    
    def get_faculty_name(self):
        if self.user:
            return self.user.full_name if hasattr(self.user, 'full_name') else self.user.email
        return "Unknown Faculty"
    
    def get_faculty_type(self):
        if self.user:
            return self.user.role.title() if hasattr(self.user, 'role') else "Unknown"
        return "Unknown"
    
    def is_editable(self):
        return self.can_edit and (not self.is_submitted or self.admin_approved_edit)

# ---------- Faculty Attendance Edit Permission ----------
class FacultyAttendanceEditPermission(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    permission_id = models.AutoField(primary_key=True)
    faculty_attendance = models.ForeignKey(FacultyAttendance, on_delete=models.CASCADE, related_name="edit_permissions")
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="faculty_edit_requests")
    reason = models.TextField()
    proposed_status = models.CharField(max_length=10, choices=FacultyAttendance.STATUS_CHOICES, null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_faculty_permissions")
    admin_notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-requested_at']
    
    def __str__(self):
        return f"Faculty edit request for {self.faculty_attendance.get_faculty_name()} - {self.status}"

class AttendanceEditPermission(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    permission_id = models.AutoField(primary_key=True)
    # Replaced Instructor with settings.AUTH_USER_MODEL
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="attendance_edit_requests", null=True, blank=True)
    attendance = models.ForeignKey(Attendance, on_delete=models.CASCADE, related_name="edit_permissions")
    reason = models.TextField()
    proposed_status = models.CharField(max_length=10, choices=Attendance.STATUS_CHOICES, null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_attendance_permissions")
    admin_notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-requested_at']
    
    def __str__(self):
        return f"Edit request for {self.attendance.student.name} - {self.status}"


# ---------- Result ----------
class Result(models.Model):
    result_id = models.AutoField(primary_key=True)
    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="results")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="results", null=True, blank=True)
    exam_type = models.CharField(max_length=50, blank=True, default="Mid Exam")  # e.g. Mid, Final
    exam_date = models.DateField(null=True, blank=True, default=date(2025,9,25))

    # Marks structure: 2 quizzes (5 marks each), 2 assignments (5 marks each), mid-term (25 marks), final (60 marks)
    quiz1_marks = models.FloatField(default=0)        # Max 5
    quiz2_marks = models.FloatField(default=0)        # Max 5
    assignment1_marks = models.FloatField(default=0)  # Max 5
    assignment2_marks = models.FloatField(default=0)  # Max 5
    mid_term_marks = models.FloatField(default=0)     # Max 25
    final_marks = models.FloatField(default=0)        # Max 60

    total_marks = models.FloatField()  # Calculated based on exam_type
    obtained_marks = models.FloatField()  # Calculated as sum of relevant marks
    grade = models.CharField(max_length=2, blank=True, default='F')

    class Meta:
        ordering = ["-exam_date"]

    def __str__(self):
        return f"{self.student.name} - {self.course.name}"

    @property
    def percentage(self):
        return (self.obtained_marks / self.total_marks) * 100 if self.total_marks else 0

    def save(self, *args, **kwargs):
        # Calculate total_marks and obtained_marks based on exam_type
        exam_type_lower = self.exam_type.lower() if self.exam_type else ''

        if 'quiz' in exam_type_lower:
            self.total_marks = 5
            # For quiz, determine which quiz slot to use
            if '1' in exam_type_lower or self.quiz1_marks == 0:
                self.obtained_marks = self.quiz1_marks
            else:
                self.obtained_marks = self.quiz2_marks
        elif 'assignment' in exam_type_lower:
            self.total_marks = 5
            # For assignment, determine which assignment slot to use
            if '1' in exam_type_lower or self.assignment1_marks == 0:
                self.obtained_marks = self.assignment1_marks
            else:
                self.obtained_marks = self.assignment2_marks
        elif 'mid' in exam_type_lower:
            self.total_marks = 25
            self.obtained_marks = self.mid_term_marks
        elif 'final' in exam_type_lower:
            # Final grade is calculated from all assessments
            # Total: 2 quizzes (5 each) + 2 assignments (5 each) + mid (25) + final (60) = 100
            total_assessments = (
                self.quiz1_marks + self.quiz2_marks +  # 10 marks
                self.assignment1_marks + self.assignment2_marks +  # 10 marks
                self.mid_term_marks +  # 25 marks
                self.final_marks  # 60 marks
            )
            self.total_marks = 100
            self.obtained_marks = total_assessments
        else:
            # Default to mid-term if exam_type not recognized
            self.total_marks = 25
            self.obtained_marks = self.mid_term_marks

        # Calculate grade based on percentage
        percentage = (self.obtained_marks / self.total_marks) * 100 if self.total_marks > 0 else 0

        if percentage >= 90:
            self.grade = 'A+'
        elif percentage >= 85:
            self.grade = 'A'
        elif percentage >= 80:
            self.grade = 'A-'
        elif percentage >= 75:
            self.grade = 'B+'
        elif percentage >= 70:
            self.grade = 'B'
        elif percentage >= 65:
            self.grade = 'B-'
        elif percentage >= 60:
            self.grade = 'C+'
        elif percentage >= 55:
            self.grade = 'C'
        elif percentage >= 50:
            self.grade = 'C-'
        elif percentage >= 45:
            self.grade = 'D+'
        elif percentage >= 40:
            self.grade = 'D'
        else:
            self.grade = 'F'

        super().save(*args, **kwargs)

# ---------- Scholarship ----------
class Scholarship(models.Model):
    scholarship_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    eligibility = models.TextField(blank=True)
    students = models.ManyToManyField("students.Student", related_name="scholarships", blank=True)

    def __str__(self):
        return self.name

# ---------- Student Academic History ----------
class StudentAcademicHistory(models.Model):
    history_id = models.AutoField(primary_key=True)
    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="academic_history")
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE)
    gpa = models.FloatField()  # Semester GPA
    cgpa = models.FloatField()  # Cumulative GPA at this point
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ['student', 'semester']

    def __str__(self):
        return f"{self.student.name} - {self.semester.name} - GPA: {self.gpa}, CGPA: {self.cgpa}"


# ---------- DateSheet Module ----------
class DateSheet(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_PENDING, "Pending Approval"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
    ]

    datesheet_id = models.AutoField(primary_key=True)
    # Replaced Department with Program from academic_structure
    program = models.ForeignKey('academic_structure.Program', on_delete=models.CASCADE, related_name="datesheets", null=True, blank=True)
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name="datesheets")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="created_datesheets")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT, db_index=True)
    review_comment = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_datesheets",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        program_name = self.program.name if self.program else "Unknown Program"
        return f"DateSheet {self.datesheet_id} - {program_name} - {self.semester.name}"


class DateSheetItem(models.Model):
    EXAM_MID = "Mid"
    EXAM_FINAL = "Final"
    EXAM_TYPE_CHOICES = [
        (EXAM_MID, "Mid"),
        (EXAM_FINAL, "Final"),
    ]

    datesheet_item_id = models.AutoField(primary_key=True)
    datesheet = models.ForeignKey(DateSheet, on_delete=models.CASCADE, related_name="items")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="datesheet_items")
    exam_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    exam_type = models.CharField(max_length=10, choices=EXAM_TYPE_CHOICES, default=EXAM_MID)

    class Meta:
        ordering = ["exam_date", "start_time"]
        unique_together = ["datesheet", "course", "exam_date", "start_time"]

    def __str__(self):
        return f"{self.course.name} - {self.exam_date} {self.start_time}-{self.end_time}"


class StudentEligibility(models.Model):
    eligibility_id = models.AutoField(primary_key=True)
    datesheet = models.ForeignKey(DateSheet, on_delete=models.CASCADE, related_name="eligibility_records")
    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="datesheet_eligibility")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="datesheet_eligibility")
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name="datesheet_eligibility")
    attendance_percentage = models.FloatField(default=0)
    is_eligible = models.BooleanField(default=False)
    overridden_by_hod = models.BooleanField(default=False)
    hod_reason = models.TextField(blank=True)
    overridden_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="eligibility_overrides",
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["student__name", "course__name"]
        unique_together = ["datesheet", "student", "course"]

    def __str__(self):
        return f"{self.student.name} - {self.course.name} ({self.attendance_percentage}%)"


class DateSheetNotification(models.Model):
    notification_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="datesheet_notifications")
    datesheet = models.ForeignKey(DateSheet, on_delete=models.CASCADE, related_name="notifications")
    message = models.CharField(max_length=255)
