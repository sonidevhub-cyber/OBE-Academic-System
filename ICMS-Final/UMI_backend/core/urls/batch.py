from django.urls import path

from core.views.batch import (
    AllBatchesView,
    BatchDeactivateView,
    BatchDetailView,
    BatchListCreateView,
    BatchStudentListView,
    GraduateBatchView,
)
from core.views.promotion import MarkAsRepeatView, ProvisionalPromoteAllView

urlpatterns = [
    path('', BatchListCreateView.as_view(), name='batch-list-create'),
    path('<uuid:pk>/', BatchDetailView.as_view(), name='batch-detail'),
    path('<uuid:pk>/students/', BatchStudentListView.as_view(), name='batch-students'),
    path('<uuid:batch_id>/promote-all/', ProvisionalPromoteAllView.as_view(), name='promote-all'),
    path('<uuid:batch_id>/students/<uuid:student_id>/repeat/', MarkAsRepeatView.as_view(), name='mark-repeat'),
    path('<uuid:pk>/graduate/', GraduateBatchView.as_view(), name='batch-graduate'),
    path('<uuid:pk>/delete/', BatchDeactivateView.as_view(), name='batch-deactivate'),
    path('batches/all/', AllBatchesView.as_view(), name='batches-all'),
]