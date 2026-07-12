from django.urls import path

from .views import (
    CourseRetakeCreateView,
    MyAssignedRetakesView,
    PendingRetakeInvalidationsView,
    RetakeAssessmentContextView,
    RetakeInvalidationLogView,
    RecalculateRetakeReportsView,
    RetakeStatusUpdateView,
    StudentRetakeHistoryView,
)

urlpatterns = [
    path("", CourseRetakeCreateView.as_view(), name="retake-create"),
    path("my-assigned/", MyAssignedRetakesView.as_view(), name="retake-my-assigned"),
    path("<uuid:retake_id>/assessment-context/", RetakeAssessmentContextView.as_view(), name="retake-assessment-context"),
    path("<uuid:pk>/status/", RetakeStatusUpdateView.as_view(), name="retake-status"),
    path("student/<uuid:student_id>/", StudentRetakeHistoryView.as_view(), name="student-retake-history"),
    path("invalidation-log/", RetakeInvalidationLogView.as_view(), name="retake-invalidation-log"),
    path("invalidation-log/pending/", PendingRetakeInvalidationsView.as_view(), name="retake-pending-invalidations"),
    path("recalculate-reports/", RecalculateRetakeReportsView.as_view(), name="retake-recalculate-reports"),
]
