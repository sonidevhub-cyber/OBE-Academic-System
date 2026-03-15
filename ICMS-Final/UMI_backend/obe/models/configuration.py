from django.db import models


class OBEConfiguration(models.Model):
    clo_pass_threshold = models.FloatField(
        default=60.0,
        help_text="Minimum percentage for CLO attainment",
    )
    ga_pass_threshold = models.FloatField(
        default=60.0,
        help_text="Minimum percentage for GA attainment",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "OBE Configuration"
        verbose_name_plural = "OBE Configuration"

    def __str__(self):
        return f"OBE Configuration (CLO: {self.clo_pass_threshold}%, GA: {self.ga_pass_threshold}%)"
