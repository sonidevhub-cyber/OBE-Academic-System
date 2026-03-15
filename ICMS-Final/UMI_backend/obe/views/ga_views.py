from rest_framework import viewsets

from ..models import GraduateAttribute
from ..serializers.ga_serializers import GraduateAttributeSerializer


class GraduateAttributeViewSet(viewsets.ModelViewSet):
    serializer_class = GraduateAttributeSerializer

    def get_queryset(self):
        queryset = GraduateAttribute.objects.all()
        code = self.request.query_params.get("code")
        if code:
            queryset = queryset.filter(code__iexact=code)
        return queryset.order_by("code")
