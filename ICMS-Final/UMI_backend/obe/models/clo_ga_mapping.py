from django.db import models
from .clo import CLO
from .ga import GraduateAttribute

class CLOGAMapping(models.Model):
    clo = models.ForeignKey(CLO, on_delete=models.CASCADE)
    ga = models.ForeignKey(GraduateAttribute, on_delete=models.CASCADE)