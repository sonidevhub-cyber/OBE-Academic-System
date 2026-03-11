from django.urls import path, include
from .views import (
    StudentResultListCreateEnhanced,
    DepartmentCourseResultsView,
    DepartmentCoursesView,
    StudentPromotionActionView,
    DepartmentSemestersView,
)
from .viewsets import DepartmentViewSet, SemesterViewSet, CourseViewSet
from rest_framework.routers import DefaultRouter

# =============================
# Router for Department, Semester, and Course ViewSets
# =============================
router = DefaultRouter()
router.register(r'departments', DepartmentViewSet)
router.register(r'semesters', SemesterViewSet)
router.register(r'courses', CourseViewSet)

# =============================
# URL Patterns
# =============================
urlpatterns = [
    # Register router endpoints
    path('', include(router.urls)),

    # Student Result Management (Enhanced endpoints)
    path(
        "students/<int:student_id>/results/professional/",
        StudentResultListCreateEnhanced.as_view(),
        name="student-results-enhanced"
    ),

    # Department-wise specific course result endpoint
    path(
        "departments/<int:department_id>/courses/<int:course_id>/results/professional/",
        DepartmentCourseResultsView.as_view(),
        name="department-course-results"
    ),

    # Student promotion (Auto semester upgrade endpoint)
    path(
        "students/<int:student_id>/promotion/professional/",
        StudentPromotionActionView.as_view(),
        name="student-promotion"
    ),

    # Department courses listing endpoint
    path(
        "departments/<int:department_id>/courses/",
        DepartmentCoursesView.as_view(),
        name="department-courses"
    ),
    path(
    "departments/<int:department_id>/semesters/",
    DepartmentSemestersView.as_view(),
    name="department-semesters"
),
]