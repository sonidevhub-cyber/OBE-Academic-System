from django.urls import path
from ga_cqi_cohort.views import (
    GAStatusRowView, 
    GACQISaveView, 
    GACQIAdvisoryExportView, 
    GACQIAdvisoryExportPDFView
)

urlpatterns = [
    path('ga-report/<str:program_id>/<str:batch_id>/status-row/', GAStatusRowView.as_view(), name='ga-status-row'),
    path('ga-cqi/<str:record_id>/save/', GACQISaveView.as_view(), name='ga-cqi-save'),
    path('ga-cqi/advisory-export/<str:program_id>/<str:batch_id>/', GACQIAdvisoryExportView.as_view(), name='ga-cqi-advisory-export'),
    path('ga-cqi/advisory-export/<str:program_id>/<str:batch_id>/pdf/', GACQIAdvisoryExportPDFView.as_view(), name='ga-cqi-advisory-export-pdf'),
]
