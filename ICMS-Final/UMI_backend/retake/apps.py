from django.apps import AppConfig
from pathlib import Path


class RetakeConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "retake"
    path = str(Path(__file__).resolve().parent)

    def ready(self):
        from . import signals  # noqa: F401
