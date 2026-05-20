from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InstructorViewSet

router = DefaultRouter()
# Support both 'profiles/' (used by coordinatorService.ts) 
# and 'instructor/' (used by studentInstructorService.ts)
router.register(r'profiles', InstructorViewSet, basename='instructor-profiles')
router.register(r'instructor', InstructorViewSet, basename='instructor-legacy')

urlpatterns = [
    path('', include(router.urls)),
]
