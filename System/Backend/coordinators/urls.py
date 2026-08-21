from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TeacherAllocationViewSet

router = DefaultRouter()
router.register(r'', TeacherAllocationViewSet, basename='teacher-allocation')

urlpatterns = [
    path('', include(router.urls)),
]
