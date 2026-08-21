from django.apps import AppConfig
class ObeConfig(AppConfig):
    name = 'obe'
    
    def ready(self):
        import obe.signals
