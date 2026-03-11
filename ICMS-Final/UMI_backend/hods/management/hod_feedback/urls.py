from django.urls import path
from . import views

urlpatterns = [
    path("allow/", views.allow_feedback),
    path("disable/", views.disable_feedback),
    path("status/<int:department_id>/", views.check_feedback_status),

    path("list/", views.hod_all_feedback),
    path("analytics/", views.feedback_analytics),
]