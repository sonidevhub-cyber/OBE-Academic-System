from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model

User = get_user_model()

from core.serializers.user import UserListSerializer

class AdminViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def stats(self, request):
        return Response({
            "total_students": User.objects.filter(role='STUDENT').count(),
            "total_instructors": User.objects.filter(role='INSTRUCTOR').count(),
            "active_courses": 0,
            "pending_requests": 0
        })

    @action(detail=False, methods=['get'])
    def profile(self, request):
        user = request.user
        serializer = UserListSerializer(user, context={'request': request})
        return Response(serializer.data)
