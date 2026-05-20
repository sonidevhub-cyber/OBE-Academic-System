from django.contrib.auth import get_user_model
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsSAC
from core.serializers.user import UserCreateSerializer, UserListSerializer, UserUpdateSerializer


User = get_user_model()


class UserListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsSAC]

    def get_serializer_class(self):
        return UserCreateSerializer if self.request.method == 'POST' else UserListSerializer

    def get_queryset(self):
        queryset = User.objects.all().prefetch_related('programs').select_related('batch')

        role = self.request.query_params.get('role')
        is_active = self.request.query_params.get('is_active')

        if role:
            queryset = queryset.filter(role=role)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({'user': UserListSerializer(user).data, 'generated_password': user.generated_password}, status=status.HTTP_201_CREATED)


class UserDetailUpdateView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsSAC]
    queryset = User.objects.all()

    def get_serializer_class(self):
        return UserUpdateSerializer if self.request.method in ['PATCH'] else UserListSerializer


class UserDeactivateView(generics.GenericAPIView):
    permission_classes = [IsSAC]

    def delete(self, request, pk):
        user = User.objects.get(pk=pk)
        if user.role == 'SAC':
            return Response({'error': 'Cannot deactivate SAC'}, status=status.HTTP_400_BAD_REQUEST)
        user.is_active = False
        user.save(update_fields=['is_active'])
        return Response({'success': True}, status=status.HTTP_200_OK)

