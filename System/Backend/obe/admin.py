from django.contrib import admin
from .models import (
    PEO, GA, GAPEOMapping, CLO, CLOGAMapping,
    CourseSession, CourseGAScore, GACQIRecord,
    GACQIResubmissionHistory, StudentCLOScore,
    ExitSurveyQuestion, ExitSurveyCycle, ExitSurveyResponse,
    ExitSurveyTemplate, PEOCQIRecord, PEOCQISubmissionHistory,
    GAReport, CourseFeedbackGAScore, ExitSurveyGAScore,
)

admin.site.register(PEO)
admin.site.register(GA)
admin.site.register(GAPEOMapping)
admin.site.register(CLO)
admin.site.register(CLOGAMapping)
admin.site.register(CourseSession)
admin.site.register(CourseGAScore)
admin.site.register(GACQIRecord)
admin.site.register(GACQIResubmissionHistory)
admin.site.register(StudentCLOScore)
admin.site.register(ExitSurveyQuestion)
admin.site.register(ExitSurveyCycle)
admin.site.register(ExitSurveyResponse)
admin.site.register(ExitSurveyTemplate)
admin.site.register(PEOCQIRecord)
admin.site.register(PEOCQISubmissionHistory)
admin.site.register(GAReport)
admin.site.register(CourseFeedbackGAScore)
admin.site.register(ExitSurveyGAScore)
