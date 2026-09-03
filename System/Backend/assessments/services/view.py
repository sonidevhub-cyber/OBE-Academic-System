from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from assessments.services.clo_service import CLOService


class CLOReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id, batch_id, semester_id):

        data = CLOService.generate_student_report(
            course_id,
            batch_id,
            semester_id,
            request_user=request.user,
        )

        return Response(data)