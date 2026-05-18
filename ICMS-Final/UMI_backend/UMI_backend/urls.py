from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static


from academics import views as academics_views

urlpatterns = [
    path('admin/', admin.site.urls),
]


urlpatterns += [
    # CORE MODULES (ONE TIME ONLY)
    path('api/auth/', include('register.urls')),
    path('api/users/', include('core.urls.user')),
    path('api/batches/', include('academic_structure.urls')),
    path('api/programs/', include('core.urls.program')),
    path('api/courses/', include('core.urls.course')),
    path('api/students/', include('students.urls')),
    # Mount promotion/pending-transfer endpoints without the extra nested `api/`
    path('api/', include('core.urls.promotion')),

    path('api/instructors/', include('instructors.urls')),

    # FEATURE MODULES
    path('api/academics/', include('academics.urls')),
    path('api/announcements/', include('announcement.urls')),
    path('api/feedback/', include('feedback.urls')),
    path('api/obe/', include('obe.urls')),
    path('api/monitoring/', include('monitoring.urls')),
    path('api/admin/', include('admin_management.urls')),

    # SPECIAL ENDPOINTS
    path('api/coordinators/course-allocations/', academics_views.course_allocations),
]

# NOTE:
# Frontend hits endpoints under /api/* (axiosInstance baseURL is /api/).
# core_root_urlpatterns currently lives at the project root (mounted below with path('', ...)).
# To avoid 404s for frontend-expected endpoints like /api/batches/all/ and /api/students/pending-transfers/,
# we explicitly mount those exact patterns under the /api/ prefix.
#
# This prevents the need to rely on the root-level include.


if settings.DEBUG:

    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

