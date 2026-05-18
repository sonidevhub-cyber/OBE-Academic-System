from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SemesterViewSet, CourseViewSet, course_allocations

router = DefaultRouter()
router.register(r'semesters', SemesterViewSet)
router.register(r'courses', CourseViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('course-allocations/', course_allocations, name='course_allocations_list'),
]
