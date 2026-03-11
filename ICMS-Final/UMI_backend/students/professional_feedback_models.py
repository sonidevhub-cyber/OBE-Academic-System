from django.db import models
from django.conf import settings

class Feedback(models.Model):
    FEEDBACK_TYPE_CHOICES = [
        ('teaching', 'Teaching Quality'),
        ('communication', 'Communication'),
        ('support', 'Student Support'),
        ('management', 'Department Management'),
        ('general', 'General'),
    ]
    
    RATING_CHOICES = [
        (1, 'Poor'),
        (2, 'Fair'),
        (3, 'Good'),
        (4, 'Very Good'),
        (5, 'Excellent'),
    ]
    
    # Anonymous feedback - no direct student reference
    department = models.ForeignKey('academics.Department', on_delete=models.CASCADE, related_name='student_feedbacks')
    feedback_type = models.CharField(max_length=20, choices=FEEDBACK_TYPE_CHOICES, default='general')
    title = models.CharField(max_length=200)
    message = models.TextField()
    rating = models.IntegerField(choices=RATING_CHOICES, default=3)
    created_at = models.DateTimeField(auto_now_add=True)
    is_reviewed = models.BooleanField(default=False)  # Track if HOD has reviewed
    
    # Optional fields for categorization
    semester = models.CharField(max_length=50, blank=True, null=True)
    subject_area = models.CharField(max_length=100, blank=True, null=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Feedback'
        verbose_name_plural = 'Feedbacks'
    
    def __str__(self):
        return f"Anonymous feedback for {self.department.name} - {self.feedback_type}"