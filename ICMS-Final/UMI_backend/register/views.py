import logging
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate, get_user_model
from django.db import models
from django.views.decorators.csrf import csrf_exempt
from students.models import Student

logger = logging.getLogger(__name__)

User = get_user_model()


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
        student = Student.objects.filter(user=user).first()
        if student:
            payload.update({
                "student_id": student.student_id,
                "registration_number": student.registration_number,
                "batch": user.batch.name if user.batch else None,
            })

    # Coordinator specific
    if user.role == 'coordinator':
        payload.update({
            "programs": [p.name for p in user.programs.all()]
        })

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
    })