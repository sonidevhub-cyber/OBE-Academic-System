from rest_framework import serializers
from coordinators.models import TeacherAllocation


class CourseHistorySerializer(serializers.ModelSerializer):
    allocation_id = serializers.IntegerField(source="id", read_only=True)

    course_id = serializers.UUIDField(source="course.id", read_only=True)
    course_name = serializers.CharField(source="course.name", read_only=True)
    course_code = serializers.CharField(source="course.code", read_only=True)

    batch_id = serializers.UUIDField(source="batch.id", read_only=True)
    batch_name = serializers.CharField(source="batch.name", read_only=True)

    program_name = serializers.CharField(
        source="batch.program.name",
        read_only=True,
    )

    program_code = serializers.CharField(
        source="batch.program.code",
        read_only=True,
    )

    curriculum_version_id = serializers.IntegerField(
        source="curriculum_version.id",
        read_only=True,
    )

    curriculum_version = serializers.CharField(
        source="curriculum_version.version_no",
        read_only=True,
    )

    instructor_name = serializers.SerializerMethodField()

    class Meta:
        model = TeacherAllocation
        fields = [
            "allocation_id",

            "course_id",
            "course_name",
            "course_code",

            "batch_id",
            "batch_name",

            "program_name",
            "program_code",

            "semester_no",

            "curriculum_version_id",
            "curriculum_version",

            "instructor_name",

            "allocated_at",
            "status",
            "is_active",
        ]

    def get_instructor_name(self, obj):
        teacher = obj.teacher

        return (
            getattr(teacher, "full_name", None)
            or getattr(teacher, "name", None)
            or getattr(teacher, "email", None)
            or "N/A"
        )