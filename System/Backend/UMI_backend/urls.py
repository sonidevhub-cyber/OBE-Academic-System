from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from core.root_urls import urlpatterns as core_root_urlpatterns
from core.views.batch import BatchSemesterSelectorView

from academics import views as academics_views

urlpatterns = [
    path('admin/', admin.site.urls),
]

# Move core special endpoints to the TOP to avoid being shadowed by routers
for p in core_root_urlpatterns:
    if hasattr(p, 'callback') and callable(p.callback):
        urlpatterns.append(path('api/' + str(p.pattern), p.callback, name=getattr(p, 'name', None)))

urlpatterns += [
    # CORE MODULES (ONE TIME ONLY)
    path('api/register/', include('register.urls')),
    path('api/auth/', include('register.urls')),
    path('api/users/', include('core.urls.user')),
    path('api/batches/<uuid:batch_id>/semesters/', BatchSemesterSelectorView.as_view(), name='api-batch-semesters'),
    path('api/batches/', include('academic_structure.urls')),
    path('api/programs/', include('core.urls.program')),
    path('api/courses/', include('core.urls.course')),
    path('api/students/', include('students.urls')),
    path('api/instructors/', include('instructors.urls')),

    # FEATURE MODULES
    path('api/academics/', include('academics.urls')),
    path('api/announcements/', include('announcement.urls')),
    path('api/feedback/', include('feedback.urls')),
    path('api/obe/', include('obe.urls')),
    path('api/monitoring/', include('monitoring.urls')),
    path('api/admin/', include('admin_management.urls')),
    path('api/coordinators/', include('coordinators.urls')),
    path('api/hods/', include('coordinators.urls')),
    path('api/curriculum-versions/', include('curriculum.urls')),
    path('api/assessments/', include('assessments.urls')),
    path('api/noticeboard/', include('noticeboard.urls')),
    path('api/retakes/', include('retake.urls')),
    path('api/', include('peo_report.urls')),
    path('api/', include('ga_cqi_cohort.urls')),
    path("api/course-history/",include("course_history.urls")),
    path('api/clo-master/', include('clo_master.urls')),
    path('api/electives/', include('electives.urls')),
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

