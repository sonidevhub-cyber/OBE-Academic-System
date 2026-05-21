import logging
from django.db.models import Q
from django.contrib.auth import authenticate, get_user_model
from django.views.decorators.csrf import csrf_exempt

from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token

from students.models import Student

logger = logging.getLogger(__name__)

User = get_user_model()


# =========================
# BUILD LOGIN RESPONSE
# =========================
def _build_login_response_for_user(user):
    token, _ = Token.objects.get_or_create(user=user)

    # Use active_role if set, otherwise fallback to primary role
    current_role = user.active_role or user.role

    roles = [user.role]
    if user.secondary_role and user.secondary_role != 'none':
        roles.append(user.secondary_role)
    
    # Faculty are also instructors
    if user.role in ['hod', 'coordinator', 'tvf'] or user.secondary_role in ['hod', 'coordinator']:
        if 'instructor' not in roles:
            roles.append('instructor')

    payload = {
        "id": str(user.id),
        "custom_id": getattr(user, "custom_id", None),
        "email": user.email,
        "username": getattr(user, "username", None),
        "full_name": getattr(user, "full_name", None),

        "role": current_role,  # Front-end uses this as active role
        "primary_role": user.role,
        "secondary_role": user.secondary_role,

        "roles": roles,
        "active_role": current_role,
        "effective_role": current_role,

        "is_superuser": user.is_superuser,
        "is_staff": user.is_staff,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if hasattr(user, 'created_at') and user.created_at else None,
    }

    # Enrich with instructor data if it's a faculty member
    if user.role in ['hod', 'coordinator', 'instructor', 'tvf'] or user.secondary_role in ['hod', 'coordinator']:
        try:
            from instructors.models import Instructor
            from instructors.serializers import InstructorSerializer
            instructor = Instructor.objects.get(user=user)
            instructor_data = InstructorSerializer(instructor).data
            # Merge fields into payload, avoiding conflicts with core auth fields
            for key, value in instructor_data.items():
                if key not in payload and value is not None:
                    payload[key] = value
        except Exception:
            pass

    payload.update({
        "must_change_password": getattr(user, "must_change_password", False),
        "profile_pic": user.profile_pic.url if getattr(user, "profile_pic", None) else None,
        "designation": getattr(user, "designation", None),
        "phone": getattr(user, "phone", None),

        "permissions": [],
        "rbac_role": None,
    })

    # Student extra info
    if user.role in ["student", "alumni"]:
        student = Student.objects.filter(user=user).first()
        if student:
            payload.update({
                "student_id": student.student_id,
                "registration_number": student.registration_number,
                "batch": getattr(user.batch, "name", None) if getattr(user, "batch", None) else None,
            })

    # Coordinator programs
    if "coordinator" in roles:
        payload.update({
            "programs": [p.name for p in user.programs.all()]
        })

    return {
        "user": payload,
        "role": user.role,
        "roles": roles,
        "permissions": [],
        "access_token": token.key,
        "refresh_token": None,
    }


# =========================
# LOGIN API (FIXED)
# =========================
@csrf_exempt
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def login(request):

    identifier = (
        request.data.get("email")
        or request.data.get("username")
        or request.data.get("identifier")
        or request.data.get("user_id")
    )

    password = request.data.get("password")

    # Normalize whitespace to reduce "looks correct but fails" login issues
    if isinstance(identifier, str):
        identifier = identifier.strip()
    if isinstance(password, str):
        password = password.strip()


    if not identifier or not password:
        return Response(
            {"error": "Please provide email/username/custom_id and password"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 🔥 FIND USER BY ANY FIELD
    user_obj = User.objects.filter(
        Q(email=identifier)
        | Q(custom_id=identifier)
    ).first()

    if not user_obj:
        logger.warning(f"Login failed: no matching user for identifier={identifier}")
        return Response(
            {"error": "Invalid credentials"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # 🔥 SAFE AUTHENTICATION (NO CRASH)
    # DEBUG: log what user/auth backend sees
    try:
        logger.info(
            "Login attempt resolved: "
            f"identifier={identifier} "
            f"user_id={user_obj.id} "
            f"email={user_obj.email} "
            f"username={getattr(user_obj, 'username', None)} "
            f"custom_id={getattr(user_obj, 'custom_id', None)}"
        )
    except Exception:
        pass

    # Try authenticate using email first.
    user = authenticate(request, email=user_obj.email, password=password)

    # If your custom auth backend expects a different kwarg (e.g. `custom_id`), try it.
    if not user and getattr(user_obj, "custom_id", None):
        user = authenticate(
            request,
            custom_id=getattr(user_obj, "custom_id", None),
            password=password,
        )

    # As a last resort, try passing the identifier as username/custom kwarg if supported by backend.
    if not user and identifier:
        user = authenticate(request, username=identifier, password=password)

    if not user:
        logger.warning(
            "Login failed: authenticate() returned None. "
            f"identifier={identifier} user_id={user_obj.id} "
            f"email={user_obj.email} custom_id={getattr(user_obj, 'custom_id', None)}"
        )
        return Response(
            {"error": "Invalid credentials"},
            status=status.HTTP_401_UNAUTHORIZED,
        )



    if not user.is_active:
        return Response(
            {"error": "User account is deactivated"},
            status=status.HTTP_403_FORBIDDEN,
        )

    return Response(_build_login_response_for_user(user))


# =========================
# UPDATE PROFILE
# =========================
@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def update_profile(request):
    user = request.user
    
    logger.info(f"Update profile request for user {user.id} ({user.email})")
    logger.info(f"Request data keys: {list(request.data.keys())}")
    logger.info(f"Request content type: {request.content_type}")

    if request.data.get("full_name"):
        user.full_name = request.data.get("full_name")
        logger.info(f"Updated full_name to: {user.full_name}")

    if request.FILES.get("profile_pic"):
        user.profile_pic = request.FILES.get("profile_pic")
        logger.info("Updated profile_pic")

    raw_password = request.data.get("password")

    # debug only (remove after confirmation)
    old_hash_preview = None
    try:
        old_hash_preview = user.password[:30] if getattr(user, "password", None) else None
    except Exception:
        old_hash_preview = None

    password_changed = False
    if raw_password:
        logger.info(f"Password field found, length: {len(raw_password)}")
        user.set_password(raw_password)
        password_changed = True
        logger.info("Password has been set (hashed)")
    else:
        logger.info("No password field in request or password is empty")

    user.save()
    logger.info(f"User {user.id} saved successfully")

    new_hash_preview = None
    try:
        new_hash_preview = user.password[:30] if getattr(user, "password", None) else None
    except Exception:
        new_hash_preview = None


    from core.serializers.user import UserListSerializer

    return Response({
        "message": "Profile updated successfully",
        "user": UserListSerializer(user).data
    })


# =========================
# AVAILABLE ROLES
# =========================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def available_roles(request):
    user = request.user
    
    roles = []
    # Add primary role
    roles.append({
        "role": user.role,
        "name": user.role.upper(),
        "is_primary": True
    })
    
    # Add secondary role
    if user.secondary_role and user.secondary_role != 'none':
        roles.append({
            "role": user.secondary_role,
            "name": user.secondary_role.upper(),
            "is_primary": False
        })
    
    # Faculty are also instructors
    if user.role in ['hod', 'coordinator', 'tvf'] or user.secondary_role in ['hod', 'coordinator']:
        if not any(r['role'] == 'instructor' for r in roles):
            roles.append({
                "role": 'instructor',
                "name": 'Instructor',
                "is_primary": False
            })
            
    return Response({
        "available_roles": roles,
        "current_role": user.active_role or user.role
    })


# =========================
# SWITCH ROLE
# =========================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def switch_active_role(request):
    user = request.user
    target_role = request.data.get("role")
    
    if not target_role:
        return Response({"error": "No role provided"}, status=status.HTTP_400_BAD_REQUEST)
        
    # Determine allowed roles
    allowed_roles = [user.role]
    if user.secondary_role and user.secondary_role != 'none':
        allowed_roles.append(user.secondary_role)
    
    if user.role in ['hod', 'coordinator', 'tvf'] or user.secondary_role in ['hod', 'coordinator']:
        if 'instructor' not in allowed_roles:
            allowed_roles.append('instructor')
            
    if target_role not in allowed_roles:
        return Response({"error": "Role not allowed"}, status=status.HTTP_400_BAD_REQUEST)
        
    # Update active role
    user.active_role = target_role
    user.save()
    
    # Build updated login response
    response_data = _build_login_response_for_user(user)
    # Match the format expected by frontend UniversalRoleSwitcher
    response_data.update({
        "active_role": target_role,
        "current_role": target_role,
        "role": target_role
    })
    
    return Response(response_data)


# =========================
# ADMIN DASHBOARD
# =========================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_dashboard_cards(request):
    return Response({
        "total_users": User.objects.count(),
        "active_users": User.objects.filter(is_active=True).count(),
    })