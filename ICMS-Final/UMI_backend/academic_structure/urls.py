from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import ProgramViewSet, BatchViewSet, BatchDetailView, AllBatchesView

router = DefaultRouter()
router.register(r'programs', ProgramViewSet)
router.register(r'batches', BatchViewSet)

urlpatterns = [
    path('', include(router.urls)),

    # Used by Student/Admin "batches not fetch correctly" dropdowns.
    # Returns a simple array: [{id,name,program_name,...}]
    path('all/', AllBatchesView.as_view(), name='all-batches'),


    path('batches/<uuid:pk>/detail/', BatchDetailView.as_view(), name='batch-detail'),
]

