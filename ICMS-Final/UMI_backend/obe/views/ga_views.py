from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rbac.permissions import HasRBACPermission

from ..models import GraduateAttribute
from ..serializers.ga_serializers import GraduateAttributeSerializer


class GraduateAttributeViewSet(viewsets.ModelViewSet):
    serializer_class = GraduateAttributeSerializer
    permission_classes = [IsAuthenticated, HasRBACPermission]
    required_permission = 'manage_clo'

    def get_permissions(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), HasRBACPermission()]

    def get_queryset(self):
        queryset = GraduateAttribute.objects.all()
        code = self.request.query_params.get("code")
        if code:
            queryset = queryset.filter(code__iexact=code)
        return queryset.order_by("code")
