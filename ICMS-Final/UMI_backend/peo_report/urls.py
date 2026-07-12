from django.urls import path

from .views import PEOReportPDFView, PEOReportView, PEOCQIUpsertView

urlpatterns = [
    path("peo-report/<uuid:program_id>/<int:year>/", PEOReportView.as_view()),
    path("peo-report/<uuid:program_id>/<int:year>/pdf/", PEOReportPDFView.as_view()),
    path("peo-cqi/<uuid:program_id>/<uuid:peo_id>/<int:year>/", PEOCQIUpsertView.as_view()),
]
