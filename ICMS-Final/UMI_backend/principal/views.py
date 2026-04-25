from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from .models import Principal
from .serializers import PrincipalCreateSerializer
from rest_framework.generics import DestroyAPIView
from rbac.decorators import require_permission


# ADMIN CREATES PRINCIPAL (Pending by default)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@require_permission('manage_principals')
def create_principal(request):
    serializer = PrincipalCreateSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    principal = serializer.save(
        created_by_admin=request.user,
        status="pending"
    )

    return Response({
        "message": "Principal created successfully",
        "id": principal.id,
        "employee_id": principal.employee_id,
        "username": principal.user.username,
        "status": principal.status
    }, status=201)


# LIST ALL PRINCIPALS
@api_view(["GET"])
@permission_classes([IsAuthenticated])
@require_permission('manage_principals')
def list_principals(request):

    principals = Principal.objects.all()

    data = []
    for p in principals:
        profile_pic_url = None
        if p.profile_pic:
            profile_pic_url = request.build_absolute_uri(p.profile_pic.url)
        
        data.append({
            "id": p.id,
            "first_name": p.user.first_name if p.user else p.first_name,
            "last_name": p.user.last_name if p.user else p.last_name,
            "username": p.user.username if p.user else None,
            "email": p.email,
            "employee_id": p.employee_id,
            "department": p.department,
            "rank": p.rank,
            "gender": p.gender,
            "phone": p.phone,
            "joining_date": str(p.joining_date) if p.joining_date else None,
            "retirement_date": str(p.retirement_date) if p.retirement_date else None,
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "profile_pic": profile_pic_url,
        })

    return Response(data, status=200)


# APPROVE PRINCIPAL (Account Activation after Admin Approval)
@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
@require_permission('manage_principals')
def approve_principal(request, id):
    try:
        p = Principal.objects.get(id=id)
    except Principal.DoesNotExist:
        return Response({"error": "Principal not found"}, status=404)

    p.status = "active"
    p.user.is_active = True
    p.user.save()
    p.save()

    return Response({"message": "Principal Approved & Activated"}, status=200)


# DEACTIVATE (Retirement / Leave Case)
@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
@require_permission('manage_principals')
def deactivate_principal(request, id):
    try:
        p = Principal.objects.get(id=id)
    except Principal.DoesNotExist:
        return Response({"error": "Principal not found"}, status=404)

    retirement_date = request.data.get("retirement_date", None)

    p.status = "inactive"
    p.retirement_date = retirement_date
    p.user.is_active = False
    p.user.save()
    p.save()

    return Response({"message": "Principal Deactivated"}, status=200)


# REACTIVATE PRINCIPAL
@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
@require_permission('manage_principals')
def activate_principal(request, id):
    try:
        p = Principal.objects.get(id=id)
    except Principal.DoesNotExist:
        return Response({"error": "Principal not found"}, status=404)

    p.status = "active"
    p.retirement_date = None
    p.user.is_active = True
    p.user.save()
    p.save()

    return Response({"message": "Principal Reactivated"}, status=200)
from .serializers import PrincipalUpdateSerializer

@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated])
@require_permission('manage_principals')
def update_principal(request, id):
    try:
        principal = Principal.objects.get(id=id)
    except Principal.DoesNotExist:
        return Response({"error": "Principal not found"}, status=404)

    serializer = PrincipalUpdateSerializer(
        principal,
        data=request.data,
        partial=True
    )

    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=200)

    print(serializer.errors)   # helpful during testing
    return Response(serializer.errors, status=400)

class delete_principal(DestroyAPIView):
    queryset = Principal.objects.all()
    serializer_class = PrincipalCreateSerializer
    permission_classes = [IsAuthenticated]

    def perform_destroy(self, instance):
        if not getattr(self.request, "user", None) or not getattr(self.request.user, "has_permission", None):
            raise PermissionDenied("Forbidden")
        if not self.request.user.has_permission("manage_principals"):
            raise PermissionDenied("Forbidden")
        return super().perform_destroy(instance)
def _resolve_principal_for_user(user):
    principal = Principal.objects.select_related("user").filter(user=user).first()
    if principal:
        return principal

    if getattr(user, "email", None):
        principal = Principal.objects.select_related("user").filter(email=user.email).first()
        if principal:
            return principal

    if getattr(user, "employee_id", None):
        principal = Principal.objects.select_related("user").filter(employee_id=user.employee_id).first()
        if principal:
            return principal

    if getattr(user, "username", None):
        principal = Principal.objects.select_related("user").filter(user__username=user.username).first()
        if principal:
            return principal

    return None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def principal_profile(request):
    principal = _resolve_principal_for_user(request.user)
    if not principal:
        return Response({"error": "Principal profile not found"}, status=status.HTTP_404_NOT_FOUND)

    display_name = " ".join(
        part for part in [
            principal.first_name or (principal.user.first_name if principal.user else None),
            principal.last_name or (principal.user.last_name if principal.user else None),
        ]
        if part
    ).strip()

    profile_pic_url = None
    if principal.profile_pic:
        try:
            profile_pic_url = request.build_absolute_uri(principal.profile_pic.url)
        except Exception:
            profile_pic_url = principal.profile_pic.url

    return Response({
        "id": principal.id,
        "name": display_name or principal.employee_id or (principal.user.username if principal.user else "Principal"),
        "full_name": display_name or None,
        "first_name": principal.first_name or (principal.user.first_name if principal.user else None),
        "last_name": principal.last_name or (principal.user.last_name if principal.user else None),
        "username": principal.user.username if principal.user else None,
        "email": principal.email or (principal.user.email if principal.user else None),
        "employee_id": principal.employee_id,
        "department": principal.department,
        "department_name": principal.department,
        "rank": principal.rank,
        "gender": principal.gender,
        "phone": principal.phone,
        "joining_date": principal.joining_date.isoformat() if principal.joining_date else None,
        "retirement_date": principal.retirement_date.isoformat() if principal.retirement_date else None,
        "status": principal.status,
        "role": "principal",
        "image": profile_pic_url,
        "profile_pic": profile_pic_url,
        "created_at": principal.created_at.isoformat() if principal.created_at else None,
    })
