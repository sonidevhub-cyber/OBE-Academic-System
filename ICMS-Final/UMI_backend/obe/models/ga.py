from django.db import models

class GraduateAttribute(models.Model):
    code = models.CharField(max_length=10)
    description = models.TextField()

    def __str__(self):
        return self.code
