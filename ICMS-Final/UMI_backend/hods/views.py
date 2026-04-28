from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.permissions import IsAuthenticated
from .models import HOD
from register.multi_role_service import MultiRoleService
from .serializers import HODSerializer
from .permissions import IsAdminUser
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
User = get_user_model()
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def hod_dashboard(request):
    """Get HOD dashboard data"""
    try:
        from academics.models import Course, Department, Semester
        from instructors.models import Instructor
        
        # Get HOD's department
        hod_department = None
        try:
            hod = HOD.objects.filter(user=request.user).first()
            if hod:
                hod_department = hod.department
        except:
            pass
            
        if not hod_department:
            # No HOD profile found for this user
            return Response({'error': 'HOD profile not found'}, status=404)

        if not hod_department:
            return Response({'error': 'HOD department not found'}, status=404)

        # Get data
        courses = Course.objects.filter(semester__department=hod_department)
        semesters = Semester.objects.filter(department=hod_department)
        instructors = Instructor.objects.filter(department=hod_department)
        
        # Format data
        department_data = {
            'id': getattr(hod_department, 'id', getattr(hod_department, 'department_id', 1)),
            'name': hod_department.name,
            'code': hod_department.code
        }

        semesters_data = []
        for semester in semesters:
            semesters_data.append({
                'semester_id': semester.semester_id,
                'name': semester.name,
                'semester_code': getattr(semester, 'semester_code', f'{semester.program}-{semester.semester_id}'),
                'program': semester.program
            })

        courses_data = []
        for course in courses:
            courses_data.append({
                'course_id': course.course_id,
                'name': course.name,
                'code': course.code,
                'credits': course.credits,
                'semester_id': course.semester.semester_id if course.semester else None
            })

        instructors_data = []
        for instructor in instructors:
            instructors_data.append({
                'id': instructor.id,
                'name': instructor.name,
                'employee_id': instructor.employee_id,
                'specialization': instructor.specialization
            })

        return Response({
            'department': department_data,
            'semesters': semesters_data,
            'courses': courses_data,
            'instructors': instructors_data,
            'statistics': {
                'total_courses': courses.count(),
                'total_instructors': instructors.count(),
                'total_semesters': semesters.count()
            }
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=500)
        
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def hod_profile(request):
    """Get current HOD's profile"""
    try:
        print(f"Looking for HOD with email: {request.user.email}")
        print(f"All HODs: {list(HOD.objects.all().values_list('email', 'name'))}")
        
        # Find HOD by email since they registered with their email
        hod = HOD.objects.filter(email=request.user.email).first()
        if not hod:
            print("HOD not found by email, trying by user")
            # Try by user relationship
            hod = HOD.objects.filter(user=request.user).first()
        
        if not hod:
            return Response({'error': 'HOD profile not found'}, status=404)
        
        print(f"Found HOD: {hod.name}, Department: {hod.department}")
        if hod.department:
            print(f"Department details: id={hod.department.department_id}, name={hod.department.name}, code={hod.department.code}, description={hod.department.description}, num_semesters={hod.department.num_semesters}")
        
        # Manual serialization to avoid serializer issues
        data = {
            'id': hod.id,
            'name': hod.name,
            'email': hod.email,
            'phone': hod.phone,
            'employee_id': hod.employee_id,
            'designation': hod.designation,
            'specialization': hod.specialization,
            'experience_years': hod.experience_years,
            'hire_date': hod.hire_date.isoformat() if hod.hire_date else None,
            'department': {
                'id': getattr(hod.department, 'department_id', getattr(hod.department, 'pk', None)) if hod.department else None,
                'name': hod.department.name if hod.department else None
            },
            'image': request.build_absolute_uri(hod.image.url) if hod.image else None
        }
        
        return Response(data)
    except Exception as e:
        import traceback
        print(f"HOD Profile Error: {str(e)}")
        print(traceback.format_exc())
        return Response({'error': str(e)}, status=500)