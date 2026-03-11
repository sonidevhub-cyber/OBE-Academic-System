from django.db import models
from academics.models import Course

class CLO(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    clo_number = models.IntegerField()
    description = models.TextField()
    bloom_level = models.CharField(max_length=50)

    def __str__(self):
        return f"{self.course.name} - CLO {self.clo_number}"