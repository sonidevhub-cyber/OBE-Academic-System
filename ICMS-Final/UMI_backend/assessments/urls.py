from django.urls import path
from .views import AssessmentHistoryView, AssessmentMarksView, CQIView, CheckCQIStatusView, CreateAssessmentView, CLOCoverageView, CoordinatorCQIView, UpdateStudentMarksView,student_result, CheckCQIView,EnterMarksView, ResubmitCQIView, UpdateCQIStatusView,PreviousCQIView, UpdateStudentMarksView, AssessmentListView, HODCQIListView
from .services.view import CLOReportView

urlpatterns = [

    # ✅ Assessment
    path('', AssessmentListView.as_view()),
    path('create/', CreateAssessmentView.as_view()),
    path('clo-coverage/', CLOCoverageView.as_view()),
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

    
    path("hod-cqi/", HODCQIListView.as_view()),
    path("hod-cqi/update/<int:cqi_id>/", UpdateCQIStatusView.as_view()),

    # ✅ Student
    path('student/result/', student_result),
    path('cqi/coordinator/', CoordinatorCQIView.as_view()),
    path('previous-cqi/', PreviousCQIView.as_view()),
    path("update-student-marks/",UpdateStudentMarksView.as_view()),
    path("history/",AssessmentHistoryView.as_view()),

path("history/<uuid:assessment_id>/",AssessmentMarksView.as_view()),
]
