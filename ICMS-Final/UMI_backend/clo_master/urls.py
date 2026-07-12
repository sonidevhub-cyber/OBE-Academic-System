
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CLOMasterViewSet, get_clo_master_report


router = DefaultRouter()
router.register(r"", CLOMasterViewSet, basename="clo-master")


urlpatterns = [
    path("report/<str:program_id>/<str:semester_id>/export/", get_clo_master_report, name="clo-master-report-export"),
    path("report/<str:program_id>/<str:semester_id>/", get_clo_master_report, name="clo-master-report"),
    path("", include(router.urls)),
]
