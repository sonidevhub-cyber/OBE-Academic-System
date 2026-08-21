from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    CurriculumVersionViewSet,
    CurriculumVersionCourseViewSet,
)


router = DefaultRouter()

router.register(
    r'',
    CurriculumVersionViewSet,
    basename='curriculum-version'
)


# ============================================================
# NESTED COURSE ROUTES
# ============================================================

version_courses_list = (
    CurriculumVersionCourseViewSet.as_view({
        'get': 'list',
        'post': 'create',
    })
)

version_courses_detail = (
    CurriculumVersionCourseViewSet.as_view({
        'get': 'retrieve',
        'patch': 'partial_update',
        'delete': 'destroy',
    })
)


urlpatterns = [

    # Curriculum Version routes
    path(
        '',
        include(router.urls)
    ),

    # Courses of a specific curriculum version
    path(
        '<int:version_pk>/courses/',
        version_courses_list,
        name='version-courses-list'
    ),

    path(
        '<int:version_pk>/courses/<int:pk>/',
        version_courses_detail,
        name='version-courses-detail'
    ),
]