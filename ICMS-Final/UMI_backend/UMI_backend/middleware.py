from django.http import JsonResponse
from students.models import Student


class ExitSurveyGateMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Check if the user is authenticated and is a student
        if request.user.is_authenticated and request.user.role == 'student':
            try:
                student = Student.objects.get(user=request.user)
                batch = student.batch

                if batch and batch.exit_survey_enabled and not student.exit_survey_submitted:
                    # Check if the path is allowed (exit survey routes or logout)
                    path = request.path
                    allowed_paths = [
                        '/api/obe/exit-survey/my-questions/',
                        '/api/obe/exit-survey/submit/',
                        '/api/obe/student/portal-status/',
                        # Add logout path here
                    ]
                    if not any(path.startswith(allowed) for allowed in allowed_paths):
                        return JsonResponse({
                            'locked': True,
                            'reason': 'exit_survey_required'
                        }, status=403)
            except Student.DoesNotExist:
                pass

        response = self.get_response(request)
        return response
