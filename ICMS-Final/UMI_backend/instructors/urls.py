from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InstructorViewSet

router = DefaultRouter()
<<<<<<< HEAD
# Support both 'profiles/' (used by coordinatorService.ts) 
# and 'instructor/' (used by studentInstructorService.ts)
router.register(r'profiles', InstructorViewSet, basename='instructor-profiles')
router.register(r'instructor', InstructorViewSet, basename='instructor-legacy')

urlpatterns = [
    path('', include(router.urls)),
]
=======
router.register(r'instructor', InstructorViewSet, basename='instructor')

urlpatterns = [
    path('', include(router.urls)),
]
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
