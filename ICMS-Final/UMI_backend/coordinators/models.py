from django.db import models
from register.models import User
from register.identifiers import generate_employee_id

class Coordinator(models.Model):
    GENDER_CHOICES = (
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    )
    
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="coordinator_profile"
    )
    employee_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    name = models.CharField(max_length=100)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    department = models.ForeignKey("academics.Department", on_delete=models.SET_NULL, null=True, blank=True)
    designation = models.CharField(max_length=100, default='Coordinator')
    hire_date = models.DateField(null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, null=True, blank=True)
    specialization = models.CharField(max_length=100)
    experience_years = models.IntegerField(default=0)
    image = models.ImageField(upload_to="coordinator_images/", null=True, blank=True)
    
    # Coordinator specific fields - default is False, enable only when instructor role is explicitly assigned
    can_act_as_instructor = models.BooleanField(default=False)
    assigned_by = models.ForeignKey("hods.HOD", on_delete=models.SET_NULL, null=True, blank=True)
    
    # Instructor capabilities when acting as instructor
    instructor_specialization = models.CharField(max_length=100, blank=True)
    instructor_experience_years = models.IntegerField(default=0)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Coordinator"
        verbose_name_plural = "Coordinators"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.department.name if self.department else 'No Department'}"

    def save(self, *args, **kwargs):
        if not self.employee_id:
            self.employee_id = generate_employee_id('coordinator', self.department)
        if self.user and not self.user.employee_id:
            self.user.employee_id = self.employee_id
            if not self.user.username:
                self.user.username = self.employee_id
            self.user.save(update_fields=['employee_id', 'username'])
        super().save(*args, **kwargs)


class TimetableProposal(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted to HOD'),
        ('approved', 'Approved by HOD'),
        ('rejected', 'Rejected by HOD'),
        ('implemented', 'Implemented'),
    ]
    
    proposal_id = models.AutoField(primary_key=True)
    coordinator = models.ForeignKey(Coordinator, on_delete=models.CASCADE, related_name="timetable_proposals")
    semester = models.ForeignKey("academics.Semester", on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    created_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey("hods.HOD", on_delete=models.SET_NULL, null=True, blank=True)
    hod_comments = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.title} - {self.status}"


class TimetableSlot(models.Model):
    DAY_CHOICES = [
        ('monday', 'Monday'),
        ('tuesday', 'Tuesday'),
        ('wednesday', 'Wednesday'),
        ('thursday', 'Thursday'),
        ('friday', 'Friday'),
        ('saturday', 'Saturday'),
    ]
    
    proposal = models.ForeignKey(TimetableProposal, on_delete=models.CASCADE, related_name="slots")
    course = models.ForeignKey("academics.Course", on_delete=models.CASCADE)
    instructor = models.ForeignKey("instructors.Instructor", on_delete=models.CASCADE, null=True, blank=True)
    day = models.CharField(max_length=10, choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    room = models.CharField(max_length=50, blank=True)
    
    class Meta:
        unique_together = ['proposal', 'day', 'start_time', 'room']
        ordering = ['day', 'start_time']
    
    def __str__(self):
        return f"{self.course.name} - {self.day} {self.start_time}-{self.end_time}"


class CourseAllocation(models.Model):
    STATUS_CHOICES = [
        ('proposed', 'Proposed by Coordinator'),
        ('approved', 'Approved by HOD'),
        ('rejected', 'Rejected by HOD'),
        ('active', 'Active'),
    ]
    
    allocation_id = models.AutoField(primary_key=True)
    coordinator = models.ForeignKey(Coordinator, on_delete=models.CASCADE, related_name="course_allocations")
    course = models.ForeignKey("academics.Course", on_delete=models.CASCADE)
    instructor = models.ForeignKey("instructors.Instructor", on_delete=models.CASCADE)
    semester = models.ForeignKey("academics.Semester", on_delete=models.CASCADE)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='proposed')
    proposed_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey("hods.HOD", on_delete=models.SET_NULL, null=True, blank=True)
    hod_comments = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    
    class Meta:
        unique_together = ['course', 'semester']
        ordering = ['-proposed_at']
    
    def __str__(self):
        return f"{self.course.name} -> {self.instructor.name} ({self.status})"
    
    def activate(self):
        """Activate the allocation after HOD approval"""
        if self.status == 'approved':
            self.status = 'active'
            self.save()

class AllocationStudent(models.Model):
    allocation = models.ForeignKey(CourseAllocation, on_delete=models.CASCADE, related_name="students")
    student = models.ForeignKey("students.Student", on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.student.name} - {self.allocation.course.name}"

        
class CoordinatorDashboard(models.Model):
    coordinator = models.OneToOneField(Coordinator, on_delete=models.CASCADE, related_name="dashboard")
    
    # Dashboard metrics
    total_courses_managed = models.IntegerField(default=0)
    total_instructors_coordinated = models.IntegerField(default=0)
    pending_approvals = models.IntegerField(default=0)
    active_timetables = models.IntegerField(default=0)
    
    # Professional development tracking
    training_hours = models.IntegerField(default=0)
    certifications = models.TextField(blank=True)
    performance_rating = models.FloatField(default=0.0)
    
    last_updated = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Dashboard - {self.coordinator.name}"
    
    def update_metrics(self):
        """Update dashboard metrics"""
        self.total_courses_managed = self.coordinator.course_allocations.filter(status='active').count()
        self.total_instructors_coordinated = self.coordinator.course_allocations.values('instructor').distinct().count()
        self.pending_approvals = (
            self.coordinator.timetable_proposals.filter(status='submitted').count() +
            self.coordinator.course_allocations.filter(status='proposed').count()
        )
        self.active_timetables = self.coordinator.timetable_proposals.filter(status='implemented').count()
        self.save()
