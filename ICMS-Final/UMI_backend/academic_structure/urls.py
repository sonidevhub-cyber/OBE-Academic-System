from django.urls import path, include
from rest_framework.routers import DefaultRouter
<<<<<<< HEAD
from .views import ProgramViewSet, BatchViewSet, BatchDetailView

router = DefaultRouter()
# Programs are now primarily handled by core.urls.program
# But we keep it here if any legacy code still uses api/batches/programs/
router.register(r'programs', ProgramViewSet)
router.register(r'batches', BatchViewSet)

# For compatibility with frontend expecting api/batches/ and api/batches/all/
urlpatterns = [
    # Router handles api/batches/programs/ and api/batches/batches/
    path('', include(router.urls)),
    
    # Direct paths for frontend expectations
    path('all/', BatchViewSet.as_view({'get': 'list'}), name='all-batches'),
    path('<uuid:pk>/detail/', BatchDetailView.as_view(), name='batch-detail'),
]

# Add a redirect or extra path for api/batches/ directly
urlpatterns += [
    path('', BatchViewSet.as_view({'get': 'list'}), name='batch-root-list'),
]
=======

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

>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
