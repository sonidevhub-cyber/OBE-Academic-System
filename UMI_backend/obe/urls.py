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
    EffectiveCurriculumView 
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
        'courses/<uuid:course_id>/batches/<uuid:batch_id>/clos/', 
        CLOListCreateView.as_view() 
    ), 
    path( 
        'clos/<uuid:pk>/', 
        CLODetailView.as_view() 
    ), 
    path( 
        'courses/<uuid:course_id>/batches/<uuid:batch_id>/clos/copy/', 
        CLOCopyView.as_view() 
    ), 
 
    # CLO-GA Matrix 
    path( 
        'courses/<uuid:course_id>/batches/<uuid:batch_id>/clo-ga-matrix/', 
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
] 
