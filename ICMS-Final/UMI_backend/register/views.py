import logging
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status, generics
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate, get_user_model
from django.db import models
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .serializers import RegisterSerializer
from .permissions import IsAdminUser
from .models import PrincipalRegistrationRequest
from principal.models import Principal
from hods.models import HOD
from hods.serializers import HODSerializer
from rbac.decorators import require_permission
from rbac.services import ensure_base_roles, get_user_permission_codes, resolve_user_role_code
from register.access_control import can_access_department, get_user_assigned_department_id, is_department_scoped_admin
from students.models import Student
from .identifiers import generate_employee_id

logger = logging.getLogger(__name__)

User = get_user_model()


def _user_matches_role_filter(user, role):
    """Support instructor filtering for HOD/Coordinator who can act as instructors."""
    if not role:
        return True

    normalized_role = str(role).strip().lower()
    if normalized_role != 'instructor':
        return (user.role or '').lower() == normalized_role

    # Direct instructor role/profile users.
    if getattr(user, 'role', '').lower() == 'instructor':
        return True
    if hasattr(user, 'instructor_profile'):
        return True
    if hasattr(user, 'has_role') and user.has_role('instructor'):
        return True

    # HOD or Coordinator users allowed to act as instructor.
    coordinator_profile = getattr(user, 'coordinator_profile', None)
    if coordinator_profile and getattr(coordinator_profile, 'can_act_as_instructor', False):
        return True

    hod_profile = getattr(user, 'hod_profile', None)
    if hod_profile and getattr(hod_profile, 'can_act_as_instructor', False):
        return True

    return False


def _build_login_response(user, user_payload, token_key):
    ensure_base_roles()
    role_code = resolve_user_role_code(user)
    permissions = get_user_permission_codes(user)

    response_data = {
        "user": {
            **user_payload,
            "rbac_role": role_code,
            "permissions": permissions,
        },
        "role": role_code,
        "permissions": permissions,
        "access_token": token_key,
        "refresh_token": None,
    }
    return response_data


def _safe_get_profile(user, attr: str):
    try:
        return getattr(user, attr)
    except Exception:
        return None


def _build_login_response_for_user(user):
    token, _ = Token.objects.get_or_create(user=user)

    student = Student.objects.select_related('department').filter(user=user).first()
    if student:
        return _build_login_response(
            user=user,
            user_payload={
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": "student",
                "roles": ["student"],
                "first_name": student.first_name or user.first_name,
                "last_name": student.last_name or user.last_name,
                "student_id": student.student_id,
                "registration_number": student.registration_number,
                "department": student.department.name if student.department else None,
                "is_superuser": user.is_superuser,
                "is_staff": user.is_staff,
            },
            token_key=token.key,
        )

    hod = _safe_get_profile(user, 'hod_profile')
    if hod:
        roles = ["hod"]
        coordinator = _safe_get_profile(user, 'coordinator_profile')
        instructor = _safe_get_profile(user, 'instructor_profile')
        if coordinator:
            roles.append("coordinator")
        if instructor:
            roles.append("instructor")

        payload = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": "hod",
            "roles": roles,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "employee_id": hod.employee_id,
            "department": hod.department.name if hod.department else None,
            "is_superuser": user.is_superuser,
            "is_staff": user.is_staff,
        }
        if coordinator:
            payload.update({
                "coordinator_id": coordinator.id,
                "department_id": coordinator.department.department_id if coordinator.department else None,
            })
        if instructor:
            payload.update({
                "instructor_id": instructor.id,
                "department_id": instructor.department.department_id if instructor.department else None,
            })
        return _build_login_response(user=user, user_payload=payload, token_key=token.key)

    principal = _safe_get_profile(user, 'principal_profile')
    if principal:
        return _build_login_response(
            user=user,
            user_payload={
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": "principal",
                "roles": ["principal"],
                "first_name": principal.first_name or user.first_name,
                "last_name": principal.last_name or user.last_name,
                "employee_id": principal.employee_id,
                "department": principal.department,
                "is_superuser": user.is_superuser,
                "is_staff": user.is_staff,
            },
            token_key=token.key,
        )

    instructor = _safe_get_profile(user, 'instructor_profile')
    if instructor:
        roles = ["instructor"]
        coordinator = _safe_get_profile(user, 'coordinator_profile')
        if coordinator:
            roles.append("coordinator")
        payload = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": "instructor",
            "roles": roles,
            "first_name": instructor.name.split()[0] if instructor.name else '',
            "last_name": ' '.join(instructor.name.split()[1:]) if instructor.name and len(instructor.name.split()) > 1 else '',
            "employee_id": instructor.employee_id,
            "department": instructor.department.name if instructor.department else None,
            "is_superuser": user.is_superuser,
            "is_staff": user.is_staff,
        }
        if coordinator:
            payload.update({
                "coordinator_id": coordinator.id,
                "department_id": coordinator.department.department_id if coordinator.department else None,
            })
        return _build_login_response(user=user, user_payload=payload, token_key=token.key)

    coordinator = _safe_get_profile(user, 'coordinator_profile')
    if coordinator:
        roles = ["coordinator"]
        instructor = _safe_get_profile(user, 'instructor_profile')
        if instructor:
            roles.append("instructor")
        payload = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": "coordinator",
            "roles": roles,
            "first_name": coordinator.name.split()[0] if coordinator.name else '',
            "last_name": ' '.join(coordinator.name.split()[1:]) if coordinator.name and len(coordinator.name.split()) > 1 else '',
            "employee_id": coordinator.employee_id,
            "department": coordinator.department.name if coordinator.department else None,
            "is_superuser": user.is_superuser,
            "is_staff": user.is_staff,
        }
        if instructor:
            payload.update({
                "instructor_id": instructor.id,
                "department_id": instructor.department.department_id if instructor.department else None,
            })
        return _build_login_response(user=user, user_payload=payload, token_key=token.key)

    return _build_login_response(
        user=user,
        user_payload={
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "roles": list(getattr(user, 'roles', []) or [user.role]),
            "first_name": user.first_name,
            "last_name": user.last_name,
            "employee_id": getattr(user, "employee_id", None),
            "is_superuser": user.is_superuser,
            "is_staff": user.is_staff,
        },
        token_key=token.key,
    )

# -----------------------------
# 1️⃣ Public Register API
# -----------------------------
# Public Registration API - No authentication required
@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def register(request):
    logger.warning("Registration attempt blocked: registration disabled.")
    return Response({"detail": "Registration is disabled. Please contact an administrator to create accounts."}, status=status.HTTP_403_FORBIDDEN)

# Get registrations - Authentication required
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_registrations(request):
    role = request.GET.get('role')
    logger.info(f"GET request received for role: {role}")

    users = User.objects.all().select_related('coordinator_profile', 'hod_profile', 'instructor_profile')
    if role:
        users = [user for user in users if _user_matches_role_filter(user, role)]

    data = []
    for user in users:
        user_data = {
            'id': user.id,
            'name': user.name or f"{user.first_name} {user.last_name}",
            'email': user.email,
            'username': user.username,
            'role': user.role,
            'is_active': user.is_active,
            'created_at': user.date_joined.isoformat(),
            'last_login': user.last_login.isoformat() if user.last_login else None,
            'first_name': user.first_name,
            'last_name': user.last_name
        }
        data.append(user_data)
    
    return Response(data)

@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def login(request):
    print("=== LOGIN VIEW CALLED ===")
    print(f"Method: {request.method}")
    print(f"Data: {request.data}")
    print(f"Headers: {dict(request.headers)}")
    print("DEBUG: Login view called!")
    print(f"DEBUG: Request method: {request.method}")
    print(f"DEBUG: Request data: {request.data}")
    print(f"DEBUG: Request POST: {request.POST}")
    login_identifier = request.data.get('identifier') or request.data.get('username')
    username = login_identifier
    password = request.data.get('password')
    print(f"DEBUG: Extracted username: {username}")
    print(f"DEBUG: Password provided: {bool(password)}")

    logger.info(f"Login attempt for username: {username}")

    # Allow email login for any user
    if login_identifier and '@' in login_identifier:
        user_by_email = User.objects.filter(email__iexact=login_identifier).first()
        if user_by_email and user_by_email.check_password(password):
            return Response(_build_login_response_for_user(user_by_email), status=status.HTTP_200_OK)

    # Allow staff login by employee_id even if username differs
    if login_identifier and '@' not in login_identifier:
        user_by_employee_id = User.objects.filter(employee_id__iexact=login_identifier).first()
        if user_by_employee_id and user_by_employee_id.check_password(password):
            return Response(_build_login_response_for_user(user_by_employee_id), status=status.HTTP_200_OK)

    # Student login by registration number or student_id
    if username and not '@' in username:
        try:
            student = Student.objects.select_related('user').filter(
                models.Q(registration_number__iexact=username) |
                models.Q(student_id__iexact=username)
            ).first()
            if student and student.user and student.user.check_password(password):
                user = student.user
                token, _ = Token.objects.get_or_create(user=user)
                response_data = _build_login_response(
                    user=user,
                    user_payload={
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "role": "student",
                        "roles": ["student"],
                        "first_name": student.first_name or user.first_name,
                        "last_name": student.last_name or user.last_name,
                        "student_id": student.student_id,
                        "registration_number": student.registration_number,
                        "department": student.department.name if student.department else None,
                        "is_superuser": user.is_superuser,
                        "is_staff": user.is_staff,
                    },
                    token_key=token.key,
                )
                return Response(response_data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error in student login: {str(e)}")

    # Check if it's an instructor login (employee_id format)
    if username:
        print(f"DEBUG: Checking for instructor/coordinator login with {username}")
        logger.info("Checking for instructor/coordinator/hod login")
        try:
            from instructors.models import Instructor
            from coordinators.models import Coordinator
            
            # Check instructor first
            try:
                instructor = Instructor.objects.select_related('user').get(employee_id__iexact=username)
                if instructor.user and instructor.user.check_password(password):
                    user = instructor.user
                    logger.info(f"Instructor login successful for {username}")
                    
                    roles = ["instructor"]
                    coordinator_data = None
                    try:
                        coordinator = Coordinator.objects.get(employee_id=username)
                        roles.append("coordinator")
                        coordinator_data = {
                            "coordinator_id": coordinator.id,
                            "department_id": coordinator.department.department_id if coordinator.department else None
                        }
                    except Coordinator.DoesNotExist:
                        pass
                    
                    token, _ = Token.objects.get_or_create(user=user)
                    response_data = _build_login_response(
                        user=user,
                        user_payload={
                            "id": user.id,
                            "username": user.username,
                            "email": user.email,
                            "role": "instructor",
                            "roles": roles,
                            "first_name": instructor.name.split()[0] if instructor.name else '',
                            "last_name": ' '.join(instructor.name.split()[1:]) if instructor.name and len(instructor.name.split()) > 1 else '',
                            "employee_id": instructor.employee_id,
                            "department": instructor.department.name if instructor.department else None,
                            "is_superuser": user.is_superuser,
                            "is_staff": user.is_staff,
                        },
                        token_key=token.key,
                    )
                    
                    if coordinator_data:
                        response_data["user"].update(coordinator_data)
                    
                    return Response(response_data, status=status.HTTP_200_OK)
            except Instructor.DoesNotExist:
                pass
            
            # Check coordinator
            try:
                coordinator = Coordinator.objects.select_related('user').get(employee_id__iexact=username)
                if coordinator.user and coordinator.user.check_password(password):
                    user = coordinator.user
                    logger.info(f"Coordinator login successful for {username}")
                    
                    roles = ["coordinator"]
                    instructor_data = None
                    try:
                        instructor = Instructor.objects.get(employee_id=username)
                        roles.append("instructor")
                        instructor_data = {
                            "instructor_id": instructor.id,
                            "department_id": instructor.department.department_id if instructor.department else None
                        }
                    except Instructor.DoesNotExist:
                        pass
                    
                    token, _ = Token.objects.get_or_create(user=user)
                    response_data = _build_login_response(
                        user=user,
                        user_payload={
                            "id": user.id,
                            "username": user.username,
                            "email": user.email,
                            "role": "coordinator",
                            "roles": roles,
                            "first_name": coordinator.name.split()[0] if coordinator.name else '',
                            "last_name": ' '.join(coordinator.name.split()[1:]) if coordinator.name and len(coordinator.name.split()) > 1 else '',
                            "employee_id": coordinator.employee_id,
                            "department": coordinator.department.name if coordinator.department else None,
                            "is_superuser": user.is_superuser,
                            "is_staff": user.is_staff,
                        },
                        token_key=token.key,
                    )
                    
                    if instructor_data:
                        response_data["user"].update(instructor_data)
                    
                    return Response(response_data, status=status.HTTP_200_OK)
            except Coordinator.DoesNotExist:
                pass
                    
        except Exception as e:
            logger.error(f"Error in instructor/coordinator login: {str(e)}")

    # Check if it's an HOD login (by username or employee_id)
    if username and not '@' in username:
        logger.info("Checking for HOD login")
        
        # First try Django authenticate with the username directly (handles special characters)
        user = authenticate(username=username, password=password)
        
        if user:
            # Check if user has HOD profile
            try:
                hod = HOD.objects.select_related('user').get(user=user)
                logger.info(f"HOD login successful for {username}")
                
                roles = ["hod"]
                coordinator_data = None
                instructor_data = None
                
                try:
                    coordinator = Coordinator.objects.get(user=user)
                    roles.append("coordinator")
                    coordinator_data = {
                        "coordinator_id": coordinator.id,
                        "department_id": coordinator.department.department_id if coordinator.department else None
                    }
                except Coordinator.DoesNotExist:
                    pass
                
                try:
                    instructor = Instructor.objects.get(user=user)
                    if "instructor" not in roles:
                        roles.append("instructor")
                    instructor_data = {
                        "instructor_id": instructor.id,
                        "department_id": instructor.department.department_id if instructor.department else None
                    }
                except Instructor.DoesNotExist:
                    pass
                
                token, _ = Token.objects.get_or_create(user=user)
                response_data = _build_login_response(
                    user=user,
                    user_payload={
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "role": "hod",
                        "roles": roles,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "employee_id": hod.employee_id,
                        "department": hod.department.name if hod.department else None,
                        "is_superuser": user.is_superuser,
                        "is_staff": user.is_staff,
                    },
                    token_key=token.key,
                )
                
                if coordinator_data:
                    response_data["user"].update(coordinator_data)
                if instructor_data:
                    response_data["user"].update(instructor_data)
                
                return Response(response_data, status=status.HTTP_200_OK)
            except HOD.DoesNotExist:
                pass  # User authenticated but is not an HOD
        
        # Fallback: try to find HOD by employee_id (case insensitive)
        try:
            hod = HOD.objects.select_related('user').get(employee_id__iexact=username)
            if hod.user and hod.user.check_password(password):
                user = hod.user
                logger.info(f"HOD login successful via employee_id for {username}")
                
                roles = ["hod"]
                coordinator_data = None
                instructor_data = None
                
                try:
                    coordinator = Coordinator.objects.get(user=user)
                    roles.append("coordinator")
                    coordinator_data = {
                        "coordinator_id": coordinator.id,
                        "department_id": coordinator.department.department_id if coordinator.department else None
                    }
                except Coordinator.DoesNotExist:
                    pass
                
                try:
                    instructor = Instructor.objects.get(user=user)
                    if "instructor" not in roles:
                        roles.append("instructor")
                    instructor_data = {
                        "instructor_id": instructor.id,
                        "department_id": instructor.department.department_id if instructor.department else None
                    }
                except Instructor.DoesNotExist:
                    pass
                
                token, _ = Token.objects.get_or_create(user=user)
                response_data = _build_login_response(
                    user=user,
                    user_payload={
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "role": "hod",
                        "roles": roles,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "employee_id": hod.employee_id,
                        "department": hod.department.name if hod.department else None,
                        "is_superuser": user.is_superuser,
                        "is_staff": user.is_staff,
                    },
                    token_key=token.key,
                )
                
                if coordinator_data:
                    response_data["user"].update(coordinator_data)
                if instructor_data:
                    response_data["user"].update(instructor_data)
                
                return Response(response_data, status=status.HTTP_200_OK)
        except HOD.DoesNotExist:
            logger.info(f"No HOD found with employee_id {username}")
        except Exception as e:
            logger.error(f"Error in HOD login: {str(e)}")

    # Check if it's a Principal login (by employee_id)
    if username and not '@' in username:
        logger.info("Checking for Principal login")
        try:
            from principal.models import Principal
            principal = Principal.objects.select_related('user').get(employee_id__iexact=username)
            if principal.user and principal.user.check_password(password):
                user = principal.user
                logger.info(f"Principal login successful for {username}")
                
                token, _ = Token.objects.get_or_create(user=user)
                response_data = _build_login_response(
                    user=user,
                    user_payload={
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "role": "principal",
                        "roles": ["principal"],
                        "first_name": principal.first_name or user.first_name,
                        "last_name": principal.last_name or user.last_name,
                        "employee_id": principal.employee_id,
                        "department": principal.department,
                        "is_superuser": user.is_superuser,
                        "is_staff": user.is_staff,
                    },
                    token_key=token.key,
                )
                
                return Response(response_data, status=status.HTTP_200_OK)
        except Principal.DoesNotExist:
            logger.info(f"No Principal found with employee_id {username}")
        except Exception as e:
            logger.error(f"Error in Principal login: {str(e)}")

    # Regular user authentication
    logger.info("Attempting regular user authentication")
    user = authenticate(username=username, password=password)
    if user:
        logger.info(f"Regular login successful for {username}")

    # if everything OK → allow login
        token, _ = Token.objects.get_or_create(user=user)
     
        return Response(
            _build_login_response(
                user=user,
                user_payload={
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "role": user.role,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "employee_id": getattr(user, "employee_id", None),
                    "is_superuser": user.is_superuser,
                    "is_staff": user.is_staff,
                },
                token_key=token.key,
            ),
            status=status.HTTP_200_OK,
        )

    logger.warning(f"Login failed for username: {username}")
    print("=== AUTHENTICATION FAILED ===")
    return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

# -----------------------------
# 3️⃣ List all users (all logged-in users can view)
# -----------------------------
class UserListView(generics.ListAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [IsAuthenticated]

# -----------------------------
# 4️⃣ Single user GET / PUT / DELETE
# -----------------------------
class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'DELETE']:
            return [IsAuthenticated(), IsAdminUser()]
        return [IsAuthenticated()]


# Get registrations by role
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
@require_permission('manage_jsc_users')
def get_registrations(request):
    role = request.GET.get('role')
    users = User.objects.all().select_related('coordinator_profile', 'hod_profile', 'instructor_profile')
    if role:
        users = [user for user in users if _user_matches_role_filter(user, role)]

    data = []
    for user in users:
        data.append({
            'id': user.id,
            'name': user.name or f"{user.first_name} {user.last_name}",
            'email': user.email,
            'username': user.username,
            'role': user.role,
            'is_active': user.is_active,
            'created_at': user.date_joined.isoformat(),
            'last_login': user.last_login.isoformat() if user.last_login else None
        })
    
    return Response({'data': data})

# Admin Dashboard Cards
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
@require_permission('manage_jsc_users')
def admin_dashboard_cards(request):
    return Response({
        'hod_requests_card': {
            'title': 'HOD Registration Requests',
            'pending': 0,
            'approved': 0,
            'rejected': 0,
            'total': 0,
            'endpoint': '',
            'icon': 'user-check',
            'color': 'success'
        }
    })

@api_view(['POST'])
@permission_classes([AllowAny])
def register_principal(request):
    data = request.data
    logger.warning("Principal registration attempt blocked: registration disabled.")
    return Response({"detail": "Registration is disabled. Please contact an administrator to create accounts."}, status=status.HTTP_403_FORBIDDEN)

@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsAdminUser])
def approve_principal(request, request_id):
    try:
        req = PrincipalRegistrationRequest.objects.get(id=request_id)
    except:
        return Response({"error": "Request not found"}, status=404)

    req.status = "approved"
    req.save()

    user = User.objects.create_user(
        username=req.username,
        password=req.password,
        email=req.email,
        name=req.name,
        role="principal",
        is_active=True
    )

    return Response({"message": "Principal approved successfully"})


# ========== HOD MANAGEMENT ENDPOINTS ==========
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
@require_permission('manage_hods')
def list_hod_records(request):
    """List all HOD records with multi-role support"""
    try:
        hods = HOD.objects.select_related('user').all()
        serializer = HODSerializer(hods, many=True, context={'request': request})
        return Response({
            'success': True,
            'data': serializer.data,
            'count': len(serializer.data)
        })
    except Exception as e:
        logger.error(f"Error fetching HOD records: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
@require_permission('manage_hods')
def create_hod(request):
    """Create a new HOD with multi-role support (HOD + optional Coordinator/Instructor roles)"""
    try:
        from academics.models import Department
        import json
        
        logger.info(f"Received POST data: {dict(request.data)}")
        logger.info(f"Received FILES: {dict(request.FILES)}")
        
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        email = request.data.get('email', '')
        password = request.data.get('password', '')
        department_id = request.data.get('department', '')
        phone = request.data.get('phone', '')
        joining_date = request.data.get('joining_date', '')
        
        roles_data = request.data.get('roles', '["hod"]')
        if isinstance(roles_data, str):
            try:
                roles = json.loads(roles_data)
            except:
                roles = ['hod']
        else:
            roles = roles_data
            
        profile_pic = request.FILES.get('profile_pic', None)
        
        if not all([first_name, last_name, email, password, department_id]):
            return Response({
                'success': False,
                'error': 'Missing required fields'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if User.objects.filter(email=email).exists():
            return Response({
                'success': False,
                'error': f'User with email "{email}" already exists'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        logger.info(f"Looking for department with ID: {department_id}")
        if not can_access_department(request.user, department_id):
            return Response({
                'success': False,
                'error': 'Forbidden: You can only manage HOD records in your assigned department.'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            department = Department.objects.get(department_id=department_id)
            logger.info(f"Found department: {department.name}")
        except Department.DoesNotExist:
            all_depts = Department.objects.all()
            logger.error(f"Department not found. Available departments: {list(all_depts.values('department_id', 'name'))}")
            return Response({
                'success': False,
                'error': f'Department with ID "{department_id}" not found. Available departments: {list(all_depts.values("department_id", "name"))}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        employee_id = generate_employee_id('hod', department)
        username = employee_id

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role='hod'
        )
        user.employee_id = employee_id
        user.save(update_fields=['employee_id'])
        
        hod = HOD.objects.create(
            user=user,
            employee_id=employee_id,
            name=f"{first_name} {last_name}",
            email=email,
            phone=phone,
            department=department,
            hire_date=joining_date if joining_date else None,
            image=profile_pic,
            is_active=True,
            can_act_as_instructor=False  # Default is False, only True when instructor role is explicitly assigned
        )
        
        # Add multi-roles if requested (coordinator, instructor)
        if 'coordinator' in roles:
            try:
                from coordinators.models import Coordinator
                # Set can_act_as_instructor=False by default for coordinator
                # Only set to True if instructor role is also explicitly assigned
                Coordinator.objects.get_or_create(
                    user=user,
                    defaults={
                        'employee_id': employee_id,
                        'name': f"{first_name} {last_name}",
                        'email': email,
                        'phone': phone,
                        'department': department,
                        'designation': 'HOD-Coordinator',
                        'can_act_as_instructor': 'instructor' in roles
                    }
                )
                logger.info(f"Added Coordinator role to HOD {username}")
            except Exception as e:
                logger.warning(f"Could not add coordinator role: {str(e)}")
        
        if 'instructor' in roles:
            try:
                from instructors.models import Instructor
                Instructor.objects.get_or_create(
                    user=user,
                    defaults={
                        'employee_id': employee_id,
                        'name': f"{first_name} {last_name}",
                        'email': email,
                        'phone': phone,
                        'department': department,
                        'designation': 'HOD-Instructor'
                    }
                )
                # Set can_act_as_instructor=True on HOD when instructor role is assigned
                hod.can_act_as_instructor = True
                hod.save()
                logger.info(f"Added Instructor role to HOD {username}")
            except Exception as e:
                logger.warning(f"Could not add instructor role: {str(e)}")
        
        # If coordinator role is assigned but instructor is not, ensure can_act_as_instructor is False
        if 'coordinator' in roles and 'instructor' not in roles:
            hod.can_act_as_instructor = False
            hod.save()
        
        serializer = HODSerializer(hod, context={'request': request})
        return Response({
            'success': True,
            'message': f'HOD "{first_name} {last_name}" created successfully with roles: {", ".join(roles)}',
            'employee_id': hod.employee_id,
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error creating HOD: {str(e)}")
        return Response({
            'success': False,
            'error': f'Failed to create HOD: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Get departments for HOD creation
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
@require_permission('manage_hods')
def get_departments(request):
    """Get all departments for HOD creation dropdown"""
    try:
        from academics.models import Department
        departments = Department.objects.all().order_by('name')
        if is_department_scoped_admin(request.user):
            assigned_department_id = get_user_assigned_department_id(request.user)
            departments = departments.filter(department_id=assigned_department_id)
        data = []
        for dept in departments:
            data.append({
                'department_id': dept.department_id,
                'name': dept.name,
                'code': dept.code,
                'description': getattr(dept, 'description', '')
            })
        return Response({
            'success': True,
            'data': data
        })
    except Exception as e:
        logger.error(f"Error fetching departments: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Check if department already has an active HOD
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
@require_permission('manage_hods')
def check_department_hod(request):
    """Check if a department already has an active HOD"""
    department_id = request.GET.get('department_id')
    if not department_id:
        return Response({
            'success': False,
            'error': 'department_id is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        from academics.models import Department
        if not can_access_department(request.user, department_id):
            return Response({
                'success': False,
                'error': 'Forbidden: You can only access HOD records in your assigned department.'
            }, status=status.HTTP_403_FORBIDDEN)
        department = Department.objects.get(department_id=department_id)
        
        active_hod = HOD.objects.filter(
            department=department,
            is_active=True
        ).first()
        
        if active_hod:
            return Response({
                'success': True,
                'has_active_hod': True,
                'hod': {
                    'id': active_hod.id,
                    'name': active_hod.name,
                    'employee_id': active_hod.employee_id,
                    'email': active_hod.email
                }
            })
        else:
            return Response({
                'success': True,
                'has_active_hod': False,
                'hod': None
            })
    except Department.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Department not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error checking department HOD: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Edit HOD
@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated, IsAdminUser])
@require_permission('manage_hods')
def edit_hod(request, hod_id):
    """Edit an existing HOD"""
    try:
        hod = HOD.objects.get(id=hod_id)
        if not can_access_department(request.user, hod.department_id):
            return Response({
                'success': False,
                'error': 'Forbidden: You can only edit HOD records in your assigned department.'
            }, status=status.HTTP_403_FORBIDDEN)
    except HOD.DoesNotExist:
        return Response({
            'success': False,
            'error': 'HOD not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    try:
        from academics.models import Department
        import json
        
        first_name = request.data.get('first_name', hod.user.first_name if hod.user else '')
        last_name = request.data.get('last_name', hod.user.last_name if hod.user else '')
        email = request.data.get('email', hod.email)
        phone = request.data.get('phone', hod.phone)
        department_id = request.data.get('department', hod.department.department_id if hod.department else None)
        
        roles_data = request.data.get('roles', None)
        if roles_data:
            if isinstance(roles_data, str):
                try:
                    roles = json.loads(roles_data)
                except:
                    roles = ['hod']
            else:
                roles = roles_data
        else:
            roles = []
        
        if hod.user:
            hod.user.first_name = first_name
            hod.user.last_name = last_name
            hod.user.email = email
            hod.user.save()
        
        if department_id and str(hod.department.department_id) != str(department_id):
            if not can_access_department(request.user, department_id):
                return Response({
                    'success': False,
                    'error': 'Forbidden: You can only move HOD records within your assigned department.'
                }, status=status.HTTP_403_FORBIDDEN)
            existing_hod = HOD.objects.filter(
                department_id=department_id,
                is_active=True
            ).exclude(id=hod_id).first()
            
            if existing_hod:
                return Response({
                    'success': False,
                    'error': f'Department already has an active HOD: {existing_hod.name}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            department = Department.objects.get(department_id=department_id)
            hod.department = department
            
            try:
                from coordinators.models import Coordinator
                coordinator = Coordinator.objects.filter(user=hod.user).first()
                if coordinator:
                    coordinator.department = department
                    coordinator.save()
            except:
                pass
            
            try:
                from instructors.models import Instructor
                instructor = Instructor.objects.filter(user=hod.user).first()
                if instructor:
                    instructor.department = department
                    instructor.save()
            except:
                pass
        
        hod.name = f"{first_name} {last_name}"
        hod.email = email
        hod.phone = phone
        hod.save()
        
        # Update roles
        if roles:
            # Handle coordinator role
            if 'coordinator' in roles:
                try:
                    from coordinators.models import Coordinator
                    Coordinator.objects.update_or_create(
                        user=hod.user,
                        defaults={
                            'employee_id': hod.employee_id,
                            'name': f"{first_name} {last_name}",
                            'email': email,
                            'phone': phone,
                            'department': hod.department,
                            'designation': 'HOD-Coordinator',
                            'can_act_as_instructor': 'instructor' in roles
                        }
                    )
                except Exception as e:
                    logger.warning(f"Could not add coordinator role: {str(e)}")
            else:
                try:
                    from coordinators.models import Coordinator
                    Coordinator.objects.filter(user=hod.user).delete()
                except:
                    pass
            
            # Handle instructor role
            if 'instructor' in roles:
                try:
                    from instructors.models import Instructor
                    Instructor.objects.update_or_create(
                        user=hod.user,
                        defaults={
                            'employee_id': hod.employee_id,
                            'name': f"{first_name} {last_name}",
                            'email': email,
                            'phone': phone,
                            'department': hod.department,
                            'designation': 'HOD-Instructor'
                        }
                    )
                    # Set can_act_as_instructor=True on HOD when instructor role is assigned
                    hod.can_act_as_instructor = True
                    hod.save()
                except Exception as e:
                    logger.warning(f"Could not add instructor role: {str(e)}")
            else:
                try:
                    from instructors.models import Instructor
                    Instructor.objects.filter(user=hod.user).delete()
                except:
                    pass
            
            # If coordinator role is assigned but instructor is not, ensure can_act_as_instructor is False
            if 'coordinator' in roles and 'instructor' not in roles:
                hod.can_act_as_instructor = False
                hod.save()
        
        serializer = HODSerializer(hod, context={'request': request})
        return Response({
            'success': True,
            'message': 'HOD updated successfully',
            'data': serializer.data
        })
        
    except Exception as e:
        logger.error(f"Error editing HOD: {str(e)}")
        return Response({
            'success': False,
            'error': f'Failed to edit HOD: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Retire HOD
@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
@require_permission('manage_hods')
def retire_hod(request, hod_id):
    """Retire an HOD (mark as inactive)"""
    try:
        hod = HOD.objects.get(id=hod_id)
        if not can_access_department(request.user, hod.department_id):
            return Response({
                'success': False,
                'error': 'Forbidden: You can only retire HODs in your assigned department.'
            }, status=status.HTTP_403_FORBIDDEN)
    except HOD.DoesNotExist:
        return Response({
            'success': False,
            'error': 'HOD not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    retirement_date = request.data.get('retirement_date')
    if not retirement_date:
        return Response({
            'success': False,
            'error': 'retirement_date is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        hod.is_active = False
        hod.retirement_date = retirement_date
        hod.save()
        
        if hod.user:
            hod.user.is_active = False
            hod.user.save()
        
        try:
            from coordinators.models import Coordinator
            Coordinator.objects.filter(user=hod.user).delete()
        except:
            pass
        
        try:
            from instructors.models import Instructor
            Instructor.objects.filter(user=hod.user).delete()
        except:
            pass
        
        serializer = HODSerializer(hod, context={'request': request})
        return Response({
            'success': True,
            'message': f'HOD {hod.name} has been retired successfully',
            'data': serializer.data
        })
        
    except Exception as e:
        logger.error(f"Error retiring HOD: {str(e)}")
        return Response({
            'success': False,
            'error': f'Failed to retire HOD: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Reactivate HOD
@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
@require_permission('manage_hods')
def reactivate_hod(request, hod_id):
    """Reactivate a retired HOD"""
    try:
        hod = HOD.objects.get(id=hod_id)
        if not can_access_department(request.user, hod.department_id):
            return Response({
                'success': False,
                'error': 'Forbidden: You can only reactivate HODs in your assigned department.'
            }, status=status.HTTP_403_FORBIDDEN)
    except HOD.DoesNotExist:
        return Response({
            'success': False,
            'error': 'HOD not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    try:
        existing_hod = HOD.objects.filter(
            department=hod.department,
            is_active=True
        ).exclude(id=hod_id).first()
        
        if existing_hod:
            return Response({
                'success': False,
                'error': f'Department already has an active HOD: {existing_hod.name}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        hod.is_active = True
        hod.retirement_date = None
        hod.save()
        
        if hod.user:
            hod.user.is_active = True
            hod.user.save()
        
        serializer = HODSerializer(hod, context={'request': request})
        return Response({
            'success': True,
            'message': f'HOD {hod.name} has been reactivated successfully',
            'data': serializer.data
        })
        
    except Exception as e:
        logger.error(f"Error reactivating HOD: {str(e)}")
        return Response({
            'success': False,
            'error': f'Failed to reactivate HOD: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Get retired HODs by department
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
@require_permission('manage_hods')
def get_retired_hods(request):
    """Get all retired HODs, optionally filtered by department"""
    department_id = request.GET.get('department_id')
    
    try:
        from hods.models import HODRegistrationRequest
        
        # Get retired HOD requests
        retired_requests = HODRegistrationRequest.objects.filter(
            status='retired'
        ).select_related('department')
        
        if department_id:
            if not can_access_department(request.user, department_id):
                return Response({
                    'success': False,
                    'error': 'Forbidden: You can only access retired HODs in your assigned department.'
                }, status=status.HTTP_403_FORBIDDEN)
            retired_requests = retired_requests.filter(department_id=department_id)
        elif is_department_scoped_admin(request.user):
            assigned_department_id = get_user_assigned_department_id(request.user)
            retired_requests = retired_requests.filter(department_id=assigned_department_id)
        
        retired_data = []
        for req in retired_requests:
            # Get hire_date from preserved field, fallback to reviewed_at
            hire_date = req.hire_date or (req.reviewed_at.date() if req.reviewed_at else None)
            
            # Get retired_date from preserved field, fallback to updated_at
            retired_date = req.retired_date or req.updated_at
            
            # Get image URL
            image_url = None
            if req.image:
                try:
                    image_url = request.build_absolute_uri(req.image.url)
                except (ValueError, AttributeError):
                    pass
            
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
                'employee_id': req.employee_id,
                'hire_date': hire_date,
                'retirement_date': retired_date.date() if retired_date else None,
                'is_active': False,
                'status': 'retired',
                'image': image_url
            })
        
        return Response({
            'success': True,
            'data': retired_data,
            'count': len(retired_data)
        })
    except Exception as e:
        logger.error(f"Error fetching retired HODs: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
