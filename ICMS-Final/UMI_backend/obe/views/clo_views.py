from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import CLO, CLOGAMapping
from ..serializers.clo_serializers import CLOSerializer, CLOGAMappingSerializer


class CLOViewSet(viewsets.ModelViewSet):
    serializer_class = CLOSerializer

    def get_queryset(self):
        queryset = CLO.objects.select_related("course", "course__semester", "course__semester__department")
        course_id = self.request.query_params.get("course")
        semester_id = self.request.query_params.get("semester")
        department_id = self.request.query_params.get("department")

        if course_id:
            queryset = queryset.filter(course_id=course_id)
        if semester_id:
            queryset = queryset.filter(course__semester_id=semester_id)
        if department_id:
            queryset = queryset.filter(course__semester__department_id=department_id)

        return queryset.order_by("clo_number")


class CLOGAMappingViewSet(viewsets.ModelViewSet):
    serializer_class = CLOGAMappingSerializer

    def get_queryset(self):
        queryset = CLOGAMapping.objects.select_related(
            "clo", "clo__course", "clo__course__semester", "clo__course__semester__department", "ga"
        )
        clo_id = self.request.query_params.get("clo")
        ga_id = self.request.query_params.get("ga")
        course_id = self.request.query_params.get("course")
        semester_id = self.request.query_params.get("semester")
        department_id = self.request.query_params.get("department")

        if clo_id:
            queryset = queryset.filter(clo_id=clo_id)
        if ga_id:
            queryset = queryset.filter(ga_id=ga_id)
        if course_id:
            queryset = queryset.filter(clo__course_id=course_id)
        if semester_id:
            queryset = queryset.filter(clo__course__semester_id=semester_id)
        if department_id:
            queryset = queryset.filter(clo__course__semester__department_id=department_id)

        return queryset

    @action(detail=False, methods=["post"])
    def bulk_create(self, request):
        mappings = request.data.get("mappings", [])
        if not isinstance(mappings, list):
            return Response({"detail": "mappings must be a list."}, status=status.HTTP_400_BAD_REQUEST)

        created = 0
        updated = 0
        with transaction.atomic():
            for item in mappings:
                clo_id = item.get("clo")
                ga_id = item.get("ga")
                if not clo_id or not ga_id:
                    continue
                weightage = item.get("weightage", 1)
                obj, was_created = CLOGAMapping.objects.update_or_create(
                    clo_id=clo_id,
                    ga_id=ga_id,
                    defaults={"weightage": weightage},
                )
                if was_created:
                    created += 1
                else:
                    updated += 1

        return Response({"created": created, "updated": updated})
