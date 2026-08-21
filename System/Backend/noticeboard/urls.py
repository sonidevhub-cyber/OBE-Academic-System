from django.urls import path
from .views import CreateNoticeView, NoticeBoardView

urlpatterns = [
    path('create/', CreateNoticeView.as_view()),
    path('', NoticeBoardView.as_view()),
]