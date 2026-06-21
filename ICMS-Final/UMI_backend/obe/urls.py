from django.urls import path
from .views import (
    PEOListCreateView, PEODetailView,
    GAListCreateView, GADetailView,
    GAPEOMatrixView,
    CLOListCreateView, CLODetailView,
    CLOCopyView, CLOGAMatrixView,
    CourseSessionListView,
    CourseSessionCreateView,
    CourseSessionUpdateView,
    CurriculumVersionListView,
    CurriculumVersionDeleteView,
    EffectiveCurriculumView,
    # New views
    GAAllView,
    GACLOMappingCreateView,
    CourseCLOGAMatrixView,
    CourseFinalSubmitView,
    CourseGAScoresView,
    BatchSemesterGASummaryView,
    BatchProgramGASummaryView,
    GACQICreateView,
    GACQIRecordDetailView,
    GACQIApproveView,
    GACQIRejectView,
    GACQIHistoryView,
    CourseUnlockView,
    BatchGAReportView,
    CourseCLOReportView,
    TeacherGAContextView
)

urlpatterns = [
    # PEO
    path(
        'programs/<uuid:program_id>/peos/',
        PEOListCreateView.as_view()
    ),
    path(
        'peos/<uuid:pk>/',
        PEODetailView.as_view()
    ),

    # GA
    path(
        'programs/<uuid:program_id>/gas/',
        GAListCreateView.as_view()
    ),
    path(
        'gas/<uuid:pk>/',
        GADetailView.as_view()
    ),

    # GA-PEO Matrix
    path(
        'programs/<uuid:program_id>/ga-peo-matrix/',
        GAPEOMatrixView.as_view()
    ),

    # CLO
    path(
        'courses/<uuid:course_id>/versions/<int:version_id>/clos/',
        CLOListCreateView.as_view()
    ),
    path(
        'clos/<uuid:pk>/',
        CLODetailView.as_view()
    ),
    path(
        'courses/<uuid:course_id>/versions/<int:version_id>/clos/copy/',
        CLOCopyView.as_view()
    ),

    # CLO-GA Matrix
    path(
        'courses/<uuid:course_id>/versions/<int:version_id>/clo-ga-matrix/',
        CLOGAMatrixView.as_view()
    ),

    # Course Sessions
    path(
        'batches/<uuid:batch_id>/sessions/',
        CourseSessionListView.as_view()
    ),
    path(
        'sessions/',
        CourseSessionCreateView.as_view()
    ),
    path(
        'sessions/<uuid:pk>/',
        CourseSessionUpdateView.as_view()
    ),

    # Curriculum Version
    path(
        'batches/<uuid:batch_id>/curriculum/',
        CurriculumVersionListView.as_view()
    ),
    path(
        'curriculum/<uuid:pk>/delete/',
        CurriculumVersionDeleteView.as_view()
    ),

    # Effective Curriculum
    path(
        'batches/<uuid:batch_id>/effective-curriculum/',
        EffectiveCurriculumView.as_view()
    ),

    # ========== NEW GA MODULE ENDPOINTS ==========
    # 1. Get all GAs
    path('ga/', GAAllView.as_view()),
    
    # 2. Create CLO-GA mapping
    path('ga/<uuid:ga_id>/clo-mapping/', GACLOMappingCreateView.as_view()),
    
    # 3. Get CLO-GA matrix for a course
    path('courses/<uuid:course_id>/clo-ga-matrix/', CourseCLOGAMatrixView.as_view()),
    
    # 4. Final submit course (Assessment Done)
    path('courses/<uuid:session_id>/final-submit/', CourseFinalSubmitView.as_view()),
    
    # 5. Get course GA scores
    path('courses/<uuid:session_id>/ga-scores/', CourseGAScoresView.as_view()),
    
    # 6. Semester GA summary (early warning)
    path('batches/<uuid:batch_id>/semester-ga-summary/', BatchSemesterGASummaryView.as_view()),
    
    # 7. Program GA summary
    path('batches/<uuid:batch_id>/program-ga-summary/', BatchProgramGASummaryView.as_view()),
    
    # 8. GA CQI endpoints
    path('ga-cqi/', GACQICreateView.as_view()),
    path('ga-cqi/<uuid:cqi_id>/', GACQIRecordDetailView.as_view()),
    path('ga-cqi/<uuid:cqi_id>/approve/', GACQIApproveView.as_view()),
    path('ga-cqi/<uuid:cqi_id>/reject/', GACQIRejectView.as_view()),
    path('ga-cqi/<uuid:cqi_id>/history/', GACQIHistoryView.as_view()),
    
    # 9. Unlock course assessment
    path('courses/<uuid:session_id>/unlock/', CourseUnlockView.as_view()),
    
    # 10. GA Report endpoint
    path('ga-reports/<uuid:batch_id>/', BatchGAReportView.as_view()),
    
    # 11. Course CLO Report
    path('courses/<uuid:session_id>/clo-report/', CourseCLOReportView.as_view()),
    
    # 12. Teacher GA Context endpoint
    path('teacher/ga-context/<uuid:course_id>/', TeacherGAContextView.as_view())
] 
