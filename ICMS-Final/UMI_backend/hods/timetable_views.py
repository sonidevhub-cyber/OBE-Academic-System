from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from academics.models import Timetable, Course, Department, Semester
from instructors.models import Instructor
from register.models import User
from .models import HODRegistrationRequest
from .permissions import IsHODUser
from rest_framework.decorators import api_view, permission_classes
from django.utils import timezone

class HODTimetableApprovalView(APIView):
    """HOD Timetable approval management"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get pending timetable proposals for approval"""
        try:
            # Get HOD's department
            hod_department = self.get_hod_department(request.user)
            if not hod_department:
                return Response({'error': 'HOD department not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Get pending timetable proposals from coordinators
            from coordinators.models import TimetableProposal
            pending_proposals = TimetableProposal.objects.select_related(
                'coordinator', 'semester'
            ).filter(
                coordinator__department=hod_department,
                status='submitted'
            ).order_by('-proposal_id')
            
            proposal_data = []
            for proposal in pending_proposals:
                proposal_data.append({
                    'proposal_id': proposal.proposal_id,
                    'title': proposal.title,
                    'description': proposal.description,
                    'semester_name': proposal.semester.name if proposal.semester else 'N/A',
                    'coordinator_name': proposal.coordinator.name,
                    'status': proposal.status,
                    'submitted_at': proposal.submitted_at.isoformat() if proposal.submitted_at else None
                })
            
            return Response(proposal_data)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def post(self, request):
        """Approve or reject timetable"""
        try:
            timetable_id = request.data.get('timetable_id')
            action = request.data.get('action')  # 'approve' or 'reject'
            rejection_reason = request.data.get('rejection_reason', '')
            
            if not timetable_id or not action:
                return Response({'error': 'timetable_id and action are required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Get HOD's department
            hod_department = self.get_hod_department(request.user)
            if not hod_department:
                return Response({'error': 'HOD department not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Get timetable
            timetable = Timetable.objects.select_related('course__semester__department').get(
                timetable_id=timetable_id,
                course__semester__department=hod_department,
                approval_status='pending'
            )
            
            if action == 'approve':
                timetable.approval_status = 'approved'
                timetable.approved_by = request.user
                timetable.approved_at = timezone.now()
                message = f'Timetable for {timetable.course.name} approved successfully'
            elif action == 'reject':
                timetable.approval_status = 'rejected'
                timetable.rejection_reason = rejection_reason
                message = f'Timetable for {timetable.course.name} rejected'
            else:
                return Response({'error': 'Invalid action. Use "approve" or "reject"'}, status=status.HTTP_400_BAD_REQUEST)
            
            timetable.save()
            
            return Response({'message': message}, status=status.HTTP_200_OK)
            
        except Timetable.DoesNotExist:
            return Response({'error': 'Timetable not found or not pending approval'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def get_hod_department(self, user):
        """Get HOD's department"""
        try:
            from .models import HOD
            hod = HOD.objects.filter(user=user).first()
            if hod:
                return hod.department
            
            hod_request = HODRegistrationRequest.objects.filter(email=user.email).first()
            if hod_request:
                return hod_request.department
                
            return None
        except Exception:
            return None

class HODTimetableView(APIView):
    """
    HOD Timetable management view
    """
    permission_classes = [IsAuthenticated]
    


    def get(self, request):
        """Get all timetables or form data"""
        print(f"HOD Timetable GET request from user: {request.user}")
        print(f"Request params: {request.GET}")
        
        # Check if requesting available data for form
        if request.GET.get('action') == 'form_data':
            print("Fetching form data for HOD timetable")
            # Get HOD's department - try multiple approaches
            hod_department = None
            hod_user = request.user
            
            try:
                # Try HOD model first
                from .models import HOD
                hod = HOD.objects.filter(user=hod_user).first()
                if hod:
                    hod_department = hod.department
                    print(f"Found HOD department from HOD model: {hod_department}")
                else:
                    # Try HOD registration request
                    hod_request = HODRegistrationRequest.objects.filter(
                        email=hod_user.email
                    ).first()
                    if hod_request:
                        hod_department = hod_request.department
                        print(f"Found HOD department from request: {hod_department}")
                
                if not hod_department:
                    print("No HOD department found, using fallback")
                    # Fallback - get first department
                    from academics.models import Department
                    hod_department = Department.objects.first()
                    
            except Exception as e:
                print(f"Error finding HOD department: {e}")
                from academics.models import Department
                hod_department = Department.objects.first()

            # Filter data by HOD's department
            if hod_department:
                courses = Course.objects.select_related('semester__department').filter(
                    semester__department=hod_department
                )
                instructors = Instructor.objects.select_related('department').filter(
                    department=hod_department
                )
                semesters = Semester.objects.select_related('department').filter(
                    department=hod_department
                )
            else:
                # Fallback to all data
                courses = Course.objects.select_related('semester__department').all()[:10]
                instructors = Instructor.objects.select_related('department').all()[:10]
                semesters = Semester.objects.select_related('department').all()[:10]

            courses_data = []
            for course in courses:
                courses_data.append({
                    'course_id': course.course_id,
                    'name': course.name,
                    'code': course.code,
                    'credits': course.credits,
                    'semester': course.semester.name if course.semester else 'N/A',
                    'semester_id': course.semester.semester_id if course.semester else None,
                    'department': course.semester.department.name if course.semester else 'N/A'
                })

            instructors_data = []
            for instructor in instructors:
                instructors_data.append({
                    'id': instructor.id,
                    'name': instructor.name,
                    'employee_id': instructor.employee_id,
                    'department': instructor.department.name if instructor.department else 'N/A'
                })

            semesters_data = []
            for semester in semesters:
                semesters_data.append({
                    'semester_id': semester.semester_id,
                    'name': semester.name,
                    'program': semester.program,
                    'department': semester.department.name if semester.department else 'N/A'
                })

            return Response({
                'courses': courses_data,
                'instructors': instructors_data,
                'semesters': semesters_data,
                'days': [{'value': day[0], 'label': day[1]} for day in Timetable.DAY_CHOICES],
                'time_slots': [
                    {'value': '08:00', 'label': '8:00 AM'},
                    {'value': '09:00', 'label': '9:00 AM'},
                    {'value': '10:00', 'label': '10:00 AM'},
                    {'value': '11:00', 'label': '11:00 AM'},
                    {'value': '12:00', 'label': '12:00 PM'},
                    {'value': '13:00', 'label': '1:00 PM'},
                    {'value': '14:00', 'label': '2:00 PM'},
                    {'value': '15:00', 'label': '3:00 PM'},
                    {'value': '16:00', 'label': '4:00 PM'},
                ]
            })

        # Get HOD's department using same logic as form_data
        hod_department = None
        hod_user = request.user
        
        try:
            # Try HOD model first
            from .models import HOD
            hod = HOD.objects.filter(user=hod_user).first()
            if hod:
                hod_department = hod.department
                print(f"Found HOD department from HOD model: {hod_department}")
            else:
                # Try HOD registration request
                hod_request = HODRegistrationRequest.objects.filter(
                    email=hod_user.email
                ).first()
                if hod_request:
                    hod_department = hod_request.department
                    print(f"Found HOD department from request: {hod_department}")
            
            if not hod_department:
                print("No HOD department found, using fallback")
                # Fallback - get first department
                from academics.models import Department
                hod_department = Department.objects.first()
                
        except Exception as e:
            print(f"Error finding HOD department: {e}")
            from academics.models import Department
            hod_department = Department.objects.first()

        # Filter timetables by HOD's department
        if hod_department:
            timetables = Timetable.objects.select_related('course__semester__department', 'instructor').filter(
                course__semester__department=hod_department
            )
        else:
            # Fallback to all timetables
            timetables = Timetable.objects.select_related('course__semester__department', 'instructor').all()[:20]

        # Check if filtering by semester
        semester_id = request.GET.get('semester_id')
        if semester_id:
            timetables = timetables.filter(course__semester__semester_id=semester_id)

        timetable_data = []

        for timetable in timetables:
            timetable_data.append({
                'timetable_id': timetable.timetable_id,
                'course': {
                    'course_id': timetable.course.course_id,
                    'name': timetable.course.name,
                    'code': timetable.course.code,
                    'semester': timetable.course.semester.name if timetable.course.semester else None
                },
                'instructor': {
                    'id': timetable.instructor.id,
                    'name': timetable.instructor.name,
                    'employee_id': timetable.instructor.employee_id
                },
                'day': timetable.day,
                'start_time': timetable.start_time.strftime('%H:%M'),
                'end_time': timetable.end_time.strftime('%H:%M'),
                'room': timetable.room,
                'id': timetable.timetable_id
            })

        return Response({
            'timetables': timetable_data,
            'count': len(timetable_data)
        })
    
    def post(self, request):
        """Create timetable - coordinators create as pending, HODs create as approved"""
        try:
            course_id = request.data.get('course_id')
            instructor_id = request.data.get('instructor_id')
            day = request.data.get('day')
            start_time = request.data.get('start_time')
            end_time = request.data.get('end_time')
            room = request.data.get('room', '')
            
            course = Course.objects.get(course_id=course_id)
            instructor = Instructor.objects.get(id=instructor_id)
            
            # Check for time conflicts with same instructor on same day
            from datetime import datetime
            start_dt = datetime.strptime(start_time, '%H:%M').time()
            end_dt = datetime.strptime(end_time, '%H:%M').time()
            
            conflicts = Timetable.objects.filter(
                instructor=instructor,
                day=day,
                approval_status__in=['approved', 'pending']
            ).exclude(timetable_id=request.data.get('timetable_id', 0))
            
            for conflict in conflicts:
                if (start_dt < conflict.end_time and end_dt > conflict.start_time):
                    return Response({
                        'error': f'Time conflict: Instructor {instructor.name} already has a class from {conflict.start_time} to {conflict.end_time} on {day.title()}',
                        'conflict_details': {
                            'existing_course': conflict.course.name,
                            'existing_time': f'{conflict.start_time}-{conflict.end_time}',
                            'new_time': f'{start_time}-{end_time}'
                        }
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # Determine approval status based on user role
            if request.user.role == 'hod':
                approval_status = 'approved'
                approved_by = request.user
                approved_at = timezone.now()
            else:
                approval_status = 'pending'
                approved_by = None
                approved_at = None
            
            # Create the timetable
            timetable = Timetable.objects.create(
                course=course,
                instructor=instructor,
                day=day,
                start_time=start_time,
                end_time=end_time,
                room=room,
                approval_status=approval_status,
                created_by=request.user,
                approved_by=approved_by,
                approved_at=approved_at
            )
            
            message = 'Timetable created and approved' if approval_status == 'approved' else 'Timetable created and submitted for approval'
            
            return Response({
                'message': message,
                'timetable_id': timetable.timetable_id,
                'approval_status': approval_status
            }, status=status.HTTP_201_CREATED)
            
        except Course.DoesNotExist:
            return Response({
                'error': 'Course not found',
                'course_id': course_id,
                'available_courses': list(Course.objects.values('course_id', 'name', 'code'))
            }, status=status.HTTP_404_NOT_FOUND)
        except Instructor.DoesNotExist:
            return Response({
                'error': 'Instructor not found',
                'instructor_id': instructor_id,
                'available_instructors': list(Instructor.objects.values('id', 'name', 'employee_id'))
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, timetable_id=None):
        """Delete timetable entry"""
        try:
            # Get timetable_id from URL if not provided
            if timetable_id is None:
                timetable_id = request.resolver_match.kwargs.get('timetable_id')
            
            if not timetable_id:
                return Response({'error': 'Timetable ID required'}, status=status.HTTP_400_BAD_REQUEST)
            # Get HOD's department
            hod_department = None
            hod_user = request.user

            # Try to get department from instructor profile first
            try:
                hod_instructor = Instructor.objects.get(user=hod_user)
                hod_department = hod_instructor.department
            except Instructor.DoesNotExist:
                # If not found as instructor, check HOD registration request
                try:
                    hod_request = HODRegistrationRequest.objects.get(
                        employee_id=hod_user.username,
                        hod_request_status='account_created'
                    )
                    hod_department = hod_request.department
                except HODRegistrationRequest.DoesNotExist:
                    return Response({'error': 'HOD profile not found'}, status=status.HTTP_404_NOT_FOUND)

            # Get and delete the timetable entry, ensuring it belongs to HOD's department
            timetable = Timetable.objects.select_related('course__semester__department').get(
                timetable_id=timetable_id,
                course__semester__department=hod_department
            )
            timetable.delete()

            return Response({
                'message': 'Timetable entry deleted successfully'
            }, status=status.HTTP_200_OK)

        except Timetable.DoesNotExist:
            return Response({
                'error': 'Timetable entry not found or access denied'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request):
        """Create sample data for testing"""
        try:
            # Create department
            dept, _ = Department.objects.get_or_create(
                code='CS', 
                defaults={'name': 'Computer Science', 'num_semesters': 8}
            )
            
            # Create semester
            sem, _ = Semester.objects.get_or_create(
                semester_code='CS-SEM1',
                defaults={
                    'name': 'Semester 1',
                    'program': 'CS',
                    'capacity': 30,
                    'department': dept
                }
            )
            
            # Create courses
            course1, _ = Course.objects.get_or_create(
                code='CS101',
                defaults={'name': 'Programming', 'credits': 3, 'semester': sem}
            )
            course2, _ = Course.objects.get_or_create(
                code='CS102', 
                defaults={'name': 'Data Structures', 'credits': 3, 'semester': sem}
            )
            
            # Create instructor user
            user, _ = User.objects.get_or_create(
                username='john_smith',
                defaults={
                    'email': 'john@uni.edu',
                    'name': 'Dr. John Smith',
                    'role': 'instructor'
                }
            )
            
            # Create instructor
            instructor, _ = Instructor.objects.get_or_create(
                employee_id='INS001',
                defaults={
                    'name': 'Dr. John Smith',
                    'phone': '123456789',
                    'specialization': 'Computer Science',
                    'user': user,
                    'department': dept
                }
            )
            
            return Response({
                'message': 'Sample data created successfully',
                'data': {
                    'department': dept.name,
                    'courses': [course1.name, course2.name],
                    'instructor': instructor.name
                }
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_timetable(request, timetable_id):
    """Delete timetable entry"""
    try:
        # Get and delete the timetable entry
        timetable = Timetable.objects.get(timetable_id=timetable_id)
        timetable.delete()

        return Response({
            'message': 'Timetable entry deleted successfully'
        }, status=status.HTTP_200_OK)

    except Timetable.DoesNotExist:
        return Response({
            'error': 'Timetable entry not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)