from django.core.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from assessments.models import Assessment, StudentAssessment
from core.models import Batch
from core.models import Semester
from obe.models import CourseSession, CourseGAScore, GACQIRecord, GAReport, GAMasterCache
from obe.services import calculate_all_course_ga_scores
from students.models import Student

from .models import CourseRetake, ReportInvalidationLog
from .permissions import IsSACOnly, IsTeacherOrOversight, is_coordinator, is_hod, is_sac, is_teacher
from .report_access_wrapper import get_ga_report_with_invalidation_check
from .services import recalculate_reports_for_retake_queryset
from .serializers import (
    CourseRetakeCreateSerializer,
    CourseRetakeSerializer,
    CourseRetakeStatusUpdateSerializer,
    ReportInvalidationLogSerializer,
    RetakeAssessmentSerializer,
)


def _retake_queryset():
    return (
        CourseRetake.objects.all()
        .select_related(
            "student",
            "student__user",
            "failed_course",
            "failed_batch",
            "current_batch",
            "retake_teacher",
            "ga_score",
            "ga_score__ga",
            "ga_score__course_session",
            "ga_score__course_session__course",
        )
        .order_by("-created_at")
    )


def _assessment_queryset_for_retake(retake: CourseRetake):
    return (
        Assessment.objects.filter(
            course=retake.failed_course,
            batch=retake.current_batch,
            course_retake=retake  # Only get assessments linked to this retake
        )
        .select_related("course", "batch", "semester", "instructor")
        .prefetch_related("questions", "student_assessments")
        .order_by("assessment_date", "created_at")
    )


class CourseRetakeCreateView(APIView):
    permission_classes = [IsSACOnly]

    def get(self, request):
        if not is_sac(request.user):
            raise PermissionDenied("You are not allowed to view retakes.")

        serializer = CourseRetakeSerializer(_retake_queryset(), many=True)
        return Response(serializer.data)

    def post(self, request):
        if not is_sac(request.user):
            raise PermissionDenied("You are not allowed to create retakes.")

        serializer = CourseRetakeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        retake = serializer.save()
        return Response(CourseRetakeSerializer(retake).data, status=status.HTTP_201_CREATED)


class RetakeStatusUpdateView(APIView):
    permission_classes = [IsSACOnly]

    def patch(self, request, pk):
        if not is_sac(request.user):
            raise PermissionDenied("You are not allowed to update this retake.")

        retake = get_object_or_404(CourseRetake, pk=pk)
        serializer = CourseRetakeStatusUpdateSerializer(retake, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CourseRetakeSerializer(retake).data, status=status.HTTP_200_OK)


class StudentRetakeHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        student = get_object_or_404(Student.objects.select_related("user"), student_id=student_id)

        user_student_id = getattr(getattr(request.user, "student_profile", None), "student_id", None)
        can_view = is_sac(request.user) or is_hod(request.user) or is_coordinator(request.user) or str(user_student_id) == str(student.student_id)
        if not can_view:
            raise PermissionDenied("You are not allowed to view this student history.")

        queryset = _retake_queryset().filter(student=student)
        return Response(CourseRetakeSerializer(queryset, many=True).data)


class MyAssignedRetakesView(APIView):
    permission_classes = [IsTeacherOrOversight]

    def get(self, request):
        user = request.user

        if is_sac(user) or is_hod(user) or is_coordinator(user):
            queryset = _retake_queryset()
        elif is_teacher(user):
            queryset = _retake_queryset().filter(retake_teacher=user)
        else:
            raise PermissionDenied("You are not allowed to view assigned retakes.")

        return Response(CourseRetakeSerializer(queryset, many=True).data)


class RetakeAssessmentContextView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, retake_id):
        retake = get_object_or_404(
            _retake_queryset(),
            pk=retake_id,
        )

        user = request.user
        can_view = is_sac(user) or is_hod(user) or is_coordinator(user) or is_teacher(user)
        if not can_view:
            raise PermissionDenied("You are not allowed to view this retake context.")

        student = retake.student
        assessments = _assessment_queryset_for_retake(retake)
        serialized_assessments = RetakeAssessmentSerializer(
            assessments,
            many=True,
            context={"student": student},
        ).data

        return Response(
            {
                "retake_id": str(retake.id),
                "course_id": str(retake.failed_course_id),
                "student_id": str(student.student_id),
                "batch_id": str(retake.current_batch_id),
                "attempt_number": retake.attempt_number,
                "status": retake.status,
                "student": {
                    "id": str(student.student_id),
                    "name": student.name,
                    "registration_number": student.registration_number,
                    "batch_id": str(student.batch_id) if student.batch_id else None,
                    "batch_name": student.batch.name if student.batch else None,
                },
                "course": {
                    "id": str(retake.failed_course_id),
                    "name": retake.failed_course.name,
                },
                "batch": {
                    "id": str(retake.current_batch_id),
                    "name": retake.current_batch.name,
                    "current_semester": retake.current_batch.current_semester,
                    "curriculum_version_id": str(retake.current_batch.curriculum_version_id) if retake.current_batch.curriculum_version_id else None,
                },
                "assessments": serialized_assessments,
            }
        )


class RetakeInvalidationLogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (is_sac(request.user) or is_hod(request.user)):
            raise PermissionDenied("You are not allowed to view invalidation logs.")

        student_id = request.query_params.get("student_id")
        queryset = ReportInvalidationLog.objects.select_related("student", "triggered_by_retake")
        if student_id:
            queryset = queryset.filter(student_id=student_id)

        return Response(ReportInvalidationLogSerializer(queryset, many=True).data)


class PendingRetakeInvalidationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (is_sac(request.user) or is_hod(request.user)):
            raise PermissionDenied("You are not allowed to view pending invalidations.")

        queryset = (
            ReportInvalidationLog.objects.filter(resolved_at__isnull=True)
            .select_related("student", "triggered_by_retake")
            .order_by("-triggered_at")
        )
        return Response(ReportInvalidationLogSerializer(queryset, many=True).data)


class RecalculateRetakeReportsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not (is_sac(user) or is_hod(user) or is_coordinator(user)):
            raise PermissionDenied("You are not allowed to recalculate retake reports.")

        batch_id = request.data.get("batch_id") or request.query_params.get("batch_id")
        semester_id = request.data.get("semester_id") or request.query_params.get("semester_id")
        queryset = CourseRetake.objects.filter(is_active=True)
        if batch_id:
            batch = get_object_or_404(Batch, pk=batch_id)
            queryset = queryset.filter(current_batch=batch)

        if semester_id:
            get_object_or_404(Semester, pk=semester_id)

        processed = recalculate_reports_for_retake_queryset(queryset, semester_id=semester_id)
        return Response(
            {
                "message": "Retake reports recalculated successfully",
                "processed_count": len(processed),
            },
            status=status.HTTP_200_OK,
        )
