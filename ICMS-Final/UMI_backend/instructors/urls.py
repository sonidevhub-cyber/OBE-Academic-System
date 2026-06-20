from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InstructorViewSet

router = DefaultRouter()

router = DefaultRouter()
router.register(r'', InstructorViewSet, basename='instructor')

# ✅ CLEAN & STANDARD ROUTE
router.register(r'', InstructorViewSet, basename='instructors')

urlpatterns = [
    path('', include(router.urls)),
]