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
<<<<<<< HEAD
        'api/students/pending-transfers/',
=======
        'students/pending-transfers/',
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
        PendingTransfersView.as_view(),
        name='pending-transfers',
    ),
]