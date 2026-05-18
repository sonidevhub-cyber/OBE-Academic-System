from django.urls import path
from .views import login, update_profile, admin_dashboard_cards, available_roles, switch_active_role
from .password_reset_views import confirm_password_reset, request_password_reset

urlpatterns = [
    path('login/', login, name='login'),                     # POST login
    path('available-roles/', available_roles, name='available-roles'),
    path('switch-active-role/', switch_active_role, name='switch-active-role'),
    path('password-reset-request/', request_password_reset, name='password-reset-request'),
    path('password-reset-otp/', request_password_reset, name='password-reset-otp'),
    path('password-reset-confirm/', confirm_password_reset, name='password-reset-confirm'),
    path('password-reset-confirm-otp/', confirm_password_reset, name='password-reset-confirm-otp'),
    path('reset-password-with-otp/', confirm_password_reset, name='reset-password-with-otp'),
    path('users/profile/update/', update_profile, name='update-profile'),
    path('admin/dashboard-cards/', admin_dashboard_cards, name='admin-dashboard-cards'),
]
