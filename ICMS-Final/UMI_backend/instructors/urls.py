from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InstructorViewSet

router = DefaultRouter()
# Support both 'profiles/' (used by coordinatorService.ts) 
# and 'instructor/' (used by studentInstructorService.ts)
router = DefaultRouter()
router.register(r'', InstructorViewSet, basename='instructor')

urlpatterns = [
    path('', include(router.urls)),
]
