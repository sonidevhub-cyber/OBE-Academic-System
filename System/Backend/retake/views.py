from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied, ValidationError
from django.db.models import Max, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from assessments.models import Assessment, StudentAssessment, FinalResult
from assessments.services.clo_service import CLOService
from core.models import Batch, Course as CoreCourse, Semester
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
    FailedStudentSerializer,
    PreviousInstructorSerializer,
    BulkRetakeAssignmentInputSerializer,
    PerStudentRetakeResultSerializer,
    ReportInvalidationLogSerializer,
    RetakeAssessmentSerializer,
)

User = get_user_model()


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


def _get_student_pass_fail_for_course(student, course_id, batch_id):
    """Reuse CLOService pass/fail logic (>=50% threshold) for a single student+course+batch.
    Returns (is_pass: bool, percentage: float|None, grade: str|None) or None if no data.
    """
    latest_session = (
        CourseSession.objects.filter(
            course_id=course_id,
            batch_id=batch_id,
            is_active=True,
        )
        .order_by("-semester__number", "-created_at")
        .select_related("semester")
        .first()
    )
    if not latest_session:
        final_result = (
            FinalResult.objects.filter(
                student=student,
                course_id=course_id,
            )
            .order_by("-id")
            .first()
        )
        if final_result:
            return final_result.is_pass, float(final_result.total_percentage), final_result.grade
        return None

    semester_id = latest_session.semester_id
    try:
        report_data = CLOService.generate_student_report(
            course_id=str(course_id),
            batch_id=str(batch_id),
            semester_id=str(semester_id),
        )
    except Exception:
        return None

    if isinstance(report_data, dict) and report_data.get("error"):
        return None

    report_rows = report_data if isinstance(report_data, list) else report_data.get("report", [])
    student_id_str = str(student.student_id)
    for row in report_rows:
        if str(row.get("student_id")) == student_id_str:
            status_val = row.get("status", "").upper()
            percentage = row.get("percentage")
            gpa = row.get("gpa", 0)
            if percentage and gpa >= 3.5:
                grade = "A" if percentage >= 85 else ("B" if percentage >= 75 else ("C" if percentage >= 65 else ("D" if percentage >= 50 else "F")))
            else:
                grade = None
            is_pass = status_val == "PASS"
            return is_pass, float(percentage) if percentage is not None else None, grade
    return None


class FailedStudentsLookupView(APIView):
    """Given batch_id + course_id, return students in that batch with pass/fail
    and retake eligibility metadata for this subject.
    """
    permission_classes = [IsSACOnly]

    def get(self, request):
        if not is_sac(request.user):
            raise PermissionDenied("You are not allowed to lookup failed students.")

        batch_id = request.query_params.get("batch_id")
        course_id = request.query_params.get("course_id")
        if not batch_id or not course_id:
            return Response(
                {"detail": "Both batch_id and course_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        batch = get_object_or_404(Batch, pk=batch_id)
        batch_students = list(
            Student.objects.filter(
                Q(user__batch_id=batch_id) | Q(batch_id=batch_id),
            )
            .select_related("user")
            .distinct()
        )
        if not batch_students:
            return Response([])

        latest_session = (
            CourseSession.objects.filter(
                course_id=course_id,
                batch_id=batch_id,
                is_active=True,
            )
            .order_by("-semester__number", "-created_at")
            .select_related("semester")
            .first()
        )
        semester_id = latest_session.semester_id if latest_session else None

        report_rows_by_student = {}
        if latest_session and semester_id:
            try:
                report_data = CLOService.generate_student_report(
                    course_id=str(course_id),
                    batch_id=str(batch_id),
                    semester_id=str(semester_id),
                )
                if not (isinstance(report_data, dict) and report_data.get("error")):
                    rows = report_data if isinstance(report_data, list) else report_data.get("report", [])
                    for row in rows:
                        sid = str(row.get("student_id"))
                        report_rows_by_student[sid] = row
            except Exception:
                report_rows_by_student = {}

        final_results_by_student = {}
        final_results_qs = FinalResult.objects.filter(
            student__in=batch_students,
            course_id=course_id,
        )
        for fr in final_results_qs:
            final_results_by_student[str(fr.student_id)] = fr

        existing_retakes = {}
        for retake in CourseRetake.objects.filter(
            student__in=batch_students,
            failed_course_id=course_id,
        ):
            key = str(retake.student_id)
            if key not in existing_retakes:
                existing_retakes[key] = {"max_attempt": 0, "has_active_ongoing": False}
            if retake.attempt_number > existing_retakes[key]["max_attempt"]:
                existing_retakes[key]["max_attempt"] = retake.attempt_number
            if retake.is_active and retake.status == "ongoing":
                existing_retakes[key]["has_active_ongoing"] = True

        student_options = []
        for student in batch_students:
            sid = str(student.student_id)
            retake_info = existing_retakes.get(sid, {})
            max_attempt = retake_info.get("max_attempt", 0)
            has_active_ongoing = retake_info.get("has_active_ongoing", False)

            is_pass = None
            percentage = None
            grade = None
            row = report_rows_by_student.get(sid)
            if row:
                status_val = row.get("status", "").upper()
                percentage = row.get("percentage")
                is_pass = status_val == "PASS"
                pct = percentage or 0
                if pct >= 85:
                    grade = "A"
                elif pct >= 75:
                    grade = "B"
                elif pct >= 65:
                    grade = "C"
                elif pct >= 50:
                    grade = "D"
                else:
                    grade = "F"

            if is_pass is None:
                fr = final_results_by_student.get(sid)
                if fr:
                    is_pass = fr.is_pass
                    percentage = float(fr.total_percentage)
                    grade = fr.grade

            if is_pass is None:
                eligibility_status = "no_result"
                eligibility_reason = "Result is not finalized or no result row was found; retake can still be assigned if needed."
                is_retake_eligible = True
            elif is_pass:
                eligibility_status = "passed"
                eligibility_reason = "Student has passed this subject; retake can be assigned for improvement."
                is_retake_eligible = True
            elif has_active_ongoing and max_attempt < 3:
                eligibility_status = "active_retake"
                eligibility_reason = "Student already has an active retake for this subject."
                is_retake_eligible = False
            elif max_attempt >= 3:
                eligibility_status = "max_attempts"
                eligibility_reason = "Student has already reached the maximum 3 retake attempts."
                is_retake_eligible = False
            else:
                eligibility_status = "failed"
                eligibility_reason = "Pass criteria not met; retake can be assigned."
                is_retake_eligible = True

            student_options.append({
                "student_id": sid,
                "name": student.name,
                "registration_number": student.registration_number,
                "last_percentage": percentage,
                "last_grade": grade,
                "current_retake_attempts": max_attempt,
                "has_active_retake": has_active_ongoing,
                "is_pass": is_pass,
                "is_retake_eligible": is_retake_eligible,
                "eligibility_status": eligibility_status,
                "eligibility_reason": eligibility_reason,
            })

        serializer = FailedStudentSerializer(student_options, many=True)
        return Response(serializer.data)


class PreviousInstructorLookupView(APIView):
    """Given batch_id + course_id, return the teacher from the most recent
    active CourseSession for that batch+course pair (order by semester desc).
    Returns null gracefully if no prior offering exists.
    """
    permission_classes = [IsSACOnly]

    def get(self, request):
        if not is_sac(request.user):
            raise PermissionDenied("You are not allowed to lookup previous instructors.")

        batch_id = request.query_params.get("batch_id")
        course_id = request.query_params.get("course_id")
        if not batch_id or not course_id:
            return Response(
                {"detail": "Both batch_id and course_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        latest_session = (
            CourseSession.objects.filter(
                course_id=course_id,
                batch_id=batch_id,
                is_active=True,
                instructor__isnull=False,
            )
            .order_by("-semester__number", "-created_at")
            .select_related("instructor")
            .first()
        )

        if not latest_session or not latest_session.instructor:
            serializer = PreviousInstructorSerializer({"found": False})
            return Response(serializer.data)

        teacher = latest_session.instructor
        serializer = PreviousInstructorSerializer({
            "teacher_id": str(teacher.id),
            "name": teacher.full_name,
            "found": True,
        })
        return Response(serializer.data)


class BulkRetakeAssignmentView(APIView):
    """Bulk retake assignment with per-student partial success.
    Input: { batch_id, course_id, teacher_id (nullable), student_ids: [list] }
    Output: { results: [ { student_id, success, error?, retake_id?, attempt_number? } ], summary: ... }
    """
    permission_classes = [IsSACOnly]

    def post(self, request):
        if not is_sac(request.user):
            raise PermissionDenied("You are not allowed to bulk-assign retakes.")

        input_serializer = BulkRetakeAssignmentInputSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        data = input_serializer.validated_data

        batch_id = data["batch_id"]
        course_id = data["course_id"]
        teacher_id = data.get("teacher_id")
        student_ids = data["student_ids"]

        batch = get_object_or_404(Batch, pk=batch_id)

        teacher = None
        if teacher_id:
            teacher = User.objects.filter(pk=teacher_id, is_active=True).first()
            if not teacher:
                return Response(
                    {"detail": "Teacher not found or inactive."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if getattr(teacher, "role", None) not in {"instructor", "Teacher", "tvf"}:
                return Response(
                    {"detail": "Selected teacher must have role Instructor or Visiting Faculty."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        valid_students = {
            str(s.student_id): s
            for s in Student.objects.filter(
                Q(user__batch_id=batch_id) | Q(batch_id=batch_id),
                student_id__in=student_ids,
            ).select_related("user").distinct()
        }

        results = []
        course = get_object_or_404(CoreCourse, pk=course_id)

        for sid in student_ids:
            sid_str = str(sid)
            student = valid_students.get(sid_str)
            entry = {"student_id": sid_str, "success": False}

            if not student:
                entry["error"] = "Student does not belong to the selected batch."
                results.append(entry)
                continue

            last_attempt = (
                CourseRetake.objects.filter(
                    student=student,
                    failed_course=course,
                )
                .aggregate(max_attempt=Max("attempt_number"))
                .get("max_attempt")
                or 0
            )
            next_attempt = last_attempt + 1
            if next_attempt > 3:
                entry["error"] = "Already at max retake attempts (3) for this course."
                results.append(entry)
                continue

            existing_active = CourseRetake.objects.filter(
                student=student,
                failed_course=course,
                is_active=True,
                status="ongoing",
            ).exists()
            if existing_active:
                entry["error"] = "An active ongoing retake already exists for this student and course."
                results.append(entry)
                continue

            try:
                retake = CourseRetake.objects.create(
                    student=student,
                    failed_course=course,
                    failed_batch=batch,
                    current_batch=batch,
                    retake_teacher=teacher,
                    attempt_number=next_attempt,
                    status="ongoing",
                    is_active=True,
                )
                if next_attempt > 1:
                    CourseRetake.objects.filter(
                        student=student,
                        failed_course=course,
                        is_active=True,
                    ).exclude(pk=retake.pk).update(is_active=False)
                entry["success"] = True
                entry["retake_id"] = str(retake.pk)
                entry["attempt_number"] = next_attempt
            except (ValidationError, Exception) as exc:
                msg = str(exc)
                if not msg and hasattr(exc, "message_dict"):
                    parts = []
                    for key, msgs in exc.message_dict.items():
                        for m in msgs:
                            parts.append(f"{key}: {m}" if key != "__all__" else m)
                    msg = "; ".join(parts)
                entry["error"] = msg or "Failed to create retake record."

            results.append(entry)

        per_student = PerStudentRetakeResultSerializer(results, many=True).data
        total = len(results)
        succeeded = sum(1 for r in results if r.get("success"))
        response_payload = {
            "results": per_student,
            "summary": {
                "total": total,
                "succeeded": succeeded,
                "failed": total - succeeded,
            },
        }
        return Response(response_payload, status=status.HTTP_200_OK)
