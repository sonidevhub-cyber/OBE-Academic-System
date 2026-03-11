from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AdminViewSet

router = DefaultRouter()
router.register(r'admins', AdminViewSet, basename='admin')

urlpatterns = [
    path('', include(router.urls)),
    path('profile/', AdminViewSet.as_view({'get': 'profile'}), name='admin-profile'),
    path('pending-registrations/', AdminViewSet.as_view({'get': 'pending_registrations'}), name='pending-registrations'),
    path('admins/<int:pk>/soft_delete/', AdminViewSet.as_view({'delete': 'soft_delete'}), name='admin-soft-delete'),
]