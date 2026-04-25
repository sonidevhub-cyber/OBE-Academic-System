from django.urls import path, include
from .views import (
    
    StudentResultListCreateEnhanced,
    DepartmentCourseResultsView,
    DepartmentCoursesView,
    StudentPromotionActionView,
)
from students.views import StudentDashboardView
from .viewsets import DepartmentViewSet, SemesterViewSet, CourseViewSet
from .datesheet_views import DateSheetViewSet, StudentEligibilityViewSet, DateSheetNotificationViewSet
from .hod_views import HODTimetableView, HODDashboardView, HODAnalyticsView
from .class_management_views import ClassFormDataView, FilteredDataView
from .simple_data_view import SimpleDataView
from attendance.views import (
    get_instructor_classes,
    mark_class_attendance,
    mark_self_attendance,
    get_faculty_attendance_summary,
    get_attendance_reports,
    get_department_attendance_summary,
    request_attendance_edit,
    manage_edit_requests
)
from attendance.reports_views import (
    get_department_attendance_reports,
    get_student_attendance_details,
    get_faculty_attendance_details
)
from attendance.enhanced_views import (
    bulk_mark_attendance,
    get_attendance_analytics,
    get_attendance_alerts,
    resolve_attendance_alert,
    attendance_settings,
    get_bulk_attendance_sessions
)
from .test_views import TestHODView
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'departments', DepartmentViewSet)
router.register(r'semesters', SemesterViewSet)
router.register(r'courses', CourseViewSet)
router.register(r'datesheets', DateSheetViewSet, basename='datesheet')
router.register(r'datesheet-eligibility', StudentEligibilityViewSet, basename='datesheet-eligibility')
router.register(r'datesheet-notifications', DateSheetNotificationViewSet, basename='datesheet-notifications')

urlpatterns = [
    path('', include(router.urls)),

    # Enhanced result management endpoints
    path("students/<str:student_id>/results/professional/", StudentResultListCreateEnhanced.as_view()),
    path("departments/<int:department_id>/courses/<int:course_id>/results/professional/", DepartmentCourseResultsView.as_view()),

    # Promotion endpoint
    path("students/<str:student_id>/promotion/professional/", StudentPromotionActionView.as_view()),

    # Department courses endpoint
    path("departments/<int:department_id>/courses/", DepartmentCoursesView.as_view()),

    # Student dashboard
    path("dashboard/<str:student_id>/", StudentDashboardView, name="student-dashboard"),
    
    # HOD Dashboard and Timetable
    path("hod/test/", TestHODView.as_view(), name="hod-test"),
    path("hod/dashboard/", HODDashboardView.as_view(), name="hod-dashboard"),
    path("hod/analytics/", HODAnalyticsView.as_view(), name="hod-analytics"),
    path("hod/timetable/", HODTimetableView.as_view(), name="hod-timetable"),
    path("hod/timetable/<int:timetable_id>/", HODTimetableView.as_view(), name="hod-timetable-detail"),
    
    # Class management
    path("class/form-data/", ClassFormDataView.as_view(), name="class-form-data"),
    path("class/filtered-data/", FilteredDataView.as_view(), name="filtered-data"),
    path("data/", SimpleDataView.as_view(), name="simple-data"),
    

]
