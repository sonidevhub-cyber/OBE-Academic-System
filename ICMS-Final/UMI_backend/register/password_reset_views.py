from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

@api_view(['POST'])
@permission_classes([AllowAny])
def request_password_reset(request):
    return Response({"message": "OTP sent to email"})

@api_view(['POST'])
@permission_classes([AllowAny])
def confirm_password_reset(request):
    return Response({"message": "Password reset successful"})
