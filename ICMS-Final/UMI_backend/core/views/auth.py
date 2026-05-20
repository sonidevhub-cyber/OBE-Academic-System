from django.contrib.auth import authenticate, get_user_model
from django.db import models
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken


User = get_user_model()


class LoginView(generics.GenericAPIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        identifier = request.data.get('email') or request.data.get('identifier')
        password = request.data.get('password')

        if not identifier or not password:
            return Response({'error': 'Please provide both identifier and password'}, status=status.HTTP_400_BAD_REQUEST)

        # Try to find user by email or custom_id
        user_obj = User.objects.filter(models.Q(email=identifier) | models.Q(custom_id=identifier)).first()
        
        if not user_obj:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_400_BAD_REQUEST)

        # Use the actual email for authentication since it's the USERNAME_FIELD
        user = authenticate(request, email=user_obj.email, password=password)
        
        if not user:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_400_BAD_REQUEST)
        if not user.is_active:
            return Response({'error': 'Account deactivated'}, status=status.HTTP_400_BAD_REQUEST)

        refresh = RefreshToken.for_user(user)
        access = refresh.access_token
        
        serializer = UserListSerializer(user, context={'request': request})

        return Response(
            {
                'access_token': str(access),
                'refresh_token': str(refresh),
                'user': serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(generics.GenericAPIView):
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'error': 'refresh token required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            return Response({'error': 'Invalid refresh token'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'success': True}, status=status.HTTP_200_OK)


from core.serializers.user import UserListSerializer

class MeView(generics.GenericAPIView):
    def get(self, request):
        user = request.user
        serializer = UserListSerializer(user, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

