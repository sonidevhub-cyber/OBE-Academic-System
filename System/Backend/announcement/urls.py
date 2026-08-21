from django.urls import path
from .views import AnnouncementListCreateView, AnnouncementDetailView

urlpatterns = [
    path('', AnnouncementListCreateView.as_view(), name='announcement-list-create'),
    path('<uuid:pk>/', AnnouncementDetailView.as_view(), name='announcement-detail'),
]
