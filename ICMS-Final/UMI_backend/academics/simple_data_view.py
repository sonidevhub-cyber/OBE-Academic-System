from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Department, Semester, Course
from instructors.models import Instructor

class SimpleDataView(APIView):
    permission_classes = []
    
    def get(self, request):
        # Simple data structure
        departments = []
        for dept in Department.objects.all():
            departments.append({
                'id': dept.department_id,
                'name': dept.name,
                'code': dept.code
            })
        
        semesters = []
        for sem in Semester.objects.all():
            semesters.append({
                'id': sem.semester_id,
                'name': sem.name,
                'code': sem.semester_code
            })
        
        courses = []
        for course in Course.objects.all():
            courses.append({
                'id': course.course_id,
                'name': course.name,
                'code': course.code
            })
        
        instructors = []
        for inst in Instructor.objects.all():
            instructors.append({
                'id': inst.id,
                'name': inst.name,
                'employee_id': inst.employee_id
            })
        
        return Response({
            'departments': departments,
            'semesters': semesters,
            'courses': courses,
            'instructors': instructors
        })