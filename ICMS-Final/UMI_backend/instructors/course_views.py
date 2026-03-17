from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from coordinators.models import CourseAllocation
from .models import Instructor
from .serializers import InstructorSerializer

class InstructorCourseViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for instructors to view their allocated courses"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'instructor_profile'):
            instructor = user.instructor_profile
            return CourseAllocation.objects.filter(
                instructor=instructor,
                status__in=['approved','active']
            ).select_related('course', 'semester', 'coordinator')
        return CourseAllocation.objects.none()
    
    def list(self, request):
        """Get all active course allocations for the instructor"""
        allocations = self.get_queryset()
        
        courses_data = []
        for allocation in allocations:
            courses_data.append({
                'allocation_id': allocation.allocation_id,
                'course_id': allocation.course.course_id,
                'course_name': allocation.course.name,
                'course_code': allocation.course.code,
                'course_description': allocation.course.description,
                'credits': allocation.course.credits,
                'semester_id': allocation.semester.semester_id,
                'semester_name': allocation.semester.name,
                'semester_code': allocation.semester.semester_code,
                'department': allocation.semester.department.name,
                'coordinator_name': allocation.coordinator.name,
                'approved_at': allocation.approved_at,
                'hod_comments': allocation.hod_comments,
                'status': allocation.status
            })
        
        return Response({
            'courses': courses_data,
            'total_courses': len(courses_data)
        })
    
    @action(detail=False, methods=['get'])
    def my_courses_summary(self, request):
        """Get summary of instructor's courses"""
        user = request.user
        if not hasattr(user, 'instructor_profile'):
            return Response({'error': 'User is not an instructor'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        instructor = user.instructor_profile
        allocations = CourseAllocation.objects.filter(instructor=instructor)
        
        summary = {
            'total_allocated': allocations.count(),
            'active_courses': allocations.filter(status='active').count(),
            'pending_approval': allocations.filter(status='proposed').count(),
            'approved_courses': allocations.filter(status='approved').count(),
            'rejected_courses': allocations.filter(status='rejected').count(),
        }
        
        # Get recent allocations
        recent_allocations = allocations.order_by('-proposed_at')[:5]
        recent_data = []
        for allocation in recent_allocations:
            recent_data.append({
                'course_name': allocation.course.name,
                'course_code': allocation.course.code,
                'status': allocation.status,
                'proposed_at': allocation.proposed_at,
                'approved_at': allocation.approved_at
            })
        
        summary['recent_allocations'] = recent_data
        
        return Response(summary)
    
    @action(detail=False, methods=['get'])
    def course_details(self, request):
        """Get detailed information about a specific course"""
        course_id = request.query_params.get('course_id')
        if not course_id:
            return Response({'error': 'course_id parameter is required'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        user = request.user
        if not hasattr(user, 'instructor_profile'):
            return Response({'error': 'User is not an instructor'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        instructor = user.instructor_profile
        try:
            allocation = CourseAllocation.objects.get(
                instructor=instructor,
                course_id=course_id,
                status='active'
            )
            
            # Get students enrolled in this course's semester
            students = allocation.semester.get_students()
            students_data = []
            for student in students:
                students_data.append({
                    'student_id': student.student_id,
                    'name': student.name,
                    'email': student.email,
                    'phone': student.phone
                })
            
            course_details = {
                'allocation_id': allocation.allocation_id,
                'course': {
                    'course_id': allocation.course.course_id,
                    'name': allocation.course.name,
                    'code': allocation.course.code,
                    'description': allocation.course.description,
                    'credits': allocation.course.credits
                },
                'semester': {
                    'semester_id': allocation.semester.semester_id,
                    'name': allocation.semester.name,
                    'code': allocation.semester.semester_code,
                    'program': allocation.semester.program,
                    'capacity': allocation.semester.capacity,
                    'department': allocation.semester.department.name
                },
                'coordinator': {
                    'name': allocation.coordinator.name,
                    'email': allocation.coordinator.email,
                    'phone': allocation.coordinator.phone
                },
                'students': students_data,
                'total_students': len(students_data),
                'approved_at': allocation.approved_at,
                'hod_comments': allocation.hod_comments
            }
            
            return Response(course_details)
            
        except CourseAllocation.DoesNotExist:
            return Response({'error': 'Course allocation not found or not active'}, 
                          status=status.HTTP_404_NOT_FOUND)