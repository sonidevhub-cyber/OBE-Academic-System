from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InstructorViewSet, InstructorProfileView, InstructorDashboardDataView, AttendanceReportsView, HODRecordsView
from .timetable_views import instructor_timetable, debug_instructor_mapping, current_user_info
from .course_views import InstructorCourseViewSet
router = DefaultRouter()
router.register(r'instructor', InstructorViewSet)
router.register(r'courses', InstructorCourseViewSet, basename='instructor-courses')

urlpatterns = [
    path('', include(router.urls)),
    path('profile/', InstructorProfileView.as_view(), name='instructor-profile'),
    path('dashboard-data/', InstructorDashboardDataView.as_view(), name='instructor-dashboard-data'),
    path('hods/', HODRecordsView.as_view(), name='hod-records'),
    path('timetable/', instructor_timetable, name='instructor-timetable'),
    path('debug-mapping/', debug_instructor_mapping, name='debug-instructor-mapping'),
    path('current-user/', current_user_info, name='current-user-info'),
]
