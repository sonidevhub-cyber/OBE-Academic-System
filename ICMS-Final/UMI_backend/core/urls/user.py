from django.urls import path
from core.views.user import UserDeactivateView, UserDetailUpdateView, UserListCreateView

urlpatterns = [
    path('', UserListCreateView.as_view(), name='user-list-create'),
    path('<uuid:pk>/', UserDetailUpdateView.as_view(), name='user-detail-update'),
    path('<uuid:pk>/deactivate/', UserDeactivateView.as_view(), name='user-deactivate'),
]