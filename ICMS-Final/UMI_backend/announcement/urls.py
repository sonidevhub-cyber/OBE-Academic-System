from django.urls import path
from .views import AnnouncementListCreateView, AnnouncementDetailView,AnnouncementListCreateView,AnnouncementDetailView

urlpatterns = [
    path('', AnnouncementListCreateView.as_view(), name='announcement-list-create'),
    path('<uuid:pk>/', AnnouncementDetailView.as_view(), name='announcement-detail'),
    path('announcements/', AnnouncementListCreateView.as_view()),
    path('announcements/<uuid:pk>/', AnnouncementDetailView.as_view()),
]
