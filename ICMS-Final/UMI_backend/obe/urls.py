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
    TeacherGAContextView,
    BatchStudentsListView,
    AlumniDashboardView,
    # Exit survey views
    GAExitSurveyQuestionListView,
    ExitSurveyQuestionDetailView,
    ExitSurveyCycleListView,
    ExitSurveyCycleActivateView,
    ExitSurveyCycleCloseView,
    ExitSurveyResponseView,
    GAIndirectScoreView,
    # New exit survey views
    ExitSurveyQuestionListView,
    ExitSurveyQuestionGenerateView,
    ExitSurveyTemplateStatusView,
    BatchToggleExitSurveyView,
    BatchToggleAlumniFeedbackView,
    BatchInitiateGraduationView,
    BatchPendingExitSurveyView,
    ExitSurveyMyQuestionsView,
    ExitSurveySubmitView,
    StudentPortalStatusView,
    # Alumni survey views
    PEOAlumniSurveyQuestionListView,
    AlumniSurveyQuestionDetailView,
    AlumniSurveyCycleListView,
    AlumniSurveyCycleCreateView,
    AlumniSurveyCycleActivateView,
    AlumniSurveyCycleCloseView,
    AlumniSurveyResponseView,
    PEOIndirectScoreView
)
from .views.ga_views import EnableResultEditingView

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
    
    # 11. Batch Students List
    path('ga-reports/<uuid:batch_id>/students/', BatchStudentsListView.as_view()),
    
    # 12. Course CLO Report
    path('courses/<uuid:session_id>/clo-report/', CourseCLOReportView.as_view()),
    
    # 13. Teacher GA Context endpoint
    path('teacher/ga-context/<uuid:course_id>/', TeacherGAContextView.as_view()),
    # 14. Alumni Dashboard
    path('alumni/dashboard/', AlumniDashboardView.as_view()),
    
    # ========== EXIT SURVEY ENDPOINTS ==========
    # Exit Survey Questions (HOD)
    path('ga/<uuid:ga_id>/exit-survey-questions/', GAExitSurveyQuestionListView.as_view()),
    path('exit-survey-questions/<uuid:pk>/', ExitSurveyQuestionDetailView.as_view()),
    
    # Exit Survey Cycles (Coordinator)
    path('batches/<uuid:batch_id>/exit-survey-cycles/', ExitSurveyCycleListView.as_view()),
    path('batches/<uuid:batch_id>/exit-survey-cycles/activate/', ExitSurveyCycleActivateView.as_view()),
    path('exit-survey-cycles/<uuid:cycle_id>/close/', ExitSurveyCycleCloseView.as_view()),
    
    # Exit Survey Responses (Student - no auth)
    path('exit-survey/<uuid:cycle_id>/', ExitSurveyResponseView.as_view()),
    path('exit-survey/<uuid:cycle_id>/student/<uuid:student_id>/', ExitSurveyResponseView.as_view()),
    
    # GA Indirect Score
    path('ga/<uuid:ga_id>/batch/<uuid:batch_id>/indirect-score/', GAIndirectScoreView.as_view()),
    
    # ========== ALUMNI SURVEY ROUTES ==========
    # Alumni Survey Questions (HOD)
    path('peo/<uuid:peo_id>/alumni-survey-questions/', PEOAlumniSurveyQuestionListView.as_view()),
    path('alumni-survey-questions/<uuid:pk>/', AlumniSurveyQuestionDetailView.as_view()),
    
    # Alumni Survey Cycles (Coordinator)
    path('batches/<uuid:batch_id>/alumni-survey-cycles/', AlumniSurveyCycleListView.as_view()),
    path('batches/<uuid:batch_id>/alumni-survey-cycles/create/', AlumniSurveyCycleCreateView.as_view()),
    path('alumni-survey-cycles/<uuid:cycle_id>/activate/', AlumniSurveyCycleActivateView.as_view()),
    path('alumni-survey-cycles/<uuid:cycle_id>/close/', AlumniSurveyCycleCloseView.as_view()),
    
    # Alumni Survey Responses (Alumni - no auth)
    path('alumni-survey/<uuid:cycle_id>/', AlumniSurveyResponseView.as_view()),
    path('alumni-survey/<uuid:cycle_id>/student/<uuid:student_id>/', AlumniSurveyResponseView.as_view()),
    
    # PEO Indirect Score
    path('peo/<uuid:peo_id>/batch/<uuid:batch_id>/indirect-score/', PEOIndirectScoreView.as_view()),
    
    # ========== NEW EXIT SURVEY ENDPOINTS ==========
    path('exit-survey/questions/', ExitSurveyQuestionListView.as_view()),
    path('exit-survey/questions/generate/', ExitSurveyQuestionGenerateView.as_view()),
    path('exit-survey/template/status/', ExitSurveyTemplateStatusView.as_view()),
    path('batches/<uuid:batch_id>/toggle-exit-survey/', BatchToggleExitSurveyView.as_view()),
    path('batches/<uuid:batch_id>/toggle-alumni-feedback/', BatchToggleAlumniFeedbackView.as_view()),
    path('batches/<uuid:batch_id>/initiate-graduation/', BatchInitiateGraduationView.as_view()),
    path('batches/<uuid:batch_id>/pending-exit-survey/', BatchPendingExitSurveyView.as_view()),
    path('exit-survey/my-questions/', ExitSurveyMyQuestionsView.as_view()),
    path('exit-survey/submit/', ExitSurveySubmitView.as_view()),
    path('student/portal-status/', StudentPortalStatusView.as_view()),

    # edit admin
    path(
        "course-sessions/<uuid:session_id>/enable-editing/",
        EnableResultEditingView.as_view())
]
