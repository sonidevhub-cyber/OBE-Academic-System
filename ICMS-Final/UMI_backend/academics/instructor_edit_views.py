from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .models import Attendance, AttendanceEditPermission
from instructors.models import Instructor


class InstructorSubmittedAttendanceView(APIView):
    """
    GET /api/academics/attendance/submitted/
    Get instructor's submitted attendance records
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            instructor = request.user.instructor_profile if hasattr(request.user, 'instructor_profile') else None
            if not instructor:
                return Response({'error': 'Instructor profile not found'}, status=status.HTTP_400_BAD_REQUEST)

            # Get submitted attendance records for this instructor
            submitted_records = Attendance.objects.filter(
                instructor=instructor,
                is_submitted=True
            ).select_related('student').order_by('-date', '-marked_at')

            records = []
            for record in submitted_records:
                records.append({
                    'id': record.attendance_id,
                    'student_id': record.student.student_id,
                    'student_name': record.student.name,
                    'date': record.date,
                    'current_status': record.status,
                    'marked_at': record.marked_at,
                    'can_request_edit': not AttendanceEditPermission.objects.filter(
                        attendance=record,
                        status='pending'
                    ).exists()
                })

            return Response({'records': records}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RequestAttendanceEditView(APIView):
    """
    POST /api/academics/attendance/edit-request/
    Submit request to edit attendance record
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            instructor = request.user.instructor_profile if hasattr(request.user, 'instructor_profile') else None
            if not instructor:
                return Response({'error': 'Instructor profile not found'}, status=status.HTTP_400_BAD_REQUEST)

            attendance_id = request.data.get('attendance_id')
            proposed_status = request.data.get('proposed_status')
            reason = request.data.get('reason')

            if not all([attendance_id, proposed_status, reason]):
                return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)

            # Validate attendance record exists and belongs to instructor
            try:
                attendance = Attendance.objects.get(
                    attendance_id=attendance_id,
                    instructor=instructor,
                    is_submitted=True
                )
            except Attendance.DoesNotExist:
                return Response({'error': 'Attendance record not found'}, status=status.HTTP_404_NOT_FOUND)

            # Check if there's already a pending request for this record
            existing_request = AttendanceEditPermission.objects.filter(
                attendance=attendance,
                status='pending'
            ).exists()

            if existing_request:
                return Response({'error': 'Edit request already pending for this record'}, status=status.HTTP_400_BAD_REQUEST)

            # Create edit request
            edit_request = AttendanceEditPermission.objects.create(
                instructor=instructor,
                attendance=attendance,
                reason=reason,
                proposed_status=proposed_status,
                status='pending'
            )

            return Response({
                'message': 'Edit request submitted successfully',
                'request_id': edit_request.permission_id
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class InstructorEditRequestsView(APIView):
    """
    GET /api/academics/attendance/edit-requests/
    Get instructor's edit requests
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            instructor = request.user.instructor_profile if hasattr(request.user, 'instructor_profile') else None
            if not instructor:
                return Response({'error': 'Instructor profile not found'}, status=status.HTTP_400_BAD_REQUEST)

            edit_requests = AttendanceEditPermission.objects.filter(
                instructor=instructor
            ).select_related('attendance', 'attendance__student').order_by('-requested_at')

            requests = []
            for req in edit_requests:
                requests.append({
                    'id': req.permission_id,
                    'attendance_id': req.attendance.attendance_id,
                    'student_name': req.attendance.student.name,
                    'date': req.attendance.date,
                    'current_status': req.attendance.status,
                    'proposed_status': req.proposed_status,
                    'reason': req.reason,
                    'status': req.status,
                    'requested_at': req.requested_at,
                    'reviewed_at': req.reviewed_at,
                    'admin_notes': req.admin_notes
                })

            return Response({'requests': requests}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)