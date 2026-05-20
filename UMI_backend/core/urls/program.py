from django.urls import path, include

from core.views.program import ProgramDeleteView, ProgramDetailView, ProgramListCreateView

urlpatterns = [
    path('', ProgramListCreateView.as_view(), name='program-list-create'),
    path('<uuid:pk>/', ProgramDetailView.as_view(), name='program-detail'),
    path('<uuid:pk>/delete/', ProgramDeleteView.as_view(), name='program-delete'),
    path('<uuid:program_id>/batches/', include('core.urls.batch')),
]

