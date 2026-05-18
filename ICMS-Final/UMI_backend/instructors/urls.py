from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InstructorViewSet

router = DefaultRouter()
router.register(r'instructor', InstructorViewSet, basename='instructor')

urlpatterns = [
    path('', include(router.urls)),
]