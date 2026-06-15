from django.urls import path
from .views import CQIView, CheckCQIStatusView, CreateAssessmentView, CoordinatorCQIView, CheckCQIView,EnterMarksView, HODCQIView, ResubmitCQIView, UpdateCQIStatusView, student_result
from .services.view import CLOReportView

urlpatterns = [

    # ✅ Assessment
    path('create/', CreateAssessmentView.as_view()),
    path('<uuid:assessment_id>/enter-marks/', EnterMarksView.as_view()),

    # 🔥 OBE Report
    path(
        'clo-report/<uuid:course_id>/<uuid:batch_id>/<uuid:semester_id>/',
        CLOReportView.as_view()
    ),

    # ✅ CQI (Instructor)
    path("cqi/", CQIView.as_view()),
    path("cqi/check/<uuid:assessment_id>/", CheckCQIView.as_view()),
    path("cqi/check-status/", CheckCQIStatusView.as_view()),
    path("cqi/resubmit/<uuid:cqi_id>/", ResubmitCQIView.as_view()),

    # ✅ HOD
    path("hod-cqi/", HODCQIView.as_view()),
    path("hod-cqi/update/<int:cqi_id>/", UpdateCQIStatusView.as_view()),

    # ✅ Student
    path('student/result/', student_result),
    path('cqi/coordinator/', CoordinatorCQIView.as_view()),
]