from django.urls import path

from core.views.course import CourseListCreateView, CourseDetailView

urlpatterns = [
    path('', CourseListCreateView.as_view(), name='course-list-create'),
    path('add/', CourseListCreateView.as_view(), name='course-add'),
    path('<uuid:pk>/', CourseDetailView.as_view(), name='course-detail'),
]

