from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Department, Semester, Course, Timetable
from instructors.models import Instructor

class ClassFormDataView(APIView):
    """
    Get all data needed for Add Class form
    """
    permission_classes = []
    
    def post(self, request):
        """Test endpoint to check data"""
        from academics.models import Department, Semester, Course
        from instructors.models import Instructor
        
        return Response({
            'test': 'working',
            'counts': {
                'departments': Department.objects.count(),
                'semesters': Semester.objects.count(), 
                'courses': Course.objects.count(),
                'instructors': Instructor.objects.count()
            }
        })
    
    def get(self, request):
        """Get departments, semesters, courses, and instructors"""
        try:
            # Get all departments
            departments = Department.objects.all()
            departments_data = []
            for dept in departments:
                departments_data.append({
                    'department_id': dept.department_id,
                    'name': dept.name,
                    'code': dept.code,
                    'description': dept.description
                })
            
            # Get all semesters with department info
            semesters = Semester.objects.select_related('department').all()
            semesters_data = []
            for sem in semesters:
                semesters_data.append({
                    'semester_id': sem.semester_id,
                    'name': sem.name,
                    'semester_code': sem.semester_code,
                    'program': sem.program,
                    'capacity': sem.capacity,
                    'department': {
                        'department_id': sem.department.department_id,
                        'name': sem.department.name,
                        'code': sem.department.code
                    }
                })
            
            # Get all courses with semester and department info
            courses = Course.objects.select_related('semester__department').all()
            courses_data = []
            for course in courses:
                courses_data.append({
                    'course_id': course.course_id,
                    'name': course.name,
                    'code': course.code,
                    'description': course.description,
                    'credits': course.credits,
                    'semester': {
                        'semester_id': course.semester.semester_id if course.semester else None,
                        'name': course.semester.name if course.semester else 'N/A',
                        'semester_code': course.semester.semester_code if course.semester else 'N/A'
                    },
                    'department': {
                        'department_id': course.semester.department.department_id if course.semester else None,
                        'name': course.semester.department.name if course.semester else 'N/A',
                        'code': course.semester.department.code if course.semester else 'N/A'
                    }
                })
            
            # Get all instructors with department info
            instructors = Instructor.objects.select_related('department').all()
            instructors_data = []
            for instructor in instructors:
                instructors_data.append({
                    'id': instructor.id,
                    'name': instructor.name,
                    'employee_id': instructor.employee_id,
                    'specialization': instructor.specialization,
                    'designation': instructor.designation,
                    'department': {
                        'department_id': instructor.department.department_id if instructor.department else None,
                        'name': instructor.department.name if instructor.department else 'N/A',
                        'code': instructor.department.code if instructor.department else 'N/A'
                    }
                })
            
            # Day choices for timetable
            day_choices = [
                {'value': 'monday', 'label': 'Monday'},
                {'value': 'tuesday', 'label': 'Tuesday'},
                {'value': 'wednesday', 'label': 'Wednesday'},
                {'value': 'thursday', 'label': 'Thursday'},
                {'value': 'friday', 'label': 'Friday'},
                {'value': 'saturday', 'label': 'Saturday'},
                {'value': 'sunday', 'label': 'Sunday'}
            ]
            
            # Time slots
            time_slots = [
                {'value': '08:00', 'label': '8:00 AM'},
                {'value': '09:00', 'label': '9:00 AM'},
                {'value': '10:00', 'label': '10:00 AM'},
                {'value': '11:00', 'label': '11:00 AM'},
                {'value': '12:00', 'label': '12:00 PM'},
                {'value': '13:00', 'label': '1:00 PM'},
                {'value': '14:00', 'label': '2:00 PM'},
                {'value': '15:00', 'label': '3:00 PM'},
                {'value': '16:00', 'label': '4:00 PM'},
                {'value': '17:00', 'label': '5:00 PM'}
            ]
            
            return Response({
                'departments': departments_data,
                'semesters': semesters_data,
                'courses': courses_data,
                'instructors': instructors_data,
                'days': day_choices,
                'time_slots': time_slots,
                'counts': {
                    'departments': len(departments_data),
                    'semesters': len(semesters_data),
                    'courses': len(courses_data),
                    'instructors': len(instructors_data)
                }
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class FilteredDataView(APIView):
    """
    Get filtered data based on selections
    """
    permission_classes = []
    
    def get(self, request):
        """Get filtered courses and instructors based on department/semester"""
        try:
            department_id = request.GET.get('department_id')
            semester_id = request.GET.get('semester_id')
            
            # Filter courses
            courses_query = Course.objects.select_related('semester__department')
            if department_id:
                courses_query = courses_query.filter(semester__department_id=department_id)
            if semester_id:
                courses_query = courses_query.filter(semester_id=semester_id)
            
            courses_data = []
            for course in courses_query:
                courses_data.append({
                    'course_id': course.course_id,
                    'name': course.name,
                    'code': course.code,
                    'credits': course.credits
                })
            
            # Filter instructors
            instructors_query = Instructor.objects.select_related('department')
            if department_id:
                instructors_query = instructors_query.filter(department_id=department_id)
            
            instructors_data = []
            for instructor in instructors_query:
                instructors_data.append({
                    'id': instructor.id,
                    'name': instructor.name,
                    'employee_id': instructor.employee_id,
                    'specialization': instructor.specialization
                })
            
            return Response({
                'courses': courses_data,
                'instructors': instructors_data
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)