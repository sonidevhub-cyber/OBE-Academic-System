from django.urls import include, path

# IMPORTANT:
# This project has a `core/urls/` package containing auth/user/program/etc.
# Do NOT import from `core.urls` as a module.

from core.views.batch import AllBatchesView, BatchDossierListView
from core.views.promotion import PendingTransfersView, EligibleBatchesView, TransferStudentView, FailFrozenStudentView
from core.views.user import UserListCreateView

urlpatterns = [
    # Existing non-api routes (keep as-is)
    path('auth/', include('core.urls.auth')),
    path('users/', include('core.urls.user')),
    path('programs/', include('core.urls.program')),
    path('courses/', include('core.urls.course')),
    path('batches/', include('core.urls.batch')),
    path('programs/', include('core.urls.promotion')),

    # FIX required endpoints expected by frontend (mount directly to exact paths)
    path('batches/all/', AllBatchesView.as_view()),
    path('batches/dossier-list/', BatchDossierListView.as_view()),
    path('students/pending-transfers/', PendingTransfersView.as_view()),
    path('students/<uuid:pk>/eligible-batches/', EligibleBatchesView.as_view()),
    path('students/<uuid:pk>/transfer/', TransferStudentView.as_view()),
    path('students/<uuid:pk>/fail-drop/', FailFrozenStudentView.as_view()),

    # Your core.urls.user mounts list at '' (not 'users/'), but UMI_backend/UMI_backend/urls.py mounts this module at 'api/'.
    # So the correct route becomes: /api/users/ -> '' path in core/urls/user.py.
    path('api/users/', include('core.urls.user')),

]
