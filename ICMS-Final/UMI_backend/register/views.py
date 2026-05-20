import logging
from django.db.models import Q
from django.contrib.auth import authenticate, get_user_model
from django.views.decorators.csrf import csrf_exempt

from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
<<<<<<< HEAD

=======
from django.contrib.auth import authenticate, get_user_model
from django.db import models
from django.views.decorators.csrf import csrf_exempt
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
from students.models import Student

logger = logging.getLogger(__name__)

User = get_user_model()


<<<<<<< HEAD
# =========================
# BUILD LOGIN RESPONSE
# =========================
def _build_login_response_for_user(user):
    token, _ = Token.objects.get_or_create(user=user)

    roles = [user.role]
    if getattr(user, "secondary_role", None):
        roles.append(user.secondary_role)

    payload = {
        "id": str(user.id),
        "custom_id": getattr(user, "custom_id", None),
        "email": user.email,
        "username": getattr(user, "username", None),
        "full_name": getattr(user, "full_name", None),

        "role": user.role,
        "secondary_role": getattr(user, "secondary_role", None),

        "roles": roles,
        "active_role": user.role,
        "effective_role": user.role,

        "is_superuser": user.is_superuser,
        "is_staff": user.is_staff,

        "must_change_password": getattr(user, "must_change_password", False),
        "profile_pic": user.profile_pic.url if getattr(user, "profile_pic", None) else None,
        "designation": getattr(user, "designation", None),
        "phone": getattr(user, "phone", None),

        "permissions": [],
        "rbac_role": None,
    }

    # Student extra info
    if user.role in ["student", "alumni"]:
=======
# ================= LOGIN RESPONSE =================
def _build_login_response(user, user_payload, token_key):
    role_code = user.role
    permissions = []

    return {
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


def _build_login_response_for_user(user):
    token, _ = Token.objects.get_or_create(user=user)

    payload = {
        "id": str(user.id),
        "custom_id": user.custom_id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "secondary_role": user.secondary_role,
        "roles": [user.role],
        "active_role": user.role,
        "effective_role": user.role,
        "is_superuser": user.is_superuser,
        "is_staff": user.is_staff,
        "must_change_password": user.must_change_password,
        "profile_pic": user.profile_pic.url if user.profile_pic else None,
        "designation": user.designation,
        "phone": user.phone,
    }

    # Student specific
    if user.role in ['student', 'alumni']:
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
        student = Student.objects.filter(user=user).first()
        if student:
            payload.update({
                "student_id": student.student_id,
                "registration_number": student.registration_number,
<<<<<<< HEAD
                "batch": getattr(user.batch, "name", None) if getattr(user, "batch", None) else None,
            })

    # Coordinator programs
    if "coordinator" in roles:
=======
                "batch": user.batch.name if user.batch else None,
            })

    # Coordinator specific
    if user.role == 'coordinator':
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
        payload.update({
            "programs": [p.name for p in user.programs.all()]
        })

<<<<<<< HEAD
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
=======
    return _build_login_response(user, payload, token.key)


# ================= LOGIN API =================
@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def login(request):
    identifier = (
        request.data.get('email')
        or request.data.get('identifier')
        or request.data.get('username')
    )
    password = request.data.get('password')

    if not identifier or not password:
        return Response(
            {'error': 'Please provide both email/username and password'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user_obj = User.objects.filter(
        models.Q(email=identifier) | models.Q(custom_id=identifier)
    ).first()

    if not user_obj:
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

    user = authenticate(email=user_obj.email, password=password)

    if not user:
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

    if not user.is_active:
        return Response({'error': 'User account is deactivated'}, status=status.HTTP_403_FORBIDDEN)

    return Response(_build_login_response_for_user(user))


# ================= UPDATE PROFILE =================
@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_profile(request):
    user = request.user

    full_name = request.data.get('full_name')
    profile_pic = request.FILES.get('profile_pic')
    password = request.data.get('password')

    if full_name:
        user.full_name = full_name

    if profile_pic:
        user.profile_pic = profile_pic

    if password:
        user.set_password(password)

    user.save()

    from academics.serializers.user import UserListSerializer

    return Response({
        'message': 'Profile updated successfully',
        'user': UserListSerializer(user).data
    })


# ================= AVAILABLE ROLES =================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def available_roles(request):
    user = request.user

    return Response({
        'available_roles': [
            {
                'role': user.role,
                'name': user.role.title(),
                'is_primary': True,
                'is_active': True
            }
        ],
        'current_role': user.role
    })
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03

    # Try authenticate using email first.
    user = authenticate(request, email=user_obj.email, password=password)

<<<<<<< HEAD
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

    roles = [user.role]
    if getattr(user, "secondary_role", None):
        roles.append(user.secondary_role)

    return Response({
        "available_roles": roles,
        "current_role": user.role
    })


# =========================
# SWITCH ROLE (DISABLED)
# =========================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def switch_active_role(request):
    return Response(
        {"error": "Role switching is not implemented yet"},
        status=status.HTTP_400_BAD_REQUEST
    )


# =========================
# ADMIN DASHBOARD
# =========================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_dashboard_cards(request):
    return Response({
        "total_users": User.objects.count(),
        "active_users": User.objects.filter(is_active=True).count(),
=======
# ================= SWITCH ROLE (DISABLED) =================
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def switch_active_role(request):
    return Response({
        'message': 'Role switching disabled',
        'role': request.user.role
    })


# ================= DASHBOARD =================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard_cards(request):
    return Response({
        'total_users': User.objects.count(),
        'active_users': User.objects.filter(is_active=True).count(),
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
    })