from django.urls import path

from core.views.promotion import MarkAsRepeatView, ProvisionalPromoteAllView, PendingTransfersView

urlpatterns = [
    path(
        'api/programs/<uuid:program_id>/batches/<uuid:batch_id>/promote-all/',
        ProvisionalPromoteAllView.as_view(),
        name='promote-all',
    ),
    path(
        'api/programs/<uuid:program_id>/batches/<uuid:batch_id>/students/<uuid:student_id>/repeat/',
        MarkAsRepeatView.as_view(),
        name='mark-repeat',
    ),
    path(
        'students/pending-transfers/',
        PendingTransfersView.as_view(),
        name='pending-transfers',
    ),
]