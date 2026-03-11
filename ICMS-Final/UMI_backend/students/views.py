from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from django.db.models import Count
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.contrib.auth import get_user_model

User = get_user_model()

from .models import Student
from .serializers import StudentSerializer
from .permissions import IsStaffOrAdmin
from academics.serializers import CourseSerializer
from academics.models import Result, Scholarship, Timetable
from .services.analysis import generate_performance_notes
from register.access_control import can_access_department, get_user_assigned_department_id, is_department_scoped_admin


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['department', 'semester']
    lookup_field = 'student_id'
    lookup_value_regex = '[^/]+'
    search_fields = ['name', 'email', 'student_id', 'first_name', 'last_name']
    ordering_fields = ['name', 'student_id', 'enrollment_date']
    ordering = ['name']

    # ✅ Filter override
    def get_queryset(self):
        queryset = super().get_queryset()
        department = self.request.query_params.get('department')
        semester = self.request.query_params.get('semester')

        print(f"StudentViewSet filtering - department: {department}, semester: {semester}")

        if department:
            queryset = queryset.filter(department_id=department)
        if semester:
            queryset = queryset.filter(semester_id=semester)

        if is_department_scoped_admin(self.request.user):
            assigned_department_id = get_user_assigned_department_id(self.request.user)
            queryset = queryset.filter(department_id=assigned_department_id)

        return queryset

    # ✅ Create student + linked user
    def create(self, request, *args, **kwargs):
        try:
            print(f"StudentViewSet create - Request data: {request.data}")

            # Initialize student_data first
            student_data = request.data.copy()
            student_data.pop('password', None)  # Remove password from student data

            first_name = request.data.get("first_name")
            last_name = request.data.get("last_name")
            email = request.data.get("email")
            password = request.data.get("password")
            department_id = request.data.get("department_id") or request.data.get("department")
            if not can_access_department(request.user, department_id):
                return Response({"error": "Forbidden: You can only manage students in your assigned department."}, status=status.HTTP_403_FORBIDDEN)

            # Set the name field from first_name and last_name
            if first_name and last_name:
                student_data['name'] = f"{first_name} {last_name}"

            # Check if user already exists by email
            if User.objects.filter(email=email).exists():
                return Response({"error": "User with this email already exists"}, status=status.HTTP_400_BAD_REQUEST)

            # Get department for student ID generation
            from academics.models import Department
            try:
                department = Department.objects.get(department_id=department_id)
                # Ensure department is set in student_data
                student_data['department'] = department.department_id
            except Department.DoesNotExist:
                return Response({"error": "Department not found"}, status=status.HTTP_400_BAD_REQUEST)
            
            serializer = self.get_serializer(data=student_data)
            serializer.is_valid(raise_exception=True)
            student = serializer.save()  # This will auto-generate student_id
            
            # Handle image upload after student creation
            if 'image' in request.FILES:
                student.image = request.FILES['image']
                student.save(update_fields=['image'])
            
            # Create linked User with student_id as username
            user = User.objects.create_user(
                username=student.student_id,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
            )
            
            # Link user to student
            student.user = user
            student.save()

            # Refresh from database to get updated image URL
            student.refresh_from_db()
            # Return updated student data
            serializer = self.get_serializer(student)

            return Response(
                {
                    "message": "Student and user account created successfully",
                    "student": serializer.data,
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            import traceback
            print(f"Error in student create: {e}")
            print(f"Full traceback: {traceback.format_exc()}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ✅ Update student info
    def update(self, request, *args, **kwargs):
        print(f"StudentViewSet update - Request data: {request.data}")
        print(f"Request content type: {request.content_type}")
        try:
            instance = self.get_object()
            new_department_id = request.data.get("department_id") or request.data.get("department") or instance.department_id
            if not can_access_department(request.user, new_department_id) or not can_access_department(request.user, instance.department_id):
                return Response({"error": "Forbidden: You can only manage students in your assigned department."}, status=status.HTTP_403_FORBIDDEN)

            # Handle image upload in update
            if 'image' in request.FILES:
                instance.image = request.FILES['image']
                instance.save(update_fields=['image'])
            
            return super().update(request, *args, **kwargs)
        except Exception as e:
            print(f"StudentViewSet update - Validation error: {e}")
            raise

    # ✅ Upload student image
    @action(
        detail=True,
        methods=['post'],
        url_path='upload-image',
        parser_classes=[MultiPartParser, FormParser]
    )
    def upload_image(self, request, student_id=None):
        try:
            student = self.get_object()

            if 'image' not in request.FILES:
                return Response({"error": "No image file provided"}, status=status.HTTP_400_BAD_REQUEST)

            image_file = request.FILES['image']

            allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
            if image_file.content_type not in allowed_types:
                return Response({"error": "Invalid file type"}, status=status.HTTP_400_BAD_REQUEST)

            if image_file.size > 5 * 1024 * 1024:
                return Response({"error": "File too large (max 5MB)"}, status=status.HTTP_400_BAD_REQUEST)

            student.image = image_file
            student.save(update_fields=['image'])

            serializer = self.get_serializer(student)
            return Response(
                {"message": "Image uploaded successfully", "student": serializer.data},
                status=status.HTTP_200_OK,
            )
        except Student.DoesNotExist:
            return Response({"error": "Student not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": f"Upload failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # ✅ Delete student
    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            if not can_access_department(request.user, instance.department_id):
                return Response({"error": "Forbidden: You can only manage students in your assigned department."}, status=status.HTTP_403_FORBIDDEN)
            student_id = kwargs.get('student_id')
            if not student_id or student_id.strip() == '':
                return Response({"error": "Student ID is required for deletion"}, status=status.HTTP_400_BAD_REQUEST)
            return super().destroy(request, *args, **kwargs)
        except Exception as e:
            return Response({"error": f"Cannot delete student: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    # ✅ Generate notes
    @action(detail=True, methods=['post'], url_path='generate-notes')
    def generate_notes(self, request, student_id=None):
        student = self.get_object()
        notes = generate_performance_notes(student)

        save_flag = str(request.query_params.get("save", "true")).lower() != "false"
        if save_flag:
            student.performance_notes = notes
            student.save(update_fields=["performance_notes"])

        return Response(
            {"student_id": student.student_id, "saved": save_flag, "performance_notes": notes},
            status=status.HTTP_200_OK,
        )

    # ✅ Get all student courses
    @action(detail=True, methods=['get'], url_path='courses')
    def get_student_courses(self, request, student_id=None):
        try:
            student = self.get_object()
            courses = student.courses.all()
            serializer = CourseSerializer(courses, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Student.DoesNotExist:
            return Response({"error": "Student not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": f"Failed to fetch courses: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'], url_path='department-stats')
    def department_statistics(self, request):
        """Get student count by department"""
        try:
            from academics.models import Department
            
            # Get department statistics
            dept_stats = Student.objects.filter(
                department__isnull=False
            ).values(
                'department__department_id',
                'department__name', 
                'department__code'
            ).annotate(
                student_count=Count('student_id')
            ).order_by('department__name')
            
            # Format response
            statistics = []
            for stat in dept_stats:
                statistics.append({
                    'department_id': stat['department__department_id'],
                    'department_name': stat['department__name'],
                    'department_code': stat['department__code'],
                    'student_count': stat['student_count']
                })
            
            total_students = sum(stat['student_count'] for stat in statistics)
            
            return Response({
                'success': True,
                'statistics': statistics,
                'total_students': total_students,
                'total_departments': len(statistics)
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'], url_path='timetable')
    def get_student_timetable(self, request, student_id=None):
        """Get timetable for a specific student based on their department and semester"""
        try:
            student = self.get_object()
            
            if not student.department or not student.semester:
                return Response({
                    'error': 'Student must have department and semester assigned'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            from academics.models import Timetable
            
            # Get all courses for the student's semester
            semester_courses = student.semester.courses.all()
            
            # Get timetable entries for these courses
            timetables = Timetable.objects.filter(
                course__in=semester_courses,
                approval_status='approved'
            ).select_related('course', 'instructor').order_by('day', 'start_time')
            
            # Group by day
            timetable_data = {}
            days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
            
            for day in days:
                timetable_data[day] = []
            
            for timetable in timetables:
                timetable_data[timetable.day].append({
                    'id': timetable.timetable_id,
                    'course_name': timetable.course.name,
                    'course_code': timetable.course.code,
                    'instructor_name': timetable.instructor.name if timetable.instructor else 'TBA',
                    'start_time': timetable.start_time.strftime('%H:%M'),
                    'end_time': timetable.end_time.strftime('%H:%M'),
                    'room': timetable.room or 'TBA'
                })
            
            return Response({
                'success': True,
                'student_id': student.student_id,
                'student_name': student.name,
                'department': student.department.name,
                'semester': student.semester.name,
                'timetable': timetable_data
            })
            
        except Student.DoesNotExist:
            return Response({
                'error': 'Student not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ✅ Student Profile (for logged-in student)
class StudentProfileView(APIView):
    permission_classes = []  # Allow public access

    def get(self, request):
        print("User:", request.user)
        print("Is authenticated:", request.user.is_authenticated)
        try:
            student = Student.objects.get(user=request.user)
            serializer = StudentSerializer(student)
            return Response(serializer.data)
        except Student.DoesNotExist:
            return Response({"error": "Student profile not found"}, status=404)


# ✅ Dashboard View
@api_view(['GET'])
def student_department_filter(request):
    """Filter students by department"""
    try:
        department_id = request.GET.get('department_id')
        if department_id:
            students = Student.objects.filter(department__department_id=department_id)
        else:
            students = Student.objects.all()
        
        serializer = StudentSerializer(students, many=True)
        return Response({
            'success': True,
            'students': serializer.data,
            'count': students.count()
        })
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def StudentDashboardView(request, student_id):
    try:
        student = Student.objects.get(student_id=student_id)
        results = Result.objects.filter(student=student).order_by('-exam_date')[:5]
        notes = generate_performance_notes(student)

        student_data = {
            "id": student.student_id,
            "name": student.name,
            "email": student.email,
            "department": student.department.name if student.department else None,
            "semester": student.semester.name if student.semester else None,
            "gpa": student.gpa,
            "attendance": student.attendance_percentage,
        }

        results_data = [
            {
                "subject": r.course.name if r.course else "N/A",
                "grade": r.grade,
                "marks": f"{r.obtained_marks}/{r.total_marks}",
                "percentage": r.percentage,
            }
            for r in results
        ]

        scholarships = list(
            Scholarship.objects.filter(students=student).values_list("name", flat=True)
        )

        data = {
            "student": student_data,
            "recent_results": results_data,
            "scholarships": scholarships,
            "performance_notes": notes,
        }

        return Response(data, status=status.HTTP_200_OK)

    except Student.DoesNotExist:
        return Response({"error": "Student not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
