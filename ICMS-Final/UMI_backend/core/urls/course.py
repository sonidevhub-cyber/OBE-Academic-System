from django.urls import path

from core.views.course import CourseListCreateView

urlpatterns = [
    path('', CourseListCreateView.as_view(), name='course-list-create'),
    path('add/', CourseListCreateView.as_view(), name='course-add'),
    # Edit/delete endpoints not implemented yet in this step
]

