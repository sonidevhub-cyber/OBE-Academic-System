from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.response import Response
from .views import (
    register, login, UserDetailView, UserListView,approve_principal, admin_dashboard_cards, get_registrations, get_user_registrations, register_principal,
    list_hod_records, create_hod, get_departments, check_department_hod, edit_hod, retire_hod, reactivate_hod, get_retired_hods
)
from .admin_views import AdminViewSet, PrincipalViewSet
from .multi_role_views import switch_role, get_user_roles, enable_instructor_role, setup_multi_role_system
from .role_views import get_user_roles as get_available_roles, switch_role as switch_active_role

router = DefaultRouter()
router.register(r'admins', AdminViewSet, basename='admin')
router.register(r'principals', PrincipalViewSet, basename='principal')

urlpatterns = [
    path('registration/', register, name='register'),       # POST only
    path('registrations/', get_user_registrations, name='get-registrations'),  # GET registrations
    path('login/', login, name='login'),                     # POST login
    path('test/', lambda request: Response({'message': 'Test endpoint works'}), name='test'),
    path('users/', UserListView.as_view(), name='user-list'),      # GET all users
    path('users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),  # GET/PUT/DELETE
    
    # Multi-role management
    path('switch-role/', switch_role, name='switch-role'),
    path('user-roles/', get_user_roles, name='user-roles'),
    path('enable-instructor-role/', enable_instructor_role, name='enable-instructor-role'),
    path('setup-multi-role/', setup_multi_role_system, name='setup-multi-role'),
    
    # New role switching system
    path('available-roles/', get_available_roles, name='available-roles'),
    path('switch-active-role/', switch_active_role, name='switch-active-role'),
    
    # Admin Dashboard
    path('admin/dashboard-cards/', admin_dashboard_cards, name='admin-dashboard-cards'),
    
    # HOD Management Admin Endpoints (with trailing slashes)
    path('admin/hod-records/', list_hod_records, name='admin-hod-records'),
    path('admin/create-hod/', create_hod, name='admin-create-hod'),
    path('admin/hod-departments/', get_departments, name='admin-hod-departments'),
    path('admin/check-department-hod/', check_department_hod, name='check-department-hod'),
    path('admin/hod/<int:hod_id>/edit/', edit_hod, name='edit-hod'),
    path('admin/hod/<int:hod_id>/retire/', retire_hod, name='retire-hod'),
    path('admin/hod/<int:hod_id>/reactivate/', reactivate_hod, name='reactivate-hod'),
    path('admin/retired-hods/', get_retired_hods, name='retired-hods'),
    
    # Admin Management API
    path('', include(router.urls)),
    
    
]