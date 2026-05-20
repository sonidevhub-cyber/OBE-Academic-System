from django.urls import path, include
from rest_framework.routers import DefaultRouter
<<<<<<< HEAD
from .views import SemesterViewSet, CourseViewSet

=======
from .views import SemesterViewSet, CourseViewSet, course_allocations
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03

router = DefaultRouter()
router.register(r'semesters', SemesterViewSet)
router.register(r'courses', CourseViewSet)

urlpatterns = [
    path('', include(router.urls)),
<<<<<<< HEAD
]

=======
    path('course-allocations/', course_allocations, name='course_allocations_list'),
]
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
