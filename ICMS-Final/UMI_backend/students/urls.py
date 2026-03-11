from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StudentViewSet, StudentProfileView, student_department_filter
from .analytics_views import student_analytics_dashboard, department_analytics, course_analytics
from django.views.generic import RedirectView

router = DefaultRouter()
router.register(r'', StudentViewSet, basename='student')

urlpatterns = [
    # ✅ profile pehle likho
    path('profile/', StudentProfileView.as_view(), name='student-profile'),
    path('department-filter/', student_department_filter, name='student-department-filter'),
    
    # ✅ Analytics endpoints
    path('analytics/dashboard/', student_analytics_dashboard, name='student-analytics-dashboard'),
    path('analytics/department/', department_analytics, name='department-analytics'),
    path('analytics/courses/', course_analytics, name='course-analytics'),
    
    # Temporary redirects for old feedback URLs
    path('feedback/submit/', RedirectView.as_view(url='/api/feedback/submit/', permanent=True)),
    path('feedback/department/', RedirectView.as_view(url='/api/feedback/department/', permanent=True)),
    path('feedback/notifications/', RedirectView.as_view(url='/api/feedback/notifications/', permanent=True)),

    # ✅ baad me router include karo
    path('', include(router.urls)),
]