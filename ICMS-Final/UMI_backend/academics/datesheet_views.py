from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from register.access_control import get_user_assigned_department_id, is_department_scoped_admin

from .datesheet_serializers import DateSheetNotificationSerializer, DateSheetSerializer, StudentEligibilitySerializer
from .datesheet_services import (
    create_approval_notifications,
    get_student_profile,
    get_user_department,
    get_user_role,
    mark_notifications_as_read,
    reset_eligibility_override,
    sync_datesheet_eligibility,
)
from .models import DateSheet, DateSheetNotification, StudentEligibility


class DateSheetViewSet(viewsets.ModelViewSet):
    serializer_class = DateSheetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = (
            DateSheet.objects.select_related("department", "semester", "created_by", "reviewed_by")
            .prefetch_related("items__course", "eligibility_records__student", "notifications")
        )

        user = self.request.user
        role = get_user_role(user)
        department = get_user_department(user)

        if role == "student":
            student = get_student_profile(user)
            if not student or not student.department or not student.semester:
                return queryset.none()
            queryset = queryset.filter(
                status=DateSheet.STATUS_APPROVED,
                department=student.department,
                semester=student.semester,
            )
        elif role == "coordinator":
            if department:
                queryset = queryset.filter(department=department)
            else:
                queryset = queryset.none()
        elif role == "hod":
            if department:
                queryset = queryset.filter(department=department)
            else:
                queryset = queryset.none()
        elif is_department_scoped_admin(user):
            assigned_department_id = get_user_assigned_department_id(user)
            queryset = queryset.filter(department_id=assigned_department_id)
        elif not (user.is_staff or user.is_superuser):
            queryset = queryset.none()

        status_filter = self.request.query_params.get("status")
        semester_id = self.request.query_params.get("semester")
        department_id = self.request.query_params.get("department")

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if semester_id:
            queryset = queryset.filter(semester_id=semester_id)
        if department_id and (user.is_staff or user.is_superuser or role == "hod"):
            queryset = queryset.filter(department_id=department_id)

        return queryset.order_by("-created_at")

    def _assert_coordinator_scope(self, request, datesheet: DateSheet):
        role = get_user_role(request.user)
        if role not in {"coordinator", "admin", "super_admin"}:
            raise PermissionDenied("Only coordinators can perform this operation.")

        department = get_user_department(request.user)
        if role == "coordinator" and (not department or datesheet.department_id != department.department_id):
            raise PermissionDenied("You can only manage DateSheets in your own department.")

    def _assert_hod_scope(self, request, datesheet: DateSheet):
        role = get_user_role(request.user)
        if role not in {"hod", "admin", "super_admin"}:
            raise PermissionDenied("Only HOD users can perform this operation.")

        department = get_user_department(request.user)
        if role == "hod" and (not department or datesheet.department_id != department.department_id):
            raise PermissionDenied("You can only review DateSheets for your department.")

    def create(self, request, *args, **kwargs):
        role = get_user_role(request.user)
        if role not in {"coordinator", "admin", "super_admin"}:
            raise PermissionDenied("Only coordinators can create DateSheets.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        department = serializer.validated_data["department"]
        semester = serializer.validated_data["semester"]
        user_department = get_user_department(request.user)

        if role == "coordinator" and (not user_department or department.department_id != user_department.department_id):
            raise PermissionDenied("Coordinators can only create DateSheets for their own department.")

        if semester.department_id != department.department_id:
            raise ValidationError({"semester_id": "Selected semester does not belong to the selected department."})

        sheet = serializer.save(created_by=request.user, status=DateSheet.STATUS_DRAFT)
        return Response(self.get_serializer(sheet).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        sheet = self.get_object()
        self._assert_coordinator_scope(request, sheet)

        if sheet.status == DateSheet.STATUS_APPROVED:
            raise PermissionDenied("Approved DateSheets cannot be edited.")
        if get_user_role(request.user) == "coordinator" and sheet.created_by_id != request.user.id:
            raise PermissionDenied("You can only edit DateSheets created by you.")

        serializer = self.get_serializer(sheet, data=request.data, partial=kwargs.pop("partial", False))
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(self.get_serializer(serializer.instance).data)

    def perform_update(self, serializer):
        serializer.save()

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        sheet = self.get_object()
        self._assert_coordinator_scope(request, sheet)

        if get_user_role(request.user) == "coordinator" and sheet.created_by_id != request.user.id:
            raise PermissionDenied("You can only submit DateSheets created by you.")

        if sheet.status == DateSheet.STATUS_APPROVED:
            raise ValidationError({"detail": "Approved DateSheets cannot be submitted again."})
        if not sheet.items.exists():
            raise ValidationError({"detail": "Add at least one DateSheet item before submission."})

        with transaction.atomic():
            sheet.status = DateSheet.STATUS_PENDING
            sheet.submitted_at = timezone.now()
            sheet.review_comment = ""
            sheet.rejection_reason = ""
            sheet.reviewed_at = None
            sheet.reviewed_by = None
            sheet.save(update_fields=["status", "submitted_at", "review_comment", "rejection_reason", "reviewed_at", "reviewed_by", "updated_at"])
            sync_datesheet_eligibility(sheet)

        serializer = self.get_serializer(sheet)
        return Response({
            "message": "DateSheet submitted to HOD successfully.",
            "data": serializer.data,
        })

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        sheet = self.get_object()
        self._assert_hod_scope(request, sheet)

        if sheet.status != DateSheet.STATUS_PENDING:
            raise ValidationError({"detail": "Only pending DateSheets can be approved."})

        review_comment = str(request.data.get("review_comment", "")).strip()

        with transaction.atomic():
            sheet.status = DateSheet.STATUS_APPROVED
            sheet.review_comment = review_comment
            sheet.rejection_reason = ""
            sheet.reviewed_by = request.user
            sheet.reviewed_at = timezone.now()
            sheet.save(update_fields=["status", "review_comment", "rejection_reason", "reviewed_by", "reviewed_at", "updated_at"])
            sync_datesheet_eligibility(sheet)
            create_approval_notifications(sheet)

        return Response({
            "message": "DateSheet approved successfully.",
            "data": self.get_serializer(sheet).data,
        })

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        sheet = self.get_object()
        self._assert_hod_scope(request, sheet)

        if sheet.status != DateSheet.STATUS_PENDING:
            raise ValidationError({"detail": "Only pending DateSheets can be rejected."})

        reason = str(request.data.get("reason", request.data.get("review_comment", ""))).strip()
        if not reason:
            raise ValidationError({"reason": "Rejection reason is required."})

        with transaction.atomic():
            sheet.status = DateSheet.STATUS_REJECTED
            sheet.rejection_reason = reason
            sheet.review_comment = reason
            sheet.reviewed_by = request.user
            sheet.reviewed_at = timezone.now()
            sheet.save(update_fields=["status", "rejection_reason", "review_comment", "reviewed_by", "reviewed_at", "updated_at"])

        return Response({
            "message": "DateSheet rejected successfully.",
            "data": self.get_serializer(sheet).data,
        })

    @action(detail=False, methods=["get"])
    def dashboard(self, request):
        queryset = self.get_queryset()
        role = get_user_role(request.user)
        response_data = {
            "role": role,
            "counts": {
                "total": queryset.count(),
                "draft": queryset.filter(status=DateSheet.STATUS_DRAFT).count(),
                "pending": queryset.filter(status=DateSheet.STATUS_PENDING).count(),
                "approved": queryset.filter(status=DateSheet.STATUS_APPROVED).count(),
                "rejected": queryset.filter(status=DateSheet.STATUS_REJECTED).count(),
            },
            "recent": self.get_serializer(queryset[:5], many=True).data,
        }
        return Response(response_data)


class StudentEligibilityViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StudentEligibilitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = StudentEligibility.objects.select_related(
            "datesheet",
            "datesheet__department",
            "datesheet__semester",
            "student",
            "student__department",
            "student__semester",
            "course",
            "semester",
            "overridden_by",
        )

        user = self.request.user
        role = get_user_role(user)
        department = get_user_department(user)
        student = get_student_profile(user)

        if role == "student":
            if not student:
                return queryset.none()
            queryset = queryset.filter(student=student)
        elif role == "hod":
            if department:
                queryset = queryset.filter(datesheet__department=department)
            else:
                queryset = queryset.none()
        elif role == "coordinator":
            if department:
                queryset = queryset.filter(datesheet__department=department)
            else:
                queryset = queryset.none()
        elif is_department_scoped_admin(user):
            assigned_department_id = get_user_assigned_department_id(user)
            queryset = queryset.filter(datesheet__department_id=assigned_department_id)
        elif not (user.is_staff or user.is_superuser):
            queryset = queryset.none()

        department_id = self.request.query_params.get("department")
        semester_id = self.request.query_params.get("semester")
        course_id = self.request.query_params.get("course")
        datesheet_id = self.request.query_params.get("datesheet")
        low_attendance = str(self.request.query_params.get("low_attendance", "")).lower() in {"1", "true", "yes"}

        if department_id:
            queryset = queryset.filter(datesheet__department_id=department_id)
        if semester_id:
            queryset = queryset.filter(semester_id=semester_id)
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        if datesheet_id:
            queryset = queryset.filter(datesheet_id=datesheet_id)
        if low_attendance:
            queryset = queryset.filter(attendance_percentage__lt=75)

        return queryset.order_by("student__name", "course__name")

    @action(detail=True, methods=["post"])
    def override(self, request, pk=None):
        eligibility = self.get_object()
        role = get_user_role(request.user)
        if role not in {"hod", "admin", "super_admin"}:
            raise PermissionDenied("Only HOD users can override eligibility.")

        department = get_user_department(request.user)
        if role == "hod":
            if not department:
                raise PermissionDenied("Your HOD profile is not mapped to a department.")
            if eligibility.datesheet.department_id != department.department_id:
                raise PermissionDenied("You can only override students in your department.")

        reason = str(request.data.get("hod_reason", request.data.get("reason", ""))).strip()
        if not reason:
            raise ValidationError({"hod_reason": "A reason is required for override."})

        reset_eligibility_override(eligibility, reason, request.user)
        return Response({
            "message": "Eligibility override applied successfully.",
            "data": self.get_serializer(eligibility).data,
        })


class DateSheetNotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DateSheetNotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = DateSheetNotification.objects.select_related("datesheet", "user")
        return queryset.filter(user=self.request.user)

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        updated = mark_notifications_as_read(request.user)
        return Response({"message": "Notifications marked as read.", "updated": updated})

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        if notification.user_id != request.user.id:
            raise PermissionDenied("You can only update your own notifications.")
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save(update_fields=["is_read", "read_at"])
        return Response({"message": "Notification marked as read.", "data": self.get_serializer(notification).data})
