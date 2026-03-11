from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Q
from django.utils import timezone
from datetime import datetime, timedelta
from .models import Coordinator, TimetableProposal, CourseAllocation, CoordinatorDashboard
from academics.models import Course, Timetable, Attendance
from instructors.models import Instructor

def _get_coordinator_for_user(user):
    if hasattr(user, 'coordinator_profile'):
        return user.coordinator_profile

    try:
        return Coordinator.objects.get(user=user)
    except Coordinator.DoesNotExist:
        pass

    employee_id = None
    if hasattr(user, 'instructor_profile'):
        employee_id = user.instructor_profile.employee_id
    else:
        try:
            instructor = Instructor.objects.get(user=user)
            employee_id = instructor.employee_id
        except Instructor.DoesNotExist:
            employee_id = None

    if employee_id:
        try:
            return Coordinator.objects.get(employee_id=employee_id)
        except Coordinator.DoesNotExist:
            return None

    return None

class CoordinatorProfessionalDashboardViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]
    
    def get_coordinator(self):
        return _get_coordinator_for_user(self.request.user)
    
    @action(detail=False, methods=['get'])
    def dashboard_overview(self, request):
        """Get comprehensive dashboard overview"""
        if not (request.user.has_role('coordinator') if hasattr(request.user, 'has_role') else request.user.role == 'coordinator'):
            return Response({'error': 'Only coordinators can access this dashboard'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        coordinator = self.get_coordinator()
        if not coordinator:
            return Response({'error': 'Coordinator profile not found'}, 
                          status=status.HTTP_404_NOT_FOUND)
        
        # Update dashboard metrics
        dashboard, created = CoordinatorDashboard.objects.get_or_create(coordinator=coordinator)
        dashboard.update_metrics()
        
        # Get recent activities
        recent_proposals = TimetableProposal.objects.filter(
            coordinator=coordinator
        ).order_by('-created_at')[:5]
        
        recent_allocations = CourseAllocation.objects.filter(
            coordinator=coordinator
        ).order_by('-proposed_at')[:5]
        
        # Get pending approvals
        pending_proposals = TimetableProposal.objects.filter(
            coordinator=coordinator,
            status='submitted'
        ).count()
        
        pending_allocations = CourseAllocation.objects.filter(
            coordinator=coordinator,
            status='proposed'
        ).count()
        
        # Get department statistics
        department_courses = Course.objects.filter(
            semester__department=coordinator.department
        ).count()
        
        department_instructors = Instructor.objects.filter(
            department=coordinator.department
        ).count()
        
        # Performance metrics
        approved_proposals = TimetableProposal.objects.filter(
            coordinator=coordinator,
            status__in=['approved', 'implemented']
        ).count()
        
        total_proposals = TimetableProposal.objects.filter(
            coordinator=coordinator
        ).count()
        
        approval_rate = (approved_proposals / total_proposals * 100) if total_proposals > 0 else 0
        
        return Response({
            'coordinator_info': {
                'name': coordinator.name,
                'department': coordinator.department.name if coordinator.department else None,
                'can_act_as_instructor': coordinator.can_act_as_instructor,
                'experience_years': coordinator.experience_years
            },
            'dashboard_metrics': {
                'total_courses_managed': dashboard.total_courses_managed,
                'total_instructors_coordinated': dashboard.total_instructors_coordinated,
                'pending_approvals': dashboard.pending_approvals,
                'active_timetables': dashboard.active_timetables,
                'approval_rate': round(approval_rate, 2)
            },
            'department_overview': {
                'total_courses': department_courses,
                'total_instructors': department_instructors,
                'pending_proposals': pending_proposals,
                'pending_allocations': pending_allocations
            },
            'recent_activities': {
                'proposals': [
                    {
                        'id': p.proposal_id,
                        'title': p.title,
                        'status': p.status,
                        'created_at': p.created_at,
                        'semester': p.semester.name
                    } for p in recent_proposals
                ],
                'allocations': [
                    {
                        'id': a.allocation_id,
                        'course': a.course.name,
                        'instructor': a.instructor.name,
                        'status': a.status,
                        'proposed_at': a.proposed_at
                    } for a in recent_allocations
                ]
            },
            'professional_development': {
                'training_hours': dashboard.training_hours,
                'performance_rating': dashboard.performance_rating,
                'certifications': dashboard.certifications
            }
        })
    
    @action(detail=False, methods=['get'])
    def workload_analysis(self, request):
        """Analyze coordinator's workload"""
        if not (request.user.has_role('coordinator') if hasattr(request.user, 'has_role') else request.user.role == 'coordinator'):
            return Response({'error': 'Only coordinators can access this dashboard'}, 
                          status=status.HTTP_403_FORBIDDEN)

        coordinator = self.get_coordinator()
        if not coordinator:
            return Response({'error': 'Coordinator profile not found'}, 
                          status=status.HTTP_404_NOT_FOUND)
        
        # Current semester workload
        current_allocations = CourseAllocation.objects.filter(
            coordinator=coordinator,
            status__in=['approved', 'active']
        )
        
        # Instructor distribution
        instructor_workload = {}
        for allocation in current_allocations:
            instructor_name = allocation.instructor.name
            if instructor_name not in instructor_workload:
                instructor_workload[instructor_name] = {
                    'courses': [],
                    'total_courses': 0
                }
            instructor_workload[instructor_name]['courses'].append(allocation.course.name)
            instructor_workload[instructor_name]['total_courses'] += 1
        
        # Time slot analysis
        active_timetables = TimetableProposal.objects.filter(
            coordinator=coordinator,
            status='implemented'
        )
        
        time_slot_usage = {}
        for proposal in active_timetables:
            for slot in proposal.slots.all():
                day = slot.day
                time_key = f"{slot.start_time}-{slot.end_time}"
                
                if day not in time_slot_usage:
                    time_slot_usage[day] = {}
                if time_key not in time_slot_usage[day]:
                    time_slot_usage[day][time_key] = []
                
                time_slot_usage[day][time_key].append({
                    'course': slot.course.name,
                    'instructor': slot.instructor.name if slot.instructor else 'TBA',
                    'room': slot.room
                })
        
        return Response({
            'workload_summary': {
                'total_active_allocations': current_allocations.count(),
                'unique_instructors': len(instructor_workload),
                'active_timetable_proposals': active_timetables.count()
            },
            'instructor_distribution': instructor_workload,
            'time_slot_analysis': time_slot_usage
        })
    
    @action(detail=False, methods=['get'])
    def performance_metrics(self, request):
        """Get detailed performance metrics"""
        if not (request.user.has_role('coordinator') if hasattr(request.user, 'has_role') else request.user.role == 'coordinator'):
            return Response({'error': 'Only coordinators can access this dashboard'}, 
                          status=status.HTTP_403_FORBIDDEN)

        coordinator = self.get_coordinator()
        if not coordinator:
            return Response({'error': 'Coordinator profile not found'}, 
                          status=status.HTTP_404_NOT_FOUND)
        
        # Monthly performance over last 6 months
        monthly_data = []
        for i in range(6):
            month_start = timezone.now().replace(day=1) - timedelta(days=30*i)
            month_end = month_start + timedelta(days=30)
            
            proposals_created = TimetableProposal.objects.filter(
                coordinator=coordinator,
                created_at__range=[month_start, month_end]
            ).count()
            
            proposals_approved = TimetableProposal.objects.filter(
                coordinator=coordinator,
                reviewed_at__range=[month_start, month_end],
                status__in=['approved', 'implemented']
            ).count()
            
            allocations_created = CourseAllocation.objects.filter(
                coordinator=coordinator,
                proposed_at__range=[month_start, month_end]
            ).count()
            
            allocations_approved = CourseAllocation.objects.filter(
                coordinator=coordinator,
                approved_at__range=[month_start, month_end],
                status='approved'
            ).count()
            
            monthly_data.append({
                'month': month_start.strftime('%B %Y'),
                'proposals_created': proposals_created,
                'proposals_approved': proposals_approved,
                'allocations_created': allocations_created,
                'allocations_approved': allocations_approved
            })
        
        # Overall statistics
        total_proposals = TimetableProposal.objects.filter(coordinator=coordinator).count()
        approved_proposals = TimetableProposal.objects.filter(
            coordinator=coordinator,
            status__in=['approved', 'implemented']
        ).count()
        
        total_allocations = CourseAllocation.objects.filter(coordinator=coordinator).count()
        approved_allocations = CourseAllocation.objects.filter(
            coordinator=coordinator,
            status='approved'
        ).count()
        
        return Response({
            'overall_performance': {
                'proposal_success_rate': (approved_proposals / total_proposals * 100) if total_proposals > 0 else 0,
                'allocation_success_rate': (approved_allocations / total_allocations * 100) if total_allocations > 0 else 0,
                'total_proposals': total_proposals,
                'total_allocations': total_allocations
            },
            'monthly_performance': monthly_data
        })
    
    @action(detail=False, methods=['post'])
    def update_professional_info(self, request):
        """Update professional development information"""
        coordinator = self.get_coordinator()
        dashboard, created = CoordinatorDashboard.objects.get_or_create(coordinator=coordinator)
        
        training_hours = request.data.get('training_hours')
        certifications = request.data.get('certifications')
        
        if training_hours is not None:
            dashboard.training_hours = training_hours
        
        if certifications is not None:
            dashboard.certifications = certifications
        
        dashboard.save()
        
        return Response({
            'message': 'Professional information updated successfully',
            'training_hours': dashboard.training_hours,
            'certifications': dashboard.certifications
        })
