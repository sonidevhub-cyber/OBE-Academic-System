from django.urls import path

from .views import (
    JSCUserListCreateView,
    JSCUserPermissionsView,
    JSCUserStatusView,
    MyRBACProfileView,
    RBACPermissionListView,
)


urlpatterns = [
    path('me/', MyRBACProfileView.as_view(), name='rbac-me'),
    path('permissions/', RBACPermissionListView.as_view(), name='rbac-permissions'),
    path('jsc-users/', JSCUserListCreateView.as_view(), name='rbac-jsc-users'),
    path('jsc-users/<int:user_id>/status/', JSCUserStatusView.as_view(), name='rbac-jsc-user-status'),
    path('jsc-users/<int:user_id>/permissions/', JSCUserPermissionsView.as_view(), name='rbac-jsc-user-permissions'),
]
