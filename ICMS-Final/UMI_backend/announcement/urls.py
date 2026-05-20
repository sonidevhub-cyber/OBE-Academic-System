from django.urls import path
<<<<<<< HEAD
from .views import AnnouncementListCreateView, AnnouncementDetailView
=======
from .views import AnnouncementListCreateView, AnnouncementDetailView,AnnouncementListCreateView,AnnouncementDetailView
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03

urlpatterns = [
    path('', AnnouncementListCreateView.as_view(), name='announcement-list-create'),
    path('<uuid:pk>/', AnnouncementDetailView.as_view(), name='announcement-detail'),
<<<<<<< HEAD
=======
    path('announcements/', AnnouncementListCreateView.as_view()),
    path('announcements/<uuid:pk>/', AnnouncementDetailView.as_view()),
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
]
