from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth import get_user_model
from .models import HOD, HODRegistrationRequest
from .serializers import HODSerializer, HODRegistrationRequestSerializer
from .permissions import IsAdminUser
from academics.models import Department
from register.multi_role_service import MultiRoleService
from coordinators.models import Coordinator, CoordinatorDashboard

User = get_user_model()

class HODStatsView(APIView):
    """
    GET /api/hods/admin/stats/
    Get HOD statistics for admin dashboard
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        try:
            # Get active HODs count
            active_hods = HODRegistrationRequest.objects.filter(status='approved').count()
            
            # Get pending requests count
            pending_requests = HODRegistrationRequest.objects.filter(status='pending').count()
            
            # Get departments with HODs
            departments_with_hods = Department.objects.filter(
                hodregistrationrequest__status='approved'
            ).distinct().count()
            
            # Get total departments
            total_departments = Department.objects.count()
            
            return Response({
                'success': True,
                'data': {
                    'active_hods': active_hods,
                    'pending_requests': pending_requests,
                    'departments_with_hods': departments_with_hods,
                    'departments_without_hods': total_departments - departments_with_hods,
                    'total_departments': total_departments
                }
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class HODDepartmentListView(APIView):
    """
    GET /api/hods/admin/departments/
    Get all departments for HOD assignment
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        try:
            departments = Department.objects.all().order_by('name')
            
            department_data = []
            for dept in departments:
                # Check if department has an active HOD
                active_hod = HODRegistrationRequest.objects.filter(
                    department=dept,
                    status='approved'
                ).first()
                
                department_data.append({
                    'id': dept.department_id,
                    'name': dept.name,
                    'code': dept.code,
                    'has_hod': bool(active_hod),
                    'hod_name': active_hod.name if active_hod else None,
                    'hod_id': active_hod.id if active_hod else None
                })
            
            return Response({
                'success': True,
                'data': department_data,
                'count': len(department_data)
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CreateHODFromRequestView(APIView):
    """
    POST /api/hods/admin/create-from-request/
    Create HOD directly from approved request
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        try:
            request_id = request.data.get('request_id')
            
            if not request_id:
                return Response({
                    'success': False,
                    'error': 'Request ID is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get the approved HOD request
            hod_request = HODRegistrationRequest.objects.get(
                id=request_id,
                status='approved'
            )
            
            # Check if HOD already exists
            if HOD.objects.filter(email=hod_request.email).exists():
                return Response({
                    'success': False,
                    'error': 'HOD record already exists for this request'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create user if doesn't exist
            user, created = User.objects.get_or_create(
                email=hod_request.email,
                defaults={
                    'username': hod_request.employee_id,
                    'role': 'hod',
                    'name': hod_request.name
                }
            )
            
            if created:
                user.set_password(hod_request.password)
                user.save()
            
            # Create HOD record
            hod = HOD.objects.create(
                user=user,
                employee_id=hod_request.employee_id,
                name=hod_request.name,
                email=hod_request.email,
                phone=hod_request.phone,
                department=hod_request.department,
                designation=hod_request.designation,
                specialization=hod_request.specialization,
                experience_years=hod_request.experience_years,
                hire_date=hod_request.reviewed_at.date() if hod_request.reviewed_at else None
            )
            
            return Response({
                'success': True,
                'message': f'HOD {hod.name} created successfully',
                'data': {
                    'hod_id': hod.id,
                    'name': hod.name,
                    'department': hod.department.name if hod.department else 'N/A'
                }
            })
            
        except HODRegistrationRequest.DoesNotExist:
            return Response({
                'success': False,
                'error': 'HOD request not found or not approved'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'success': False,
                'error': f'Creation failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class HODRecordDetailView(APIView):
    """
    GET/PUT/DELETE /api/hods/admin/records/{id}/
    Manage individual HOD records
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]

    def get_object(self, pk):
        try:
            return HODRegistrationRequest.objects.get(pk=pk, status='approved')
        except HODRegistrationRequest.DoesNotExist:
            return None

    def get(self, request, pk):
        """Get HOD record details"""
        hod_request = self.get_object(pk)
        if not hod_request:
            return Response({'error': 'HOD not found'}, status=status.HTTP_404_NOT_FOUND)
        
        return Response({
            'success': True,
            'data': {
                'id': hod_request.id,
                'name': hod_request.name,
                'email': hod_request.email,
                'phone': hod_request.phone,
                'department': {
                    'id': hod_request.department.department_id if hod_request.department else None,
                    'name': hod_request.department.name if hod_request.department else 'N/A'
                },
                'department_name': hod_request.department.name if hod_request.department else 'N/A',
                'specialization': hod_request.specialization,
                'experience_years': hod_request.experience_years,
                'designation': hod_request.designation,
                'employee_id': hod_request.employee_id,
                'is_active': True,
                'status': hod_request.status
            }
        })

    def put(self, request, pk):
        """Update HOD record"""
        try:
            hod_request = self.get_object(pk)
            if not hod_request:
                return Response({'error': 'HOD not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Handle department change with constraint check
            if 'department' in request.data and request.data['department']:
                try:
                    dept_id = int(request.data['department'])
                    new_department = Department.objects.get(department_id=dept_id)
                    
                    # Check if another active HOD exists for this department
                    existing_hod = HODRegistrationRequest.objects.filter(
                        department=new_department,
                        status='approved'
                    ).exclude(id=hod_request.id).first()
                    
                    if existing_hod:
                        return Response({
                            'success': False,
                            'error': f'Department {new_department.name} already has an active HOD: {existing_hod.name}'
                        }, status=status.HTTP_400_BAD_REQUEST)
                    
                    hod_request.department = new_department
                except (ValueError, Department.DoesNotExist):
                    return Response({
                        'success': False,
                        'error': 'Invalid department ID'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # Update other fields
            if 'name' in request.data and request.data['name']:
                hod_request.name = request.data['name']
            if 'email' in request.data and request.data['email']:
                hod_request.email = request.data['email']
            if 'phone' in request.data:
                hod_request.phone = request.data['phone']
            if 'specialization' in request.data and request.data['specialization']:
                hod_request.specialization = request.data['specialization']
            if 'experience_years' in request.data:
                try:
                    hod_request.experience_years = int(request.data['experience_years'])
                except (ValueError, TypeError):
                    pass
            if 'designation' in request.data and request.data['designation']:
                hod_request.designation = request.data['designation']
            if 'employee_id' in request.data and request.data['employee_id']:
                hod_request.employee_id = request.data['employee_id']

            # Handle role flags if provided
            assign_coordinator_flag = None
            if 'assign_coordinator' in request.data:
                try:
                    assign_coordinator_flag = bool(request.data.get('assign_coordinator'))
                except Exception:
                    assign_coordinator_flag = None
            if 'can_act_as_instructor' in request.data:
                try:
                    can_act_flag = bool(request.data.get('can_act_as_instructor'))
                except Exception:
                    can_act_flag = None
            else:
                can_act_flag = None
            
            hod_request.save()
            
            # Also update the associated User and HOD records if they exist
            try:
                user = User.objects.get(email=hod_request.email)
                user.name = hod_request.name
                user.save()
                
                # Update or create HOD record
                hod_record, created = HOD.objects.get_or_create(
                    email=hod_request.email,
                    defaults={
                        'user': user,
                        'name': hod_request.name,
                        'phone': hod_request.phone,
                        'department': hod_request.department,
                        'specialization': hod_request.specialization,
                        'experience_years': hod_request.experience_years,
                        'designation': hod_request.designation,
                        'employee_id': hod_request.employee_id
                    }
                )
                
                if not created:
                    hod_record.name = hod_request.name
                    hod_record.phone = hod_request.phone
                    hod_record.department = hod_request.department
                    hod_record.specialization = hod_request.specialization
                    hod_record.experience_years = hod_request.experience_years
                    hod_record.designation = hod_request.designation
                    hod_record.employee_id = hod_request.employee_id
                
                # Handle image upload
                if 'image' in request.FILES:
                    hod_record.image = request.FILES['image']
                    # Also save to request record for preservation
                    hod_request.image = request.FILES['image']
                
                # Handle hire_date update
                if 'hire_date' in request.data and request.data['hire_date']:
                    try:
                        from datetime import datetime
                        hire_date = datetime.strptime(request.data['hire_date'], '%Y-%m-%d').date()
                        hod_record.hire_date = hire_date
                        hod_request.hire_date = hire_date
                    except ValueError:
                        pass
                
                hod_record.save()
                # Handle coordinator assignment toggles
                try:
                    from register.multi_role_service import MultiRoleService
                    if assign_coordinator_flag is True:
                        # create coordinator profile if missing
                        if not hasattr(user, 'coordinator_profile'):
                            coordinator = Coordinator.objects.create(
                                user=user,
                                employee_id=hod_record.employee_id,
                                name=hod_record.name,
                                email=user.email,
                                phone=hod_record.phone,
                                department=hod_record.department,
                                designation='Coordinator',
                                specialization=hod_record.specialization,
                                experience_years=hod_record.experience_years,
                                can_act_as_instructor=(can_act_flag if can_act_flag is not None else hod_record.can_act_as_instructor),
                                assigned_by=None
                            )
                            CoordinatorDashboard.objects.get_or_create(coordinator=coordinator)
                            user.add_role('coordinator')
                            user.save()
                    elif assign_coordinator_flag is False:
                        # remove coordinator profile if exists
                        if hasattr(user, 'coordinator_profile'):
                            try:
                                user.coordinator_profile.delete()
                            except Exception:
                                pass
                            # remove role from user
                            try:
                                user.remove_role('coordinator')
                                user.save()
                            except Exception:
                                pass
                except Exception:
                    pass

                # Handle instructor capability toggle
                try:
                    if can_act_flag is True:
                        MultiRoleService.enable_instructor_role_for_hod(user)
                        hod_record.can_act_as_instructor = True
                    elif can_act_flag is False:
                        MultiRoleService.disable_instructor_role_for_hod(user)
                        hod_record.can_act_as_instructor = False
                    hod_record.save()
                except Exception:
                    pass
                
            except User.DoesNotExist:
                pass
            
            # Get the updated image URL if available
            image_url = None
            if hod_record and hod_record.image:
                image_url = request.build_absolute_uri(hod_record.image.url)
            
            return Response({
                'success': True,
                'message': f'HOD {hod_request.name} updated successfully',
                'data': {
                    'id': hod_request.id,
                    'name': hod_request.name,
                    'email': hod_request.email,
                    'phone': hod_request.phone,
                    'department': {
                        'id': hod_request.department.department_id if hod_request.department else None,
                        'name': hod_request.department.name if hod_request.department else 'N/A'
                    },
                    'department_name': hod_request.department.name if hod_request.department else 'N/A',
                    'designation': hod_request.designation,
                    'specialization': hod_request.specialization,
                    'experience_years': hod_request.experience_years,
                    'employee_id': hod_request.employee_id,
                    'image': image_url
                }
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': f'Update failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, pk):
        """Delete HOD record (soft delete)"""
        try:
            hod_request = self.get_object(pk)
            if not hod_request:
                return Response({'error': 'HOD not found'}, status=status.HTTP_404_NOT_FOUND)
            
            hod_name = hod_request.name
            hod_request.status = 'rejected'
            hod_request.rejection_reason = 'Deactivated by admin'
            hod_request.save()
            
            # Deactivate user if exists
            try:
                user = User.objects.get(email=hod_request.email)
                user.is_active = False
                user.save()
            except User.DoesNotExist:
                pass
            
            return Response({
                'success': True,
                'message': f'HOD {hod_name} deactivated successfully'
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': f'Delete failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class HODRetireView(APIView):
    """Retire HOD - move from active to retired status"""
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def post(self, request, pk):
        try:
            from django.utils import timezone
            hod_request = HODRegistrationRequest.objects.get(pk=pk, status='approved')
            
            # Preserve image and hire_date from HOD record before retiring
            try:
                hod_record = HOD.objects.get(email=hod_request.email)
                # Store image and hire_date in the request record before deleting HOD record
                if hod_record.image:
                    # Copy the image file properly
                    from django.core.files.base import ContentFile
                    import os
                    
                    # Read the image file content
                    hod_record.image.open()
                    image_content = hod_record.image.read()
                    hod_record.image.close()
                    
                    # Get the original filename
                    original_name = os.path.basename(hod_record.image.name)
                    
                    # Save to request record
                    hod_request.image.save(
                        original_name,
                        ContentFile(image_content),
                        save=False
                    )
                
                if hod_record.hire_date:
                    hod_request.hire_date = hod_record.hire_date
                
                # Save the request record with preserved data before deleting HOD record
                hod_request.save()
                hod_record.delete()  # Remove from active HOD records
            except HOD.DoesNotExist:
                pass
            
            hod_name = hod_request.name
            hod_request.status = 'retired'
            hod_request.rejection_reason = 'Retired by admin'
            hod_request.retired_date = timezone.now()
            
            # Save the request record (this will be the second save if image was copied)
            hod_request.save()
            
            return Response({
                'success': True,
                'message': f'HOD {hod_name} retired successfully'
            })
            
        except HODRegistrationRequest.DoesNotExist:
            return Response({'error': 'HOD not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'success': False,
                'error': f'Retire failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class HODRetiredListView(APIView):
    """GET /api/hods/admin/retired/ - List all retired HOD records"""
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        try:
            retired_requests = HODRegistrationRequest.objects.filter(
                status='retired'
            ).select_related('department')
            
            retired_data = []
            for req in retired_requests:
                # Get image URL from the preserved image field or try other sources
                image_url = None
                if req.image:
                    try:
                        image_url = request.build_absolute_uri(req.image.url)
                    except (ValueError, AttributeError):
                        # If image field exists but file is missing, try other sources
                        pass
                
                # If no image in request record, try to get from User model or other sources
                if not image_url:
                    try:
                        user = User.objects.get(email=req.email)
                        # Check if user has profile image or other image fields
                        if hasattr(user, 'profile_image') and user.profile_image:
                            image_url = request.build_absolute_uri(user.profile_image.url)
                    except User.DoesNotExist:
                        pass
                
                # Get hire_date from the preserved field, fallback to reviewed_at
                hire_date = req.hire_date or (req.reviewed_at.date() if req.reviewed_at else None)
                
                # Get retired_date from the preserved field, fallback to updated_at
                retired_date = req.retired_date or req.updated_at
                
                retired_data.append({
                    'id': req.id,
                    'name': req.name,
                    'email': req.email,
                    'phone': req.phone,
                    'department': {
                        'id': req.department.department_id if req.department else None,
                        'name': req.department.name if req.department else 'N/A'
                    },
                    'department_name': req.department.name if req.department else 'N/A',
                    'designation': req.designation,
                    'specialization': req.specialization,
                    'experience_years': req.experience_years,
                    'retired_date': retired_date.date() if retired_date else None,
                    'hire_date': hire_date,
                    'employee_id': req.employee_id,
                    'status': req.status,
                    'image': image_url
                })
            
            return Response({
                'success': True,
                'data': retired_data,
                'count': len(retired_data)
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class HODRecordListView(APIView):
    """
    GET /api/hods/admin/records/
    POST /api/hods/admin/records/
    List all active HOD records or create new HOD record
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        try:
            # Get approved HOD requests as active HODs
            approved_requests = HODRegistrationRequest.objects.filter(
                status='approved'
            ).select_related('department')
            
            hod_data = []
            for req in approved_requests:
                # Get associated HOD record for image
                hod_record = HOD.objects.filter(email=req.email).first()
                image_url = None
                
                # Try to get image from HOD record first, then from request record
                if hod_record and hod_record.image:
                    image_url = request.build_absolute_uri(hod_record.image.url)
                elif req.image:
                    image_url = request.build_absolute_uri(req.image.url)
                
                # Get hire_date from HOD record first, then from request record, then fallback to reviewed_at
                hire_date = None
                if hod_record and hod_record.hire_date:
                    hire_date = hod_record.hire_date
                elif req.hire_date:
                    hire_date = req.hire_date
                elif req.reviewed_at:
                    hire_date = req.reviewed_at.date()
                
                hod_data.append({
                    'id': req.id,
                    'name': req.name,
                    'email': req.email,
                    'phone': req.phone,
                    'department': {
                        'id': req.department.department_id if req.department else None,
                        'name': req.department.name if req.department else 'N/A'
                    },
                    'department_name': req.department.name if req.department else 'N/A',
                    'designation': req.designation,
                    'specialization': req.specialization,
                    'experience_years': req.experience_years,
                    'hire_date': hire_date,
                    'is_active': True,
                    'employee_id': req.employee_id,
                    'status': req.status,
                    'image': image_url
                })
            
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
    
    def post(self, request):
        """Create new HOD record with department constraint"""
        try:
            # Check department constraint
            if 'department' in request.data:
                try:
                    dept_id = int(request.data['department'])
                    department = Department.objects.get(department_id=dept_id)
                    
                    # Check if department already has an active HOD
                    existing_hod = HODRegistrationRequest.objects.filter(
                        department=department,
                        status='approved'
                    ).first()
                    
                    if existing_hod:
                        return Response({
                            'success': False,
                            'error': f'Department {department.name} already has an active HOD: {existing_hod.name}. Please retire the current HOD first.'
                        }, status=status.HTTP_400_BAD_REQUEST)
                        
                except (ValueError, Department.DoesNotExist):
                    return Response({
                        'success': False,
                        'error': 'Invalid department ID'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # Read role-related flags from request
            can_act_as_instructor = request.data.get('can_act_as_instructor', True)
            assign_coordinator = request.data.get('assign_coordinator', False)

            # Create HOD registration request (marked approved since admin creates directly)
            hod_request = HODRegistrationRequest.objects.create(
                name=request.data.get('name', ''),
                email=request.data.get('email', ''),
                phone=request.data.get('phone', ''),
                department=department,
                specialization=request.data.get('specialization', ''),
                designation=request.data.get('designation', 'HOD'),
                experience_years=int(request.data.get('experience_years', 0)),
                employee_id=request.data.get('employee_id', ''),
                password='defaultpassword123',
                status='approved'
            )

            # Create or get user account
            user, created = User.objects.get_or_create(
                email=hod_request.email,
                defaults={
                    'username': hod_request.employee_id or hod_request.email,
                    'role': 'hod',
                    'name': hod_request.name
                }
            )

            if created:
                user.set_password(hod_request.password)
                user.save()
            
            # Create HOD record immediately
            hod = HOD.objects.create(
                user=user,
                employee_id=hod_request.employee_id,
                name=hod_request.name,
                email=hod_request.email,
                phone=hod_request.phone,
                department=hod_request.department,
                designation=hod_request.designation,
                specialization=hod_request.specialization,
                experience_years=hod_request.experience_years,
                hire_date=hod_request.reviewed_at.date() if hod_request.reviewed_at else None,
                can_act_as_instructor=bool(can_act_as_instructor)
            )

            # If admin requested, also create Coordinator profile and link to same user
            if assign_coordinator:
                try:
                    if not hasattr(user, 'coordinator_profile'):
                        coordinator = Coordinator.objects.create(
                            user=user,
                            employee_id=hod.employee_id,
                            name=hod.name,
                            email=user.email,
                            phone=hod.phone,
                            department=hod.department,
                            designation='Coordinator',
                            specialization=hod.specialization,
                            experience_years=hod.experience_years,
                            can_act_as_instructor=bool(can_act_as_instructor),
                            assigned_by=None
                        )
                        CoordinatorDashboard.objects.get_or_create(coordinator=coordinator)
                        # Ensure user has coordinator role too
                        user.add_role('coordinator')
                        user.save()
                except Exception:
                    pass

            # Ensure instructor role/profile if requested
            try:
                if can_act_as_instructor:
                    MultiRoleService.enable_instructor_role_for_hod(user)
                else:
                    MultiRoleService.disable_instructor_role_for_hod(user)
            except Exception:
                pass

            return Response({
                'success': True,
                'message': f'HOD {hod.name} created successfully',
                'data': {
                    'id': hod.id,
                    'name': hod.name,
                    'email': hod.email,
                    'phone': hod.phone,
                    'department': {
                        'id': hod.department.department_id if hod.department else None,
                        'name': hod.department.name if hod.department else 'N/A'
                    },
                    'department_name': hod.department.name if hod.department else 'N/A',
                    'designation': hod.designation,
                    'specialization': hod.specialization,
                    'experience_years': hod.experience_years,
                    'employee_id': hod.employee_id,
                    'is_active': True,
                    'status': hod_request.status,
                    'can_act_as_instructor': hod.can_act_as_instructor,
                    'assigned_coordinator': assign_coordinator
                }
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': f'Creation failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)