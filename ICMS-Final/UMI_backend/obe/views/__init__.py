from .peo_views import (
    PEOListCreateView,
    PEODetailView,
    GAPEOMatrixView
)
from .ga_views import (
    GAListCreateView,
    GADetailView,
    GAAllView,
    GACLOMappingCreateView,
    CourseFinalSubmitView,
    CourseGAScoresView,
    BatchSemesterGASummaryView,
    BatchProgramGASummaryView,
    GACQIRecordDetailView,
    GACQICreateView,
    GACQIApproveView,
    GACQIRejectView,
    GACQIHistoryView,
    CourseUnlockView,
    BatchStudentsListView,
    BatchGAReportView,
    EnableResultEditingView,
)
from .clo_views import (
    CLOListCreateView,
    CLODetailView,
    CLOCopyView,
    CLOGAMatrixView,
    CourseCLOGAMatrixView
)
from .course_session_views import (
    CourseSessionListView,
    CourseSessionCreateView,
    CourseSessionUpdateView,
    CurriculumVersionListView,
    CurriculumVersionDeleteView,
    EffectiveCurriculumView
)
from .report_views import (
    TeacherGAContextView,
    CourseCLOReportView,
    AlumniDashboardView
)

__all__ = [
    'PEOListCreateView',
    'PEODetailView',
    'GAPEOMatrixView',
    'GAListCreateView',
    'GADetailView',
    'GAAllView',
    'GACLOMappingCreateView',
    'CourseFinalSubmitView',
    'CourseGAScoresView',
    'BatchSemesterGASummaryView',
    'BatchProgramGASummaryView',
    'GACQIRecordDetailView',
    'GACQICreateView',
    'GACQIApproveView',
    'GACQIRejectView',
    'GACQIHistoryView',
    'CourseUnlockView',
    'BatchStudentsListView',
    'BatchGAReportView',
    'CLOListCreateView',
    'CLODetailView',
    'CLOCopyView',
    'CLOGAMatrixView',
    'CourseCLOGAMatrixView',
    'CourseSessionListView',
    'CourseSessionCreateView',
    'CourseSessionUpdateView',
    'CurriculumVersionListView',
    'CurriculumVersionDeleteView',
    'EffectiveCurriculumView',
    'TeacherGAContextView',
    'CourseCLOReportView',
    'AlumniDashboardView',
    'EnableResultEditingView'
]

