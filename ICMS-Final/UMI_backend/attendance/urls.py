from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views, reports_views, enhanced_views, flow_views

router = DefaultRouter()
router.register(r'attendance', views.AttendanceViewSet, basename='attendance')

urlpatterns = [
    path('api/', include(router.urls)),
    
    # Instructor attendance marking
    path('api/mark-class-attendance/', views.mark_class_attendance, name='mark_class_attendance'),
    path('api/instructor-classes/', views.get_instructor_classes, name='instructor_classes'),
    
    # Faculty self attendance
    path('api/mark-self-attendance/', views.mark_self_attendance, name='mark_self_attendance'),
    path('api/faculty-attendance-summary/', views.get_faculty_attendance_summary, name='faculty_attendance_summary'),
    
    # Attendance reports
    path('api/attendance-reports/', views.get_attendance_reports, name='attendance_reports'),
    path('api/department-attendance-summary/', views.get_department_attendance_summary, name='department_attendance_summary'),
    
    # Enhanced attendance reports for coordinators/HODs
    path('api/department-reports/', reports_views.get_department_attendance_reports, name='department_attendance_reports'),
    path('api/student-attendance-details/', reports_views.get_student_attendance_details, name='student_attendance_details'),
    path('api/faculty-attendance-details/', reports_views.get_faculty_attendance_details, name='faculty_attendance_details'),
    
    # Edit requests
    path('api/request-attendance-edit/', views.request_attendance_edit, name='request_attendance_edit'),
    path('api/manage-edit-requests/', views.manage_edit_requests, name='manage_edit_requests'),
    
    # Enhanced attendance features
    path('api/bulk-mark-attendance/', enhanced_views.bulk_mark_attendance, name='bulk_mark_attendance'),
    path('api/attendance-analytics/', enhanced_views.get_attendance_analytics, name='attendance_analytics'),
    path('api/attendance-alerts/', enhanced_views.get_attendance_alerts, name='attendance_alerts'),
    path('api/resolve-alert/<int:alert_id>/', enhanced_views.resolve_attendance_alert, name='resolve_attendance_alert'),
    path('api/attendance-settings/', enhanced_views.attendance_settings, name='attendance_settings'),
    path('api/bulk-sessions/', enhanced_views.get_bulk_attendance_sessions, name='bulk_attendance_sessions'),

    # Professional role-based attendance flow (direct paths)
    path('instructor/classes/', flow_views.instructor_classes, name='instructor_classes_professional'),
    path('mark-class/', flow_views.mark_class, name='mark_class_professional'),
    path('instructor/request-update/', flow_views.request_attendance_update, name='request_attendance_update'),
    path('instructor/update-requests/', flow_views.instructor_update_requests, name='instructor_update_requests'),
    path('admin/update-requests/', flow_views.admin_update_requests, name='admin_update_requests'),
    path('student/overview/', flow_views.student_overview, name='student_overview'),
    path('coordinator/overview/', flow_views.coordinator_overview, name='coordinator_overview'),
    path('coordinator/courses/', flow_views.coordinator_courses, name='coordinator_courses'),
    path('coordinator/faculty/', flow_views.coordinator_faculty, name='coordinator_faculty'),
    path('hod/stats/', flow_views.hod_stats, name='hod_stats'),
    path('hod/courses/', flow_views.hod_courses, name='hod_courses'),
    path('hod/requests/', flow_views.hod_requests, name='hod_requests'),
    path('principal/overview/', flow_views.principal_overview, name='principal_overview'),
    path('principal/departments/', flow_views.principal_departments, name='principal_departments'),
    path('principal/performers/', flow_views.principal_performers, name='principal_performers'),
    path('principal/insights/', flow_views.principal_insights, name='principal_insights'),
]
