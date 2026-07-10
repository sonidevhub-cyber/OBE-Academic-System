from django.apps import AppConfig


class CloMasterConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'clo_master'

    def ready(self):
        import clo_master.signals
