# feedback/urls.py

from django.urls import path
from .views import (
    EnableFeedbackView,
    CheckFeedbackStatus,
    GetFeedbackQuestions,
    IndirectCLOReportView,
    SubmitFeedbackView,
    CoordinatorBatchesView,NextBatchCQI,ApplyCQIToNextBatch,
    CompareView,DisableFeedbackView,HODBatchesView,CreateFeedbackCQI
)

urlpatterns = [
    path('enable/', EnableFeedbackView.as_view()),
    path('status/', CheckFeedbackStatus.as_view()),
    path('questions/', GetFeedbackQuestions.as_view()),
    path('submit/', SubmitFeedbackView.as_view()),
    path('compare/', CompareView.as_view()),
    path("create-cqi/",CreateFeedbackCQI.as_view()),
    path("next-batch-cqi/",NextBatchCQI.as_view()),
    path("apply-cqi/",ApplyCQIToNextBatch.as_view()),
    path('disable/', DisableFeedbackView.as_view()),
    path("hod/batches/", HODBatchesView.as_view()),
    path("coordinator-batches/", CoordinatorBatchesView.as_view()),
    path("indirect-report/", IndirectCLOReportView.as_view()),
]