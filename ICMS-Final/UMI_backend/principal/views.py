from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from .models import Principal
from .serializers import PrincipalCreateSerializer
from rest_framework.generics import DestroyAPIView


# ADMIN CREATES PRINCIPAL (Pending by default)
@api_view(["POST"])
@permission_classes([IsAdminUser])
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
@permission_classes([IsAdminUser])
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
@permission_classes([IsAdminUser])
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
@permission_classes([IsAdminUser])
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
@permission_classes([IsAdminUser])
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