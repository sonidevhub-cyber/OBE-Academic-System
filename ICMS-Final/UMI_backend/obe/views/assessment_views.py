from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction

from ..models import Assessment, AssessmentCLOMapping, StudentAssessment
from ..serializers.assessment_serializers import (
    AssessmentSerializer,
    AssessmentCLOMappingSerializer,
    StudentAssessmentSerializer,
)


class AssessmentViewSet(viewsets.ModelViewSet):
    serializer_class = AssessmentSerializer

    def get_queryset(self):
        queryset = Assessment.objects.all()
        course_id = self.request.query_params.get("course")
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        return queryset


class AssessmentCLOMappingViewSet(viewsets.ModelViewSet):
    serializer_class = AssessmentCLOMappingSerializer

    def get_queryset(self):
        queryset = AssessmentCLOMapping.objects.all()
        assessment_id = self.request.query_params.get("assessment")
        clo_id = self.request.query_params.get("clo")
        if assessment_id:
            queryset = queryset.filter(assessment_id=assessment_id)
        if clo_id:
            queryset = queryset.filter(clo_id=clo_id)
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
                assessment_id = item.get("assessment")
                clo_id = item.get("clo")
                if not assessment_id or not clo_id:
                    continue
                weightage = item.get("weightage", 1)
                obj, was_created = AssessmentCLOMapping.objects.update_or_create(
                    assessment_id=assessment_id,
                    clo_id=clo_id,
                    defaults={"weightage": weightage},
                )
                if was_created:
                    created += 1
                else:
                    updated += 1

        return Response({"created": created, "updated": updated})


class StudentAssessmentViewSet(viewsets.ModelViewSet):
    serializer_class = StudentAssessmentSerializer

    def get_queryset(self):
        queryset = StudentAssessment.objects.all()
        student_id = self.request.query_params.get("student")
        assessment_id = self.request.query_params.get("assessment")
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        if assessment_id:
            queryset = queryset.filter(assessment_id=assessment_id)
        return queryset

    @action(detail=False, methods=["post"])
    def bulk_create(self, request):
        records = request.data.get("records", [])
        if not isinstance(records, list):
            return Response({"detail": "records must be a list."}, status=status.HTTP_400_BAD_REQUEST)

        created = 0
        updated = 0
        with transaction.atomic():
            for item in records:
                student_id = item.get("student")
                assessment_id = item.get("assessment")
                if not student_id or not assessment_id:
                    continue
                obtained_marks = item.get("obtained_marks", 0)
                evaluated_by = item.get("evaluated_by")
                remarks = item.get("remarks", "")
                obj, was_created = StudentAssessment.objects.update_or_create(
                    student_id=student_id,
                    assessment_id=assessment_id,
                    defaults={
                        "obtained_marks": obtained_marks,
                        "evaluated_by_id": evaluated_by,
                        "remarks": remarks,
                    },
                )
                if was_created:
                    created += 1
                else:
                    updated += 1

        return Response({"created": created, "updated": updated})
