from django.urls import path
from . import views

urlpatterns = [
    path('groups/', views.ElectiveGroupListCreateView.as_view(), name='elective-group-list-create'),
    path('groups/<uuid:pk>/', views.ElectiveGroupDetailView.as_view(), name='elective-group-detail'),

    path('selective-groups/', views.SelectiveGroupListCreateView.as_view(), name='selective-group-list-create'),
    path('selective-groups/<uuid:pk>/', views.SelectiveGroupDetailView.as_view(), name='selective-group-detail'),

    path('eligibility-rules/', views.EligibilityRuleCreateView.as_view(), name='eligibility-rule-list-create'),

    path('courses/choices/', views.ElectiveCoursesView.as_view(), name='elective-courses-choices'),
    path('courses/', views.ElectiveCoursesView.as_view(), name='elective-courses-list'),

    path('students/enroll/', views.StudentElectiveEnrollView.as_view(), name='student-elective-enroll'),
    path('students/my-enrollments/', views.MyElectiveEnrollmentsView.as_view(), name='my-elective-enrollments'),

    path('sac/enrollments/', views.SACElectiveEnrollmentsView.as_view(), name='sac-elective-enrollments'),
    path('sac/assign/', views.SACAssignView.as_view(), name='sac-assign'),
    path('sac/window/open/', views.ElectiveWindowOpenView.as_view(), name='elective-window-open'),
    path('sac/window/lock/', views.ElectiveWindowLockView.as_view(), name='elective-window-lock'),
    path('sac/window/lock-electives/', views.ElectiveOnlyWindowLockView.as_view(), name='elective-only-window-lock'),
    path('sac/windows/', views.ElectiveWindowListView.as_view(), name='elective-window-list'),
]
