from rest_framework import serializers

from .models import Course, DateSheet, DateSheetItem, DateSheetNotification, Department, Semester, StudentEligibility


class DateSheetItemSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="datesheet_item_id", read_only=True)
    course_name = serializers.CharField(source="course.name", read_only=True)
    course_code = serializers.CharField(source="course.code", read_only=True)

    class Meta:
        model = DateSheetItem
        fields = ["id", "course", "course_name", "course_code", "exam_date", "start_time", "end_time", "exam_type"]


class DateSheetSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="datesheet_id", read_only=True)
    department_id = serializers.PrimaryKeyRelatedField(source="department", queryset=Department.objects.all(), write_only=True)
    semester_id = serializers.PrimaryKeyRelatedField(source="semester", queryset=Semester.objects.all(), write_only=True)
    items = DateSheetItemSerializer(many=True)
    department = serializers.SerializerMethodField()
    semester = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    eligibility_summary = serializers.SerializerMethodField()

    class Meta:
        model = DateSheet
        fields = [
            "id",
            "department_id",
            "semester_id",
            "department",
            "semester",
            "created_by",
            "created_by_name",
            "status",
            "status_label",
            "review_comment",
            "rejection_reason",
            "submitted_at",
            "reviewed_at",
            "reviewed_by",
            "reviewed_by_name",
            "created_at",
            "updated_at",
            "items",
            "eligibility_summary",
        ]
        read_only_fields = [
            "created_by",
            "created_by_name",
            "reviewed_by",
            "reviewed_by_name",
            "status",
            "status_label",
            "submitted_at",
            "reviewed_at",
            "created_at",
            "updated_at",
            "eligibility_summary",
        ]

    def get_department(self, obj):
        department = obj.department
        return {
            "id": department.department_id,
            "name": department.name,
            "code": department.code,
        } if department else None

    def get_semester(self, obj):
        semester = obj.semester
        return {
            "id": semester.semester_id,
            "name": semester.name,
            "semester_code": semester.semester_code,
        } if semester else None

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_reviewed_by_name(self, obj):
        if not obj.reviewed_by:
            return None
        return obj.reviewed_by.get_full_name() or obj.reviewed_by.username

    def get_eligibility_summary(self, obj):
        records = obj.eligibility_records.all()
        total = records.count()
        eligible = records.filter(is_eligible=True).count()
        overridden = records.filter(overridden_by_hod=True).count()
        return {
            "total": total,
            "eligible": eligible,
            "not_eligible": total - eligible,
            "overridden": overridden,
        }

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one DateSheet item is required.")

        seen_courses = set()
        sorted_items = sorted(
            value,
            key=lambda row: (row["exam_date"], row["start_time"], row["end_time"]),
        )
        for item in sorted_items:
            course = item["course"]
            if course.course_id in seen_courses:
                raise serializers.ValidationError("Duplicate course selected in DateSheet items.")
            seen_courses.add(course.course_id)

            if item["exam_date"] is None:
                raise serializers.ValidationError("exam_date is required for every item.")
            if item["start_time"] >= item["end_time"]:
                raise serializers.ValidationError("End time must be after start time.")

        for current, nxt in zip(sorted_items, sorted_items[1:]):
            if current["exam_date"] != nxt["exam_date"]:
                continue
            if current["end_time"] > nxt["start_time"]:
                raise serializers.ValidationError(
                    f"Exam time conflict detected between {current['course'].code} and {nxt['course'].code}."
                )

        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        department = attrs.get("department") or getattr(self.instance, "department", None)
        semester = attrs.get("semester") or getattr(self.instance, "semester", None)
        items = attrs.get("items")
        if items is None and self.instance is not None:
            items = list(self.instance.items.select_related("course"))
        if department and semester and semester.department_id != department.department_id:
            raise serializers.ValidationError({"semester_id": "Selected semester does not belong to selected department."})
        if items and semester:
            for item in items:
                course = item["course"] if isinstance(item, dict) else item.course
                if course.semester_id and course.semester_id != semester.semester_id:
                    raise serializers.ValidationError(
                        {"items": f"Course {course.code} does not belong to selected semester."}
                    )
        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        datesheet = DateSheet.objects.create(**validated_data)
        self._sync_items(datesheet, items_data)
        return datesheet

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        instance = super().update(instance, validated_data)
        if items_data is not None:
            instance.items.all().delete()
            self._sync_items(instance, items_data)
        return instance

    def _sync_items(self, datesheet, items_data):
        for item_data in items_data:
            DateSheetItem.objects.create(datesheet=datesheet, **item_data)


class StudentEligibilitySerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="eligibility_id", read_only=True)
    student_name = serializers.CharField(source="student.name", read_only=True)
    student_roll_no = serializers.CharField(source="student.student_id", read_only=True)
    department = serializers.CharField(source="student.department.name", read_only=True)
    semester = serializers.CharField(source="semester.name", read_only=True)
    course_name = serializers.CharField(source="course.name", read_only=True)
    course_code = serializers.CharField(source="course.code", read_only=True)
    overridden_by_name = serializers.SerializerMethodField()
    eligibility_status = serializers.SerializerMethodField()

    class Meta:
        model = StudentEligibility
        fields = [
            "id",
            "datesheet",
            "student",
            "student_name",
            "student_roll_no",
            "department",
            "semester",
            "course",
            "course_name",
            "course_code",
            "attendance_percentage",
            "is_eligible",
            "overridden_by_hod",
            "eligibility_status",
            "hod_reason",
            "overridden_by",
            "overridden_by_name",
            "updated_at",
            "created_at",
        ]
        read_only_fields = [
            "attendance_percentage",
            "is_eligible",
            "overridden_by_hod",
            "overridden_by",
            "overridden_by_name",
            "updated_at",
            "created_at",
        ]

    def get_overridden_by_name(self, obj):
        if not obj.overridden_by:
            return None
        return obj.overridden_by.get_full_name() or obj.overridden_by.username

    def get_eligibility_status(self, obj):
        if obj.overridden_by_hod and obj.is_eligible:
            return "Eligible (Overridden)"
        if obj.is_eligible:
            return "Eligible"
        return "Not Eligible"


class DateSheetNotificationSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="notification_id", read_only=True)
    datesheet_id = serializers.IntegerField(source="datesheet.datesheet_id", read_only=True)
    datesheet_status = serializers.CharField(source="datesheet.get_status_display", read_only=True)

    class Meta:
        model = DateSheetNotification
        fields = ["id", "datesheet_id", "datesheet_status", "message", "is_read", "read_at", "created_at"]
