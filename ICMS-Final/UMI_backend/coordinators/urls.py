from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CoordinatorViewSet, TimetableProposalViewSet, TimetableSlotViewSet,
    CourseAllocationViewSet, CoordinatorDashboardViewSet
)
from .hod_management_views import HODCoordinatorManagementViewSet
from .professional_dashboard_views import CoordinatorProfessionalDashboardViewSet

router = DefaultRouter()
router.register(r'coordinators', CoordinatorViewSet)
router.register(r'timetable-proposals', TimetableProposalViewSet)
router.register(r'timetable-slots', TimetableSlotViewSet)
router.register(r'course-allocations', CourseAllocationViewSet)
router.register(r'dashboard', CoordinatorDashboardViewSet)
router.register(r'hod-management', HODCoordinatorManagementViewSet, basename='hod-coordinator-management')
router.register(r'professional-dashboard', CoordinatorProfessionalDashboardViewSet, basename='coordinator-professional-dashboard')

urlpatterns = [
    path('', include(router.urls)),
    path('timetable-proposals/<int:pk>/approve/', TimetableProposalViewSet.as_view({'post': 'approve_proposal'}), name='approve-timetable-proposal'),
    path('timetable-proposals/<int:pk>/reject/', TimetableProposalViewSet.as_view({'post': 'reject_proposal'}), name='reject-timetable-proposal'),
]