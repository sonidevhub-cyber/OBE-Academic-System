from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .models import AttendanceEditPermission, Attendance
from students.models import Student
from instructors.models import Instructor


class SimpleEditRequestView(APIView):
    """
    POST /api/academics/attendance/edit-request/
    Create a simple edit request for attendance
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            instructor = request.user.instructor_profile if hasattr(request.user, 'instructor_profile') else None
            if not instructor:
                return Response({'error': 'Instructor profile not found'}, status=status.HTTP_400_BAD_REQUEST)

            request_type = request.data.get('type', 'single')
            reason = request.data.get('reason')
            date = request.data.get('date')
            proposed_status = request.data.get('proposed_status')

            if not all([reason, date, proposed_status]):
                return Response({'error': 'Missing required fields: reason, date, proposed_status'}, status=status.HTTP_400_BAD_REQUEST)

            if request_type == 'single':
                # Single student edit request
                student_id = request.data.get('student_id')
                current_status = request.data.get('current_status')
                
                if not all([student_id, current_status]):
                    return Response({'error': 'Missing student_id or current_status for single edit'}, status=status.HTTP_400_BAD_REQUEST)

                try:
                    student = Student.objects.get(student_id=student_id)
                except Student.DoesNotExist:
                    return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

                # Create or get attendance record
                attendance, created = Attendance.objects.get_or_create(
                    student=student,
                    date=date,
                    defaults={
                        'status': current_status,
                        'instructor': instructor,
                        'marked_by': instructor,
                        'is_submitted': True,
                        'can_edit': False
                    }
                )

                # Create edit request
                edit_request = AttendanceEditPermission.objects.create(
                    instructor=instructor,
                    attendance=attendance,
                    reason=f"Single Edit: {reason}",
                    proposed_status=proposed_status,
                    status='pending'
                )

                return Response({
                    'message': f'Single student edit request submitted for {student.name}',
                    'request_id': edit_request.permission_id
                }, status=status.HTTP_201_CREATED)

            elif request_type == 'bulk':
                # Bulk edit request
                students_data = request.data.get('students', [])
                student_count = request.data.get('student_count', len(students_data))
                
                if not students_data:
                    return Response({'error': 'No students provided for bulk edit'}, status=status.HTTP_400_BAD_REQUEST)

                created_requests = []
                for student_data in students_data:
                    try:
                        student = Student.objects.get(student_id=student_data['id'])
                        
                        # Create or get attendance record
                        attendance, created = Attendance.objects.get_or_create(
                            student=student,
                            date=date,
                            defaults={
                                'status': student_data.get('current_status', 'Present'),
                                'instructor': instructor,
                                'marked_by': instructor,
                                'is_submitted': True,
                                'can_edit': False
                            }
                        )

                        # Create edit request
                        edit_request = AttendanceEditPermission.objects.create(
                            instructor=instructor,
                            attendance=attendance,
                            reason=f"Bulk Edit ({student_count} students): {reason}",
                            proposed_status=proposed_status,
                            status='pending'
                        )
                        created_requests.append(edit_request.permission_id)
                        
                    except Student.DoesNotExist:
                        continue

                return Response({
                    'message': f'Bulk edit request submitted for {len(created_requests)} students',
                    'request_ids': created_requests,
                    'total_requests': len(created_requests)
                }, status=status.HTTP_201_CREATED)

            else:
                return Response({'error': 'Invalid request type. Use "single" or "bulk"'}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)