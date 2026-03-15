from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views.assessment_views import (
    AssessmentCLOMappingViewSet,
    AssessmentViewSet,
    StudentAssessmentViewSet,
)
from .views.clo_views import CLOGAMappingViewSet, CLOViewSet
from .views.ga_views import GraduateAttributeViewSet
from .views.lookup_views import clos_by_course, courses_by_semester, semesters_by_department
from .views.report_views import marksheet_report

router = DefaultRouter()
router.register(r"assessments", AssessmentViewSet, basename="obe-assessments")
router.register(r"assessment-clo-mappings", AssessmentCLOMappingViewSet, basename="obe-assessment-clo-mappings")
router.register(r"student-assessments", StudentAssessmentViewSet, basename="obe-student-assessments")
router.register(r"clos", CLOViewSet, basename="obe-clos")
router.register(r"graduate-attributes", GraduateAttributeViewSet, basename="obe-graduate-attributes")
router.register(r"clo-ga-mappings", CLOGAMappingViewSet, basename="obe-clo-ga-mappings")

urlpatterns = [
    path("", include(router.urls)),
    path("semesters-by-department/", semesters_by_department),
    path("courses-by-semester/", courses_by_semester),
    path("clos-by-course/", clos_by_course),
    path("reports/marksheet/", marksheet_report),
]
