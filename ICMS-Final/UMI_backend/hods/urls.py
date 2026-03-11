from django.urls import path
from .views import (
    hod_profile, hod_dashboard
)
from .management_views import (
    HODRecordDetailView, HODRecordListView, HODDepartmentListView, 
    HODStatsView, CreateHODFromRequestView, HODRetireView, HODRetiredListView
)
from .timetable_views import HODTimetableView, delete_timetable, HODTimetableApprovalView
from django.http import JsonResponse

def test_hod_endpoint(request):
    return JsonResponse({'message': 'HOD endpoint working'})

urlpatterns = [
    # Test endpoint
    path('test/', test_hod_endpoint, name='hod-test'),
    # HOD Dashboard
    path('dashboard/', hod_dashboard, name='hod-dashboard'),
    # HOD Profile
    path('profile/', hod_profile, name='hod-profile'),
    
    # NOTE: HOD self-registration / registration requests endpoints removed.
    # Admin will manage HODs via the admin record endpoints below.
    
    # HOD Record Management (Admin API)
    path('admin/records/', HODRecordListView.as_view(), name='admin-hod-records'),
    path('admin/records/<int:pk>/', HODRecordDetailView.as_view(), name='admin-hod-record-detail'),
    path('admin/departments/', HODDepartmentListView.as_view(), name='admin-hod-departments'),
    path('admin/stats/', HODStatsView.as_view(), name='admin-hod-stats'),
    path('admin/create-from-request/', CreateHODFromRequestView.as_view(), name='create-hod-from-request'),
    path('admin/records/<int:pk>/retire/', HODRetireView.as_view(), name='retire-hod'),
    path('admin/retired/', HODRetiredListView.as_view(), name='admin-retired-hods'),
    
    # HOD Timetable Management
    path('timetable/', HODTimetableView.as_view(), name='hod-timetable'),
    path('timetable/<int:timetable_id>/', delete_timetable, name='hod-timetable-delete'),
    path('timetable/approvals/', HODTimetableApprovalView.as_view(), name='hod-timetable-approvals'),
    path('timetable-proposals/', HODTimetableApprovalView.as_view(), name='hod-timetable-proposals'),
]