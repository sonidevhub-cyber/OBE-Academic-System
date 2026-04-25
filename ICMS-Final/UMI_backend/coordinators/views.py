from rest_framework import viewsets, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django.db import IntegrityError
from students.models import Student
from instructors.models import Instructor as InstructorModel
from .models import AllocationStudent


from .models import Coordinator, TimetableProposal, TimetableSlot, CourseAllocation, CoordinatorDashboard
from .serializers import (
    CoordinatorSerializer, TimetableProposalSerializer, TimetableSlotSerializer,
    CourseAllocationSerializer, CoordinatorDashboardSerializer,
    CreateTimetableProposalSerializer, CreateTimetableSlotSerializer, CreateCourseAllocationSerializer
)
from academics.models import Course, Semester, Timetable

from hods.models import HOD

def _is_hod_user(user):
    # Support multi-role users: allow HOD permissions when an HOD profile exists,
    # even if active_role is temporarily set to another role.
    if hasattr(user, 'hod_profile'):
        return True

    current_role = user.get_current_role() if hasattr(user, 'get_current_role') else getattr(user, 'role', None)
    if current_role == 'hod' or getattr(user, 'role', None) == 'hod':
        return True

    return HOD.objects.filter(user=user).exists()

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
            instructor = InstructorModel.objects.get(user=user)
            employee_id = instructor.employee_id
        except InstructorModel.DoesNotExist:
            employee_id = None

    if employee_id:
        try:
            return Coordinator.objects.get(employee_id=employee_id)
        except Coordinator.DoesNotExist:
            return None

    return None


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def coordinator_profile(request):
    coordinator = _get_coordinator_for_user(request.user)
    if not coordinator:
        return Response({'error': 'Coordinator profile not found'}, status=status.HTTP_404_NOT_FOUND)

    profile_image_url = None
    if coordinator.image:
        try:
            profile_image_url = request.build_absolute_uri(coordinator.image.url)
        except Exception:
            profile_image_url = coordinator.image.url

    department_data = None
    if coordinator.department:
        department_data = {
            'id': getattr(coordinator.department, 'department_id', coordinator.department.pk),
            'department_id': getattr(coordinator.department, 'department_id', coordinator.department.pk),
            'name': coordinator.department.name,
            'code': getattr(coordinator.department, 'code', None),
        }

    return Response({
        'id': coordinator.id,
        'name': coordinator.name,
        'full_name': coordinator.name,
        'username': coordinator.user.username if coordinator.user else None,
        'email': coordinator.email or (coordinator.user.email if coordinator.user else None),
        'employee_id': coordinator.employee_id,
        'phone': coordinator.phone,
        'designation': coordinator.designation,
        'specialization': coordinator.specialization,
        'experience_years': coordinator.experience_years,
        'hire_date': coordinator.hire_date.isoformat() if coordinator.hire_date else None,
        'date_of_birth': coordinator.date_of_birth.isoformat() if coordinator.date_of_birth else None,
        'gender': coordinator.gender,
        'department': department_data,
        'department_name': coordinator.department.name if coordinator.department else None,
        'can_act_as_instructor': coordinator.can_act_as_instructor,
        'assigned_by': coordinator.assigned_by.name if coordinator.assigned_by else None,
        'is_active': coordinator.is_active,
        'status': 'active' if coordinator.is_active else 'inactive',
        'role': 'coordinator',
        'image': profile_image_url,
        'profile_image': profile_image_url,
        'created_at': coordinator.created_at.isoformat() if coordinator.created_at else None,
        'updated_at': coordinator.updated_at.isoformat() if coordinator.updated_at else None,
    })

class CoordinatorViewSet(viewsets.ModelViewSet):
    queryset = Coordinator.objects.all()
    serializer_class = CoordinatorSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        coordinator = _get_coordinator_for_user(user)
        if coordinator:
            return Coordinator.objects.filter(id=coordinator.id)
        elif user.has_role('hod') or user.role == 'hod':
            hod = HOD.objects.get(user=user)
            return Coordinator.objects.filter(department=hod.department)
        return Coordinator.objects.all()
    
    @action(detail=False, methods=['get'])
    def get_user_roles(self, request):
        """Get available roles for current user"""
        user = request.user
        roles = []
        
        # Check if user has coordinator profile
        if hasattr(user, 'coordinator_profile'):
            coordinator = user.coordinator_profile
            roles.append({
                'role': 'coordinator',
                'name': 'Coordinator',
                'can_act_as_instructor': coordinator.can_act_as_instructor
            })
            
            # If coordinator can act as instructor, add instructor role
            if coordinator.can_act_as_instructor:
                roles.append({
                    'role': 'instructor',
                    'name': 'Instructor'
                })
        
        # Check if user has instructor profile
        elif hasattr(user, 'instructor_profile'):
            roles.append({
                'role': 'instructor',
                'name': 'Instructor'
            })
        
        return Response({
            'current_role': user.role,
            'available_roles': roles
        })
    
    @action(detail=False, methods=['post'])
    def switch_role(self, request):
        """Switch between coordinator and instructor roles"""
        user = request.user
        target_role = request.data.get('role')
        
        if not target_role:
            return Response({'error': 'Role is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate role switch
        if hasattr(user, 'coordinator_profile'):
            coordinator = user.coordinator_profile
            
            if target_role == 'coordinator':
                user.role = 'coordinator'
                user.save()
                return Response({
                    'message': 'Switched to coordinator role',
                    'current_role': 'coordinator'
                })
            
            elif target_role == 'instructor' and coordinator.can_act_as_instructor:
                user.role = 'instructor'
                user.save()
                return Response({
                    'message': 'Switched to instructor role',
                    'current_role': 'instructor'
                })
            
            else:
                return Response({'error': 'You do not have permission to switch to instructor role'}, 
                              status=status.HTTP_403_FORBIDDEN)
        
        return Response({'error': 'Invalid role switch'}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def toggle_instructor_role(self, request, pk=None):
        """HOD can toggle if coordinator can act as instructor"""
        if not _is_hod_user(request.user):
            return Response({'error': 'Only HOD can modify instructor permissions'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        coordinator = self.get_object()
        coordinator.can_act_as_instructor = not coordinator.can_act_as_instructor
        coordinator.save()
        
        return Response({
            'message': f'Coordinator {"can now" if coordinator.can_act_as_instructor else "cannot"} act as instructor',
            'can_act_as_instructor': coordinator.can_act_as_instructor
        })

class TimetableProposalViewSet(viewsets.ModelViewSet):
    queryset = TimetableProposal.objects.all()
    serializer_class = TimetableProposalSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if _is_hod_user(user):
            try:
                hod = HOD.objects.get(user=user)
                return TimetableProposal.objects.filter(coordinator__department=hod.department)
            except HOD.DoesNotExist:
                return TimetableProposal.objects.none()

        coordinator = _get_coordinator_for_user(user)
        if coordinator:
            return TimetableProposal.objects.filter(coordinator=coordinator)
        return TimetableProposal.objects.all()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return CreateTimetableProposalSerializer
        return TimetableProposalSerializer
    
    def perform_create(self, serializer):
        coordinator = _get_coordinator_for_user(self.request.user)
        if coordinator:
            with transaction.atomic():
                proposal = serializer.save(coordinator=coordinator)

                raw_slots = self.request.data.get('slots', []) or []
                created_slots = 0

                for slot in raw_slots:
                    allocation_id = slot.get('allocation_id')
                    course = None
                    instructor = None

                    if allocation_id:
                        allocation = CourseAllocation.objects.filter(
                            allocation_id=allocation_id,
                            coordinator=coordinator
                        ).select_related('course', 'instructor').first()
                        if not allocation:
                            continue
                        course = allocation.course
                        instructor = allocation.instructor
                    else:
                        course_id = slot.get('course')
                        instructor_id = slot.get('instructor')
                        if course_id:
                            course = Course.objects.filter(course_id=course_id).first()
                        if instructor_id:
                            instructor = InstructorModel.objects.filter(id=instructor_id).first()

                    if not course:
                        continue

                    day = str(slot.get('day', '')).strip().lower()
                    if not day:
                        continue

                    TimetableSlot.objects.create(
                        proposal=proposal,
                        course=course,
                        instructor=instructor,
                        day=day,
                        start_time=slot.get('start_time'),
                        end_time=slot.get('end_time'),
                        room=slot.get('room') or slot.get('room_name', '')
                    )
                    created_slots += 1

                # Support coordinator flow that directly submits proposal to HOD.
                requested_status = self.request.data.get('status')
                if requested_status == 'submitted':
                    if created_slots == 0:
                        from rest_framework import serializers
                        raise serializers.ValidationError({'error': 'At least one timetable slot is required before submission'})
                    proposal.status = 'submitted'
                    proposal.submitted_at = timezone.now()
                    proposal.save(update_fields=['status', 'submitted_at'])
            return
        
        from rest_framework import serializers
        raise serializers.ValidationError({'error': 'Only coordinators can create timetable proposals'})
    
    @action(detail=True, methods=['post'])
    def submit_to_hod(self, request, pk=None):
        """Submit timetable proposal to HOD for approval"""
        proposal = self.get_object()
        coordinator = _get_coordinator_for_user(request.user)
        
        if not coordinator or proposal.coordinator_id != coordinator.id:
            return Response({'error': 'You can only submit your own proposals'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        if proposal.status != 'draft':
            return Response({'error': 'Only draft proposals can be submitted'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        proposal.status = 'submitted'
        proposal.submitted_at = timezone.now()
        proposal.save()
        
        return Response({'message': 'Proposal submitted to HOD for approval'})
    
    @action(detail=True, methods=['post'])
    def approve_proposal(self, request, pk=None):
        """HOD approves timetable proposal"""
        if not _is_hod_user(request.user):
            return Response({'error': 'Only HOD can approve proposals'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        proposal = self.get_object()
        try:
            hod = HOD.objects.get(user=request.user)
        except HOD.DoesNotExist:
            return Response({'error': 'HOD profile not found'}, status=status.HTTP_404_NOT_FOUND)
        
        if proposal.status != 'submitted':
            return Response({'error': 'Only submitted proposals can be approved'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        proposal_slots = proposal.slots.select_related('course', 'instructor').all()
        if not proposal_slots.exists():
            return Response({'error': 'Proposal has no timetable slots to publish'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            approval_time = timezone.now()
            for slot in proposal_slots:
                Timetable.objects.update_or_create(
                    course=slot.course,
                    day=slot.day,
                    start_time=slot.start_time,
                    defaults={
                        'instructor': slot.instructor,
                        'end_time': slot.end_time,
                        'room': slot.room,
                        'approval_status': 'approved',
                        'created_by': proposal.coordinator.user if proposal.coordinator and proposal.coordinator.user else request.user,
                        'approved_by': request.user,
                        'approved_at': approval_time,
                        'rejection_reason': ''
                    }
                )

            proposal.status = 'implemented'
            proposal.reviewed_at = approval_time
            proposal.reviewed_by = hod
            proposal.hod_comments = request.data.get('comments', '')
            proposal.save(update_fields=['status', 'reviewed_at', 'reviewed_by', 'hod_comments'])
        
        return Response({'message': 'Proposal approved successfully'})
    
    @action(detail=True, methods=['post'])
    def reject_proposal(self, request, pk=None):
        """HOD rejects timetable proposal"""
        if not _is_hod_user(request.user):
            return Response({'error': 'Only HOD can reject proposals'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        proposal = self.get_object()
        try:
            hod = HOD.objects.get(user=request.user)
        except HOD.DoesNotExist:
            return Response({'error': 'HOD profile not found'}, status=status.HTTP_404_NOT_FOUND)
        
        proposal.status = 'rejected'
        proposal.reviewed_at = timezone.now()
        proposal.reviewed_by = hod
        proposal.hod_comments = request.data.get('comments', '')
        proposal.save()
        
        return Response({'message': 'Proposal rejected'})

    @action(detail=False, methods=['get'])
    def published_audit(self, request):
        """Audit implemented proposals against published academic timetable entries (HOD only)."""
        if not _is_hod_user(request.user):
            return Response({'error': 'Only HOD can view timetable publish audit'}, status=status.HTTP_403_FORBIDDEN)

        try:
            hod = HOD.objects.get(user=request.user)
        except HOD.DoesNotExist:
            return Response({'error': 'HOD profile not found'}, status=status.HTTP_404_NOT_FOUND)

        proposals = TimetableProposal.objects.filter(
            coordinator__department=hod.department,
            status='implemented'
        ).select_related('semester', 'coordinator').prefetch_related('slots__course', 'slots__instructor')

        audit_rows = []
        total_slots = 0
        published_slots = 0

        for proposal in proposals:
            slot_rows = []
            for slot in proposal.slots.all():
                total_slots += 1
                published = Timetable.objects.filter(
                    course=slot.course,
                    instructor=slot.instructor,
                    day=slot.day,
                    start_time=slot.start_time,
                    end_time=slot.end_time,
                    room=slot.room,
                    approval_status='approved'
                ).first()
                if published:
                    published_slots += 1

                slot_rows.append({
                    'proposal_slot_id': slot.id,
                    'course_name': slot.course.name if slot.course else None,
                    'course_code': slot.course.code if slot.course else None,
                    'instructor_name': slot.instructor.name if slot.instructor else 'TBA',
                    'day': slot.day,
                    'start_time': slot.start_time.strftime('%H:%M'),
                    'end_time': slot.end_time.strftime('%H:%M'),
                    'room': slot.room,
                    'published': bool(published),
                    'timetable_id': published.timetable_id if published else None
                })

            audit_rows.append({
                'proposal_id': proposal.proposal_id,
                'title': proposal.title,
                'semester_name': proposal.semester.name if proposal.semester else None,
                'coordinator_name': proposal.coordinator.name if proposal.coordinator else None,
                'reviewed_at': proposal.reviewed_at,
                'published_slots': sum(1 for s in slot_rows if s['published']),
                'total_slots': len(slot_rows),
                'slots': slot_rows
            })

        return Response({
            'department': {
                'id': hod.department.department_id if hod.department else None,
                'name': hod.department.name if hod.department else None
            },
            'summary': {
                'implemented_proposals': len(audit_rows),
                'total_slots': total_slots,
                'published_slots': published_slots,
                'unpublished_slots': max(total_slots - published_slots, 0)
            },
            'audit': audit_rows
        })

class TimetableSlotViewSet(viewsets.ModelViewSet):
    queryset = TimetableSlot.objects.all()
    serializer_class = TimetableSlotSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        proposal_id = self.request.query_params.get('proposal_id')
        if proposal_id:
            return TimetableSlot.objects.filter(proposal_id=proposal_id)
        return TimetableSlot.objects.all()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return CreateTimetableSlotSerializer
        return TimetableSlotSerializer
    
    def perform_create(self, serializer):
        proposal_id = self.request.data.get('proposal_id')
        proposal = get_object_or_404(TimetableProposal, id=proposal_id)
        coordinator = _get_coordinator_for_user(self.request.user)
        
        if not coordinator or proposal.coordinator_id != coordinator.id:
            raise PermissionError('You can only add slots to your own proposals')
        
        if proposal.status != 'draft':
            raise ValueError('Can only add slots to draft proposals')
        
        serializer.save(proposal=proposal)

class CourseAllocationViewSet(viewsets.ModelViewSet):
    queryset = CourseAllocation.objects.all()
    serializer_class = CourseAllocationSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        current_role = user.get_current_role() if hasattr(user, 'get_current_role') else getattr(user, 'active_role', None) or getattr(user, 'role', None)

        # Prioritize HOD visibility for HOD users (including multi-role users).
        if _is_hod_user(user):
            try:
                hod = HOD.objects.get(user=user)
                return CourseAllocation.objects.filter(coordinator__department=hod.department)
            except HOD.DoesNotExist:
                return CourseAllocation.objects.none()

        # If user is currently acting as instructor, only show their own allocations.
        if current_role == 'instructor' or user.role == 'instructor':
            instructor = InstructorModel.objects.filter(user=user).first()
            if instructor:
               return CourseAllocation.objects.filter(
    instructor=instructor,
    status__in=['approved', 'active']
)

            # Fallback for multi-role mappings by employee ID.
            coordinator = Coordinator.objects.filter(user=user).first()
            if coordinator and coordinator.employee_id:
                mapped_instructor = InstructorModel.objects.filter(employee_id=coordinator.employee_id).first()
                if mapped_instructor:
                    return CourseAllocation.objects.filter(instructor=mapped_instructor)

            return CourseAllocation.objects.none()

        # Coordinator access (either primary role or multi-role)
        if current_role == 'coordinator' or user.role == 'coordinator' or hasattr(user, 'coordinator_profile'):
            try:
                coordinator = Coordinator.objects.get(user=user)
                return CourseAllocation.objects.filter(coordinator=coordinator)
            except Coordinator.DoesNotExist:
                # Check by employee_id for multi-role users
                try:
                    from instructors.models import Instructor
                    instructor = Instructor.objects.get(user=user)
                    coordinator = Coordinator.objects.get(employee_id=instructor.employee_id)
                    return CourseAllocation.objects.filter(coordinator=coordinator)
                except (Instructor.DoesNotExist, Coordinator.DoesNotExist):
                    return CourseAllocation.objects.none()
        return CourseAllocation.objects.all()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return CreateCourseAllocationSerializer
        return CourseAllocationSerializer
    
    def perform_create(self, serializer):
        try:
            # First try to get coordinator by user
            coordinator = Coordinator.objects.get(user=self.request.user)
        except Coordinator.DoesNotExist:
            # For multi-role users, try to get coordinator by employee_id
            try:
                from instructors.models import Instructor
                instructor = Instructor.objects.get(user=self.request.user)
                coordinator = Coordinator.objects.get(employee_id=instructor.employee_id)
            except (Instructor.DoesNotExist, Coordinator.DoesNotExist):
                from rest_framework import serializers
                raise serializers.ValidationError({'error': 'User is not a coordinator'})

        try:
            allocation = serializer.save(coordinator=coordinator, status='proposed')

    # Students automatically attach karo
            from students.models import Student
            from .models import AllocationStudent

            students = Student.objects.filter(semester=allocation.semester)

            for student in students:
                                    AllocationStudent.objects.create(
                                            allocation=allocation,
                                             student=student
    )

        except IntegrityError:
            from rest_framework import serializers
            raise serializers.ValidationError({
             'error': 'Allocation already exists for this course and semester. Please edit the existing proposal instead.'
        })
    
    @action(detail=True, methods=['post'])
    def approve_allocation(self, request, pk=None):
        """HOD approves course allocation"""
        if not _is_hod_user(request.user):
            return Response({'error': 'Only HOD can approve allocations'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        allocation = self.get_object()
        if allocation.status != 'proposed':
            return Response({'error': 'Only proposed allocations can be approved'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            hod = HOD.objects.get(user=request.user)
        except HOD.DoesNotExist:
            return Response({'error': 'HOD profile not found'}, status=status.HTTP_404_NOT_FOUND)
        
        allocation.status = 'approved'
        allocation.approved_at = timezone.now()
        allocation.approved_by = hod
        allocation.hod_comments = request.data.get('comments', '')
        allocation.save()
        
        # Automatically activate the allocation
        allocation.activate()
        
        return Response({'message': 'Course allocation approved and activated'})
    
    @action(detail=True, methods=['post'])
    def reject_allocation(self, request, pk=None):
        """HOD rejects course allocation"""
        if not _is_hod_user(request.user):
            return Response({'error': 'Only HOD can reject allocations'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        allocation = self.get_object()
        if allocation.status != 'proposed':
            return Response({'error': 'Only proposed allocations can be rejected'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            hod = HOD.objects.get(user=request.user)
        except HOD.DoesNotExist:
            return Response({'error': 'HOD profile not found'}, status=status.HTTP_404_NOT_FOUND)
        
        allocation.status = 'rejected'
        allocation.approved_at = timezone.now()
        allocation.approved_by = hod
        allocation.hod_comments = request.data.get('comments', '')
        allocation.rejection_reason = request.data.get('rejection_reason', '')
        allocation.save()
        
        return Response({'message': 'Course allocation rejected'})
    @action(detail=True, methods=['get'])
    def students(self, request, pk=None):
        allocation = self.get_object()
        students = AllocationStudent.objects.filter(allocation=allocation)

        data = [    
           {
            "id": s.student.id,
            "name": s.student.name,
            "registration_number": s.student.registration_number
            }
         for s in students
         ]
    
        return Response(data)

class CoordinatorDashboardViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CoordinatorDashboard.objects.all()
    serializer_class = CoordinatorDashboardSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        coordinator = _get_coordinator_for_user(self.request.user)
        if coordinator:
            return CoordinatorDashboard.objects.filter(coordinator=coordinator)
        return CoordinatorDashboard.objects.all()
    
    @action(detail=True, methods=['post'])
    def refresh_metrics(self, request, pk=None):
        """Refresh dashboard metrics"""
        dashboard = self.get_object()
        dashboard.update_metrics()
        return Response({'message': 'Dashboard metrics updated'})

