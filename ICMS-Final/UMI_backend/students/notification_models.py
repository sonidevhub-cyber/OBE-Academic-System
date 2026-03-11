from django.db import models

class FeedbackNotification(models.Model):
    hod = models.ForeignKey('hods.HOD', on_delete=models.CASCADE, related_name='feedback_notifications')
    feedback = models.ForeignKey('students.Feedback', on_delete=models.CASCADE, related_name='notifications')
    message = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Notification for {self.hod.name} - {self.message}"