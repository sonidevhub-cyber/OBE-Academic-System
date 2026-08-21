from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Max
from rest_framework import serializers

from assessments.models import Assessment, Question, StudentAssessment, StudentQuestionMark
from obe.serializers import CourseGAScoreSerializer

from .models import CourseRetake, ReportInvalidationLog

User = get_user_model()


class CourseRetakeSerializer(serializers.ModelSerializer):
    student = serializers.SerializerMethodField()
    failed_course = serializers.SerializerMethodField()
    failed_batch = serializers.SerializerMethodField()
    current_batch = serializers.SerializerMethodField()
    retake_teacher = serializers.SerializerMethodField()
    ga_score = CourseGAScoreSerializer(read_only=True)

    def get_student(self, obj):
        return {
            "id": str(obj.student.student_id),
            "name": obj.student.name,
        }

    def get_failed_course(self, obj):
        return {
            "id": str(obj.failed_course.id),
            "name": obj.failed_course.name,
        }

    def get_failed_batch(self, obj):
        return {
            "id": str(obj.failed_batch.id),
            "name": obj.failed_batch.name,
        }

    def get_current_batch(self, obj):
        return {
            "id": str(obj.current_batch.id),
            "name": obj.current_batch.name,
        }

    def get_retake_teacher(self, obj):
        if not obj.retake_teacher:
            return None
        return {
            "id": str(obj.retake_teacher.id),
            "name": obj.retake_teacher.full_name,
        }

    class Meta:
        model = CourseRetake
        fields = [
            "id",
            "student",
            "failed_course",
            "failed_batch",
            "current_batch",
            "retake_teacher",
            "attempt_number",
            "status",
            "is_active",
            "ga_score",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "attempt_number", "is_active", "created_at", "updated_at"]


class CourseRetakeCreateSerializer(serializers.ModelSerializer):
    retake_teacher = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), allow_null=True, required=False)

    class Meta:
        model = CourseRetake
        fields = [
            "student",
            "failed_course",
            "failed_batch",
            "current_batch",
            "retake_teacher",
        ]

    def validate_retake_teacher(self, value):
        if value is None:
            return value

        if getattr(value, "role", None) not in {"instructor", "Teacher", "tvf"}:
            raise serializers.ValidationError("Retake teacher must have role Teacher.")

        return value

    def validate(self, attrs):
        student = attrs.get("student")
        failed_course = attrs.get("failed_course")
        
        # Check for existing active ongoing retake
        existing = CourseRetake.objects.filter(
            student=student,
            failed_course=failed_course,
            is_active=True,
            status="ongoing"
        ).exists()
        
        if existing:
            raise serializers.ValidationError("Cannot create a new retake: there is already an active ongoing retake for this student and course.")
        
        return attrs

    def _next_attempt_number(self, student, failed_course):
        last_attempt = (
            CourseRetake.objects.filter(student=student, failed_course=failed_course)
            .aggregate(max_attempt=Max("attempt_number"))
            .get("max_attempt")
            or 0
        )
        return last_attempt + 1

    @transaction.atomic
    def create(self, validated_data):
        attempt_number = self._next_attempt_number(
            validated_data["student"],
            validated_data["failed_course"],
        )

        if attempt_number > 3:
            raise serializers.ValidationError(
                {"attempt_number": "A student cannot have more than 3 retake attempts for a course."}
            )

        validated_data["attempt_number"] = attempt_number
        retake = CourseRetake.objects.create(**validated_data)
        return retake


class CourseRetakeStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseRetake
        fields = ["status"]


class RetakeAssessmentQuestionSerializer(serializers.ModelSerializer):
    clo_code = serializers.CharField(source="clo", read_only=True)

    class Meta:
        model = Question
        fields = ["id", "description", "bloom_level", "marks", "clo", "clo_code"]


class RetakeAssessmentSerializer(serializers.ModelSerializer):
    questions = RetakeAssessmentQuestionSerializer(many=True, read_only=True)   
    student_marks = serializers.SerializerMethodField()

    class Meta:
        model = Assessment
        fields = [
            "id",
            "title",
            "assessment_type",
            "total_marks",
            "assessment_date",
            "is_finalized",
            "questions",
            "student_marks",
        ]

    def get_student_marks(self, obj):
        student = self.context.get("student")
        if not student:
            return []

        student_marks_query = StudentQuestionMark.objects.filter(
            question__assessment=obj,
            student=student
        )

        # If assessment is linked to a course retake, filter by that
        if obj.course_retake:
            student_marks_query = student_marks_query.filter(course_retake=obj.course_retake)

        student_marks = (
            student_marks_query
            .select_related("question", "question__clo")
            .order_by("question__id")
        )

        return [
            {
                "question_id": str(mark.question_id),
                "marks_obtained": float(mark.marks_obtained),
            }
            for mark in student_marks
        ]


class RetakeAssessmentContextSerializer(serializers.Serializer):
    retake_id = serializers.CharField()
    course_id = serializers.CharField()
    student_id = serializers.CharField()
    batch_id = serializers.CharField()
    student = serializers.DictField()
    course = serializers.DictField()
    batch = serializers.DictField()
    assessments = RetakeAssessmentSerializer(many=True)


class ReportInvalidationLogSerializer(serializers.ModelSerializer):
    retake = serializers.SerializerMethodField()
    student_name = serializers.CharField(source="student.name", read_only=True) 
    student_registration_number = serializers.CharField(source="student.registration_number", read_only=True)
    student_id = serializers.CharField(source="student.student_id", read_only=True)

    class Meta:
        model = ReportInvalidationLog
        fields = [
            "id",
            "triggered_by_retake",
            "retake",
            "student",
            "student_id",
            "student_name",
            "student_registration_number",
            "affected_student_report",
            "affected_batch_report",
            "triggered_at",
            "resolved_at",
        ]

    def get_retake(self, obj):
        if not obj.triggered_by_retake:
            return None
        return {
            "id": str(obj.triggered_by_retake.id),
            "attempt_number": obj.triggered_by_retake.attempt_number,
            "status": obj.triggered_by_retake.status,
            "course_id": str(obj.triggered_by_retake.failed_course_id),
            "batch_id": str(obj.triggered_by_retake.current_batch_id),
        }


class FailedStudentSerializer(serializers.Serializer):
    student_id = serializers.CharField()
    name = serializers.CharField()
    registration_number = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    last_percentage = serializers.FloatField(required=False, allow_null=True)
    last_grade = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    current_retake_attempts = serializers.IntegerField(default=0)
    has_active_retake = serializers.BooleanField(default=False)
    is_pass = serializers.BooleanField(required=False, allow_null=True)
    is_retake_eligible = serializers.BooleanField(default=False)
    eligibility_status = serializers.CharField(required=False, allow_blank=True)
    eligibility_reason = serializers.CharField(required=False, allow_blank=True)


class PreviousInstructorSerializer(serializers.Serializer):
    teacher_id = serializers.CharField(allow_null=True, required=False)
    name = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    found = serializers.BooleanField(default=False)


class PerStudentRetakeResultSerializer(serializers.Serializer):
    student_id = serializers.CharField()
    success = serializers.BooleanField()
    error = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    retake_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    attempt_number = serializers.IntegerField(required=False, allow_null=True)


class BulkRetakeAssignmentInputSerializer(serializers.Serializer):
    batch_id = serializers.UUIDField()
    course_id = serializers.UUIDField()
    teacher_id = serializers.UUIDField(required=False, allow_null=True)
    student_ids = serializers.ListField(child=serializers.UUIDField())


class BulkRetakeAssignmentResponseSerializer(serializers.Serializer):
    results = PerStudentRetakeResultSerializer(many=True)
    summary = serializers.DictField(required=False)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if "summary" not in ret or not ret["summary"]:
            results = instance.get("results", [])
            total = len(results)
            succeeded = sum(1 for r in results if r.get("success"))
            failed = total - succeeded
            ret["summary"] = {
                "total": total,
                "succeeded": succeeded,
                "failed": failed,
            }
        return ret
