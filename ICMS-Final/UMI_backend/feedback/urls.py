from django.urls import path
from .views import (
    submit_feedback, 
    get_department_feedback, 
    mark_feedback_reviewed, 
    get_hod_notifications, 
    mark_notification_read
)

urlpatterns = [
    path('submit/', submit_feedback, name='submit-feedback'),
    path('department/', get_department_feedback, name='get-department-feedback'),
    path('<int:feedback_id>/reviewed/', mark_feedback_reviewed, name='mark-feedback-reviewed'),
    path('notifications/', get_hod_notifications, name='get-hod-notifications'),
    path('notifications/<int:notification_id>/read/', mark_notification_read, name='mark-notification-read'),
]