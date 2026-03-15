from django.db import models
from .clo import CLO
from .ga import GraduateAttribute

class CLOGAMapping(models.Model):
    clo = models.ForeignKey(CLO, on_delete=models.CASCADE)
    ga = models.ForeignKey(GraduateAttribute, on_delete=models.CASCADE)
    weightage = models.FloatField(default=1)

    def __str__(self):
        return f"{self.clo} -> {self.ga.code}"

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["clo", "ga"],
                name="unique_clo_ga_mapping",
            )
        ]
