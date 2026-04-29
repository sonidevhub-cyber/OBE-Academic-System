from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
import logging

from .models import Instructor
from .serializers import InstructorSerializer
from .permissions import IsAdminOrReadOnly, CanViewInstructors
from register.access_control import can_access_department, get_user_assigned_department_id, is_department_scoped_admin
from rbac.permissions import HasRBACPermission
from rbac.services import user_has_permission
from register.multi_role_service import MultiRoleService
from coordinators.models import Coordinator
from hods.models import HOD

logger = logging.getLogger(__name__)


class InstructorViewSet(viewsets.ModelViewSet):
    queryset = Instructor.objects.all()
    serializer_class = InstructorSerializer
    permission_classes = [IsAuthenticated, HasRBACPermission]
    required_permission = 'manage_instructors'
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [IsAuthenticated(), CanViewInstructors()]
        return [IsAuthenticated(), HasRBACPermission()]

    def _sync_acting_instructor_profiles(self, department_id=None):
        """
        Ensure HOD/Coordinator users with can_act_as_instructor=True
        have an Instructor profile so they appear in Instructor listings.
        """
        coordinator_qs = Coordinator.objects.filter(can_act_as_instructor=True).select_related('user', 'department')
        hod_qs = HOD.objects.filter(can_act_as_instructor=True).select_related('user', 'department')

        if department_id:
            coordinator_qs = coordinator_qs.filter(department_id=department_id)
            hod_qs = hod_qs.filter(department_id=department_id)

        for coordinator in coordinator_qs:
            user = getattr(coordinator, 'user', None)
            if not user or hasattr(user, 'instructor_profile'):
                continue
            try:
                MultiRoleService.enable_instructor_role_for_coordinator(user)
            except Exception as exc:
                logger.warning("Failed syncing coordinator as instructor for user=%s: %s", user.id, exc)

        for hod in hod_qs:
            user = getattr(hod, 'user', None)
            if not user or hasattr(user, 'instructor_profile'):
                continue
            try:
                MultiRoleService.enable_instructor_role_for_hod(user)
            except Exception as exc:
                logger.warning("Failed syncing HOD as instructor for user=%s: %s", user.id, exc)

    def get_queryset(self):
        # Show all instructors, including those who are also coordinators
        queryset = Instructor.objects.all()
        user = self.request.user
        scope_department_id = None

        if hasattr(user, 'coordinator_profile') and user.coordinator_profile and user.coordinator_profile.department:
            scope_department_id = user.coordinator_profile.department_id
            queryset = queryset.filter(department_id=scope_department_id)
        elif hasattr(user, 'hod_profile') and user.hod_profile and user.hod_profile.department:
            scope_department_id = user.hod_profile.department_id
            queryset = queryset.filter(department_id=scope_department_id)
        if is_department_scoped_admin(self.request.user):
            assigned_department_id = get_user_assigned_department_id(self.request.user)
            if assigned_department_id:
                scope_department_id = assigned_department_id
                queryset = queryset.filter(department_id=assigned_department_id)

        self._sync_acting_instructor_profiles(scope_department_id)
        return queryset.order_by('name')

    def create(self, request, *args, **kwargs):
        try:
            if not user_has_permission(request.user, 'manage_instructors'):
                return Response({"error": "Forbidden", "required_permission": "manage_instructors"}, status=status.HTTP_403_FORBIDDEN)
            data_for_validation = request.data.copy()
            from register.models import User
            from rest_framework import serializers
            
            department_id = data_for_validation.get('department') or data_for_validation.get('department_id')
            if not can_access_department(request.user, department_id):
                return Response({"error": "Forbidden: You can only manage instructors in your assigned department."}, status=status.HTTP_403_FORBIDDEN)

            user_email = data_for_validation.pop('user_email', None)
            if not user_email:
                return Response({"error": "user_email is required"}, status=status.HTTP_400_BAD_REQUEST)
            raw_password = request.data.get('password')
            if not raw_password:
                return Response({"error": "password is required"}, status=status.HTTP_400_BAD_REQUEST)
            
            # Employee ID is system-generated; ignore manual input if provided.
            
            user, created = User.objects.get_or_create(
                email=user_email, 
                defaults={
                    'username': user_email, 
                    'role': 'instructor',
                    'is_coordinator': False  # Instructors are NOT coordinators by default
                }
            )
            if created or not user.has_usable_password():
                user.set_password(raw_password)
                user.save(update_fields=['password'])

            # Check if user already has an instructor profile
            if hasattr(user, 'instructor_profile'):
                return Response({"error": "User already has an instructor profile"}, status=status.HTTP_400_BAD_REQUEST)

            serializer = self.get_serializer(data=data_for_validation)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
            serializer.validated_data['user'] = user
            instructor = serializer.save()

            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        try:
            if not user_has_permission(request.user, 'manage_instructors'):
                return Response({"error": "Forbidden", "required_permission": "manage_instructors"}, status=status.HTTP_403_FORBIDDEN)
            data_for_validation = request.data.copy()
            from register.models import User
            from rest_framework import serializers
            
            user_email = data_for_validation.pop('user_email', None)
            instance = self.get_object()
            new_department_id = data_for_validation.get('department') or data_for_validation.get('department_id') or instance.department_id
            if not can_access_department(request.user, instance.department_id) or not can_access_department(request.user, new_department_id):
                return Response({"error": "Forbidden: You can only manage instructors in your assigned department."}, status=status.HTTP_403_FORBIDDEN)
            
            if user_email and instance.user.email != user_email:
                # Update the user's email
                instance.user.email = user_email
                instance.user.username = user_email
                instance.user.save()

            serializer = self.get_serializer(instance, data=data_for_validation)
            serializer.is_valid(raise_exception=True)
            serializer.save()

            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='upload-image',
            parser_classes=[MultiPartParser, FormParser],
            permission_classes=[IsAdminOrReadOnly])   # 👈 only admin can upload
    def upload_image(self, request, pk=None):
        """
        POST /api/instructors/<id>/upload-image/
        Upload image for an instructor
        """
        try:
            instructor = self.get_object()
            if not can_access_department(request.user, instructor.department_id):
                return Response({"error": "Forbidden: You can only manage instructors in your assigned department."}, status=status.HTTP_403_FORBIDDEN)

            if 'image' not in request.FILES:
                return Response({"error": "No image file provided"},
                                status=status.HTTP_400_BAD_REQUEST)

            image_file = request.FILES['image']

            # Validate file type
            allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
            if image_file.content_type not in allowed_types:
                return Response({"error": "Invalid file type. Only JPEG, PNG, and GIF allowed"},
                                status=status.HTTP_400_BAD_REQUEST)

            # Validate file size (max 5MB)
            if image_file.size > 5 * 1024 * 1024:
                return Response({"error": "File size too large. Maximum size is 5MB"},
                                status=status.HTTP_400_BAD_REQUEST)

            # Save the image
            instructor.image.save(image_file.name, image_file, save=True)

            serializer = self.get_serializer(instructor, context={'request': request})
            return Response({
                "message": "Image uploaded successfully",
                "instructor": serializer.data
            }, status=status.HTTP_200_OK)

        except Instructor.DoesNotExist:
            return Response({"error": "Instructor not found"},
                            status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": f"Upload failed: {str(e)}"},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class InstructorProfileView(APIView):
    """
    GET /api/instructor/profile/
    PUT /api/instructor/profile/
    Get or update current instructor's profile based on authentication
    """
    permission_classes = []  # Allow public access
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        try:
            # Check if user is authenticated
            if not request.user.is_authenticated:
                return Response({"detail": "Authentication credentials were not provided."},
                                status=status.HTTP_401_UNAUTHORIZED)
                
            # First try to get instructor profile
            try:
                instructor = Instructor.objects.get(user=request.user)
                serializer = InstructorSerializer(instructor, context={'request': request})
                return Response(serializer.data, status=status.HTTP_200_OK)
            except Instructor.DoesNotExist:
                # If not found as instructor, check if user is HOD from registration request
                if request.user.role == 'hod':
                    from hods.models import HODRegistrationRequest
                    try:
                        hod_request = HODRegistrationRequest.objects.get(
                            employee_id=request.user.username,
                            hod_request_status='account_created'
                        )
                        # Create a mock instructor-like response for HOD
                        hod_data = {
                            'id': hod_request.id,
                            'name': hod_request.name,
                            'employee_id': hod_request.employee_id,
                            'phone': hod_request.phone,
                            'designation': hod_request.designation,
                            'specialization': hod_request.specialization,
                            'experience_years': hod_request.experience_years,
                            'department': {
                                'department_id': hod_request.department.department_id,
                                'name': hod_request.department.name,
                                'code': hod_request.department.code
                            },
                            'department_name': hod_request.department.name,
                            'user_email': hod_request.email,
                            'image': None
                        }
                        return Response(hod_data, status=status.HTTP_200_OK)
                    except HODRegistrationRequest.DoesNotExist:
                        return Response({"error": "HOD profile not found for this user"},
                                        status=status.HTTP_404_NOT_FOUND)
                else:
                    return Response({"error": "Instructor profile not found for this user"},
                                    status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)},
                             status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def put(self, request):
        """Update instructor/HOD profile"""
        try:
            # Check if user is authenticated
            if not request.user.is_authenticated:
                return Response({"detail": "Authentication credentials were not provided."},
                                status=status.HTTP_401_UNAUTHORIZED)
            
            # Try to get instructor profile first
            try:
                instructor = Instructor.objects.get(user=request.user)
                
                # Update user fields
                user = request.user
                user.first_name = request.data.get('first_name', user.first_name)
                user.last_name = request.data.get('last_name', user.last_name)
                user.email = request.data.get('email', user.email)
                user.save()
                
                # Update instructor fields
                instructor.phone = request.data.get('phone', instructor.phone)
                instructor.designation = request.data.get('designation', instructor.designation)
                instructor.specialization = request.data.get('specialization', instructor.specialization)
                instructor.experience_years = request.data.get('experience_years', instructor.experience_years)
                
                # Handle image upload
                if 'image' in request.FILES:
                    instructor.image = request.FILES['image']
                
                instructor.save()
                
                serializer = InstructorSerializer(instructor, context={'request': request})
                return Response({
                    'success': True,
                    'message': 'Profile updated successfully',
                    'data': serializer.data
                })
                
            except Instructor.DoesNotExist:
                # If not found as instructor, check if user is HOD
                if request.user.role == 'hod':
                    from hods.models import HODRegistrationRequest
                    try:
                        hod_request = HODRegistrationRequest.objects.get(
                            employee_id=request.user.username,
                            hod_request_status='account_created'
                        )
                        
                        # Update HOD request fields
                        hod_request.name = request.data.get('name', hod_request.name)
                        hod_request.email = request.data.get('email', hod_request.email)
                        hod_request.phone = request.data.get('phone', hod_request.phone)
                        hod_request.designation = request.data.get('designation', hod_request.designation)
                        hod_request.specialization = request.data.get('specialization', hod_request.specialization)
                        hod_request.experience_years = request.data.get('experience_years', hod_request.experience_years)
                        hod_request.save()
                        
                        # Also update user fields
                        user = request.user
                        user.first_name = request.data.get('first_name', user.first_name)
                        user.last_name = request.data.get('last_name', user.last_name)
                        user.email = request.data.get('email', user.email)
                        user.save()
                        
                        return Response({
                            'success': True,
                            'message': 'HOD profile updated successfully'
                        })
                        
                    except HODRegistrationRequest.DoesNotExist:
                        return Response({"error": "HOD profile not found for this user"},
                                        status=status.HTTP_404_NOT_FOUND)
                else:
                    return Response({"error": "Profile not found for this user"},
                                    status=status.HTTP_404_NOT_FOUND)
                                    
        except Exception as e:
            return Response({"error": str(e)},
                             status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class InstructorDashboardDataView(APIView):
    """
    GET /api/instructors/dashboard-data/
    Get instructor's department semesters and courses for attendance marking
    """
    # permission_classes = [IsAuthenticated]  # Temporarily disabled for testing

    def get(self, request):
        try:
            # Get instructor's department
            instructor_department = None
            
            # Check if user is authenticated
            if request.user and request.user.is_authenticated:
                # First try to get from instructor profile
                try:
                    instructor = Instructor.objects.get(user=request.user)
                    instructor_department = instructor.department
                except Instructor.DoesNotExist:
                    # If not found as instructor, check if user is HOD
                    if hasattr(request.user, 'role') and request.user.role == 'hod':
                        from hods.models import HODRegistrationRequest
                        try:
                            hod_request = HODRegistrationRequest.objects.get(
                                employee_id=request.user.username,
                                hod_request_status='account_created'
                            )
                            instructor_department = hod_request.department
                        except HODRegistrationRequest.DoesNotExist:
                            pass
            
            # If no department found, return all departments and semesters for testing
            if not instructor_department:
                from academics.models import Department, Semester, Course
                # Get first department as fallback
                departments = Department.objects.all()
                if departments.exists():
                    instructor_department = departments.first()
                else:
                    return Response({'error': 'No departments found'}, status=status.HTTP_404_NOT_FOUND)

            # Get semesters for the department
            from academics.models import Semester, Course
            semesters = Semester.objects.filter(department=instructor_department)
            
            semesters_data = []
            for semester in semesters:
                semesters_data.append({
                    'semester_id': semester.semester_id,
                    'name': semester.name,
                    'program': semester.program,
                    'department': semester.department.name if semester.department else 'N/A'
                })

            # Get courses for the department
            courses = Course.objects.filter(semester__department=instructor_department)
            courses_data = []
            for course in courses:
                courses_data.append({
                    'course_id': course.course_id,
                    'name': course.name,
                    'code': course.code,
                    'credits': course.credits,
                    'semester': course.semester.name if course.semester else 'N/A',
                    'semester_id': course.semester.semester_id if course.semester else None,
                })

            return Response({
                'semesters': semesters_data,
                'courses': courses_data,
                'department': {
                    'department_id': instructor_department.department_id,
                    'name': instructor_department.name,
                    'code': instructor_department.code
                }
            })

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AttendanceReportsView(APIView):
    """
    GET /api/instructors/attendance/reports/
    Get attendance reports for students by department, semester, year, and month
    """
    # permission_classes = [IsAuthenticated]  # Temporarily disabled for testing

    def get(self, request):
        try:
            department_id = request.GET.get('department_id')
            semester_id = request.GET.get('semester_id')
            year = request.GET.get('year')
            month = request.GET.get('month')

            if not all([department_id, semester_id, year, month]):
                return Response({'error': 'department_id, semester_id, year, and month are required'}, status=status.HTTP_400_BAD_REQUEST)

            # Import here to avoid circular imports
            from instructors.models import AttendanceRecord
            from datetime import datetime

            # Create date range for the month
            start_date = datetime(int(year), int(month), 1)
            if int(month) == 12:
                end_date = datetime(int(year) + 1, 1, 1)
            else:
                end_date = datetime(int(year), int(month) + 1, 1)

            # Get attendance records for the specified period
            attendance_records = AttendanceRecord.objects.filter(
                student__department_id=department_id,
                student__semester_id=semester_id,
                date__gte=start_date,
                date__lt=end_date
            ).select_related('student')

            # Format the data
            records_data = []
            for record in attendance_records:
                records_data.append({
                    'student_id': record.student.student_id,
                    'student_name': record.student.name,
                    'date': record.date.isoformat(),
                    'status': record.status
                })

            return Response(records_data)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class HODRecordsView(APIView):
    """
    GET /api/instructors/hods/
    Get all HOD records for admin management
    """
    permission_classes = []  # Allow public access

    def get(self, request):
        try:
            from hods.models import HODRegistrationRequest
            
            # Get all approved HOD requests
            hod_requests = HODRegistrationRequest.objects.filter(
                hod_request_status='account_created'
            ).select_related('department')
            
            hod_data = []
            for hod in hod_requests:
                hod_info = {
                    'id': hod.id,
                    'name': hod.name,
                    'email': hod.email,
                    'employee_id': hod.employee_id,
                    'phone': hod.phone,
                    'designation': hod.designation,
                    'specialization': hod.specialization,
                    'experience_years': hod.experience_years,
                    'image': None,
                    'department': {
                        'id': hod.department.department_id if hod.department else None,
                        'name': hod.department.name if hod.department else None
                    },
                    'created_at': hod.requested_at,
                    'updated_at': hod.reviewed_at
                }
                hod_data.append(hod_info)
            
            return Response({
                'success': True,
                'data': hod_data,
                'count': len(hod_data)
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
from rest_framework.decorators import api_view
from rest_framework.response import Response
from coordinators.models import CourseAllocation
from students.models import Student

@api_view(['GET'])
def course_details(request, allocation_id):
    allocation = CourseAllocation.objects.get(allocation_id=allocation_id)

    students = Student.objects.filter(semester=allocation.semester)

    student_list = [
        {
            "reg_no": s.registration_number,
            "name": s.name
        }
        for s in students
    ]

    data = {
        "course": allocation.course.name,
        "course_code": allocation.course.code,
        "semester": allocation.semester.name,
        "instructor": allocation.instructor.name,
        "HOD comments": allocation.hod_comments,
        "coordinator": allocation.coordinator.name,
        "students": student_list
    }

    return Response(data)
