from rest_framework import serializers

from core.models.batch import Batch
from core.models.course import Course # Import Course model
from core.models.semester import Semester # Import Semester model
from curriculum.services import branch_version_if_needed

class BatchCreateSerializer(serializers.ModelSerializer):
    program_id = serializers.UUIDField(write_only=True, required=False)
    curriculum_version_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Batch
        fields = ['name', 'start_year', 'end_year', 'session_type', 'program_id', 'curriculum_version_id']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # If this is an update (instance exists), make start_year, end_year, session_type read-only
        if self.instance is not None:
            for field_name in ['start_year', 'end_year', 'session_type']:
                self.fields[field_name].read_only = True

    def validate(self, attrs):
        # Check if both start_year and end_year are provided before validating
        if 'start_year' in attrs and 'end_year' in attrs:
            if attrs['end_year'] <= attrs['start_year']:
                raise serializers.ValidationError('End year must be greater than start year')
        return attrs

    def create(self, validated_data):
        from core.models.program import Program
        from curriculum.models import CurriculumVersion
        # from curriculum.services import clone_curriculum_for_batch

        program_id = validated_data.pop('program_id')
        curriculum_version_id = validated_data.pop('curriculum_version_id', None)
        program = Program.objects.get(id=program_id, is_active=True)

        session_type = validated_data.get('session_type')
        current_semester = 1 if session_type == 'fall' else 2
        
        new_batch = Batch.objects.create(program=program, current_semester=current_semester, **validated_data)

        if curriculum_version_id:
            try:
                master_version = CurriculumVersion.objects.get(id=curriculum_version_id, program=program, status='finalized')
                
                # Use request user from context
                request = self.context.get('request')
                user = request.user if request else None
                
                if not user:
                    # Fallback to program creator if no request user
                    user = program.created_by
                
                if user:
                    branch_version_if_needed(master_version, new_batch, user)

            except CurriculumVersion.DoesNotExist:
                # Handle case where master version is not found
                print(f"Warning: Master curriculum version with ID {curriculum_version_id} not found.")

        return new_batch


from core.models.program import Program
from core.models.department import Department

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'code']

class ProgramSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)

    class Meta:
        model = Program
        fields = "__all__"
        
class BatchListSerializer(serializers.ModelSerializer):
    program_name = serializers.CharField(source='program.name', read_only=True)
    program_id = serializers.CharField(source='program.id', read_only=True)
    curriculum_version_id = serializers.IntegerField(source='curriculum_version.id', read_only=True, allow_null=True)
    curriculum_version_no = serializers.CharField(source='curriculum_version.version_no', read_only=True)
    student_count = serializers.SerializerMethodField()
    program = ProgramSerializer(read_only=True)
    is_graduating_eligible = serializers.BooleanField(read_only=True)
    pending_exit_survey_count = serializers.IntegerField(read_only=True)
    exit_survey_enabled = serializers.BooleanField(read_only=True)
    exit_survey_enabled_at = serializers.DateTimeField(read_only=True, allow_null=True)
    alumni_feedback_enabled = serializers.BooleanField(read_only=True)
    alumni_feedback_enabled_at = serializers.DateTimeField(read_only=True, allow_null=True)
    alumni_feedback_due_at = serializers.SerializerMethodField()
    graduation_status = serializers.CharField(read_only=True)
    is_program_end_ready = serializers.BooleanField(read_only=True)
    is_alumni_feedback_eligible = serializers.BooleanField(read_only=True)
    alumni_feedback_cycle_status = serializers.SerializerMethodField()
    alumni_feedback_response_rate = serializers.SerializerMethodField()
    alumni_feedback_response_count = serializers.SerializerMethodField()
    alumni_feedback_total_alumni = serializers.SerializerMethodField()

    class Meta:
        model = Batch
        fields = [
            'id',
            'custom_id',
            'name',
            'program_name',
            'program_id',
            'session_type',
            'start_year',
            'end_year',
            'current_semester',
            'status',
            'curriculum_version_id',
            'curriculum_version_no',
            'graduated_at',
            'is_active',
            'student_count',
            'program',
            'is_graduating_eligible',
            'pending_exit_survey_count',
            'exit_survey_enabled',
            'exit_survey_enabled_at',
            'alumni_feedback_enabled',
            'alumni_feedback_enabled_at',
            'alumni_feedback_due_at',
            'graduation_status',
            'is_program_end_ready',
            'is_alumni_feedback_eligible',
            'alumni_feedback_cycle_status',
            'alumni_feedback_response_rate',
            'alumni_feedback_response_count',
            'alumni_feedback_total_alumni',
        ]

    def get_student_count(self, obj):
        User = self.context['request'].user.__class__
        # Avoid importing user model directly in serializer for minimal coupling
        from django.contrib.auth import get_user_model
        from django.db.models import Q

        user_model = get_user_model()
        # Count both active students and alumni in this batch, case-insensitive
        return user_model.objects.filter(
            batch=obj
        ).filter(
            Q(role__iexact='student') | Q(role__iexact='alumni')
        ).count()

    def _get_alumni_cycle(self, obj):
        active_cycle = obj.alumni_survey_cycles.filter(
            survey_window='2_YEARS',
            status='ACTIVE',
            is_active=True
        ).order_by('-created_at').first()
        if active_cycle:
            return active_cycle
        return obj.alumni_survey_cycles.filter(
            survey_window='2_YEARS',
            is_active=True
        ).order_by('-created_at').first()

    def get_alumni_feedback_cycle_status(self, obj):
        cycle = self._get_alumni_cycle(obj)
        return cycle.status if cycle else None

    def get_alumni_feedback_due_at(self, obj):
        if obj.alumni_feedback_due_at:
            return obj.alumni_feedback_due_at

        cycle = self._get_alumni_cycle(obj)
        return cycle.due_at if cycle else None

    def get_alumni_feedback_response_count(self, obj):
        cycle = self._get_alumni_cycle(obj)
        if not cycle:
            return 0
        submission_count = cycle.submissions.filter(is_active=True).values('student').distinct().count()
        if submission_count:
            return submission_count
        return cycle.responses.filter(is_active=True).values('student').distinct().count()

    def get_alumni_feedback_total_alumni(self, obj):
        from django.contrib.auth import get_user_model
        user_model = get_user_model()
        return user_model.objects.filter(
            batch=obj,
            role__iexact='alumni',
            is_active=True
        ).count()

    def get_alumni_feedback_response_rate(self, obj):
        total = self.get_alumni_feedback_total_alumni(obj)
        if not total:
            return 0
        responses = self.get_alumni_feedback_response_count(obj)
        return round((responses / total) * 100, 2)


class BatchFrameworkSnapshotSerializer(serializers.Serializer):
    """Read-only serializer transforming stored batch JSON snapshots into the flat
    format consumed by the frontend.

    Storage shape (Batch.peo_snapshot / ga_snapshot / vision_mission_snapshot):
      nested dicts with metadata keys like "program_id", "captured_*_count",
      "peos"/"gas"/"vision"/"mission" sub-collections.

    Response shape matches the frontend FrameworkSnapshotResponse interface:
      { batch_id, batch_name, program_id, program_name, snapshot_locked_date,
        is_locked, peo_snapshot: [...], ga_snapshot: [...],
        vision_mission_snapshot: [...] }
    """

    batch_id = serializers.CharField()
    batch_name = serializers.CharField()
    program_id = serializers.CharField()
    program_name = serializers.CharField()
    program = serializers.CharField()
    status = serializers.CharField()
    snapshot_locked_date = serializers.DateTimeField(allow_null=True)
    is_locked = serializers.BooleanField()
    peo_snapshot = serializers.ListField()
    ga_snapshot = serializers.ListField()
    vision_mission_snapshot = serializers.ListField()
    ga_peo_mappings = serializers.ListField()
    po_keyword_mappings = serializers.ListField()
    vision_mission_mappings = serializers.ListField()
    snapshot_empty_fields = serializers.DictField()

    def _text_value(self, value):
        if isinstance(value, dict):
            return value.get("text") or value.get("label") or value.get("name") or ""
        return value or ""

    def _mapping_text(self, mapping, *keys):
        for key in keys:
            value = self._text_value(mapping.get(key))
            if value:
                return value
        return None

    @staticmethod
    def is_snapshot_empty(value, field_name):
        if not value:
            return True
        if not isinstance(value, dict):
            return False
        if field_name == "ga":
            return not bool(value.get("gas"))
        if field_name == "peo":
            return not bool(value.get("peos"))
        if field_name == "vision_mission":
            vision = value.get("vision") or {}
            mission = value.get("mission") or {}
            has_vision = bool(vision.get("vision_text") or vision.get("keywords"))
            has_mission = bool(mission.get("mission_text") or mission.get("keywords"))
            return not (has_vision or has_mission)
        return not bool(value)

    def to_representation(self, batch):
        stored_peo = batch.peo_snapshot or {}
        stored_ga = batch.ga_snapshot or {}
        stored_vm = batch.vision_mission_snapshot or {}

        raw_peos = stored_peo.get("peos", []) if isinstance(stored_peo, dict) else []
        peo_snapshot = [
            {
                "id": str(po.get("id")),
                "order_number": int(po.get("order_number", 0)),
                "title": po.get("title") or None,
                "description": po.get("description", ""),
                "kpi_threshold": float(po.get("kpi_threshold") or 0),
                "is_active": bool(po.get("is_active", True)),
                "ga_mappings": po.get("ga_mappings", []) or [],
                "keyword_mappings": po.get("keyword_mappings", []) or [],
            }
            for po in raw_peos
        ]

        raw_gas = stored_ga.get("gas", []) if isinstance(stored_ga, dict) else []
        ga_snapshot = [
            {
                "id": str(ga.get("id")),
                "order_number": int(ga.get("order_number", 0)),
                "code": ga.get("code") or f"GA-{ga.get('order_number', 0)}",
                "title": ga.get("title", ""),
                "description": ga.get("description", ""),
                "kpi_threshold": float(ga.get("kpi_threshold") or 0),
                "is_active": bool(ga.get("is_active", True)),
            }
            for ga in raw_gas
        ]

        if not ga_snapshot and raw_peos:
            ga_ids = {
                str(mapping.get("ga_id"))
                for po in raw_peos
                for mapping in (po.get("ga_mappings", []) or [])
                if mapping.get("ga_id")
            }
            live_ga_by_id = {}
            if ga_ids:
                try:
                    from obe.models import GA

                    live_ga_by_id = {
                        str(ga.id): ga
                        for ga in GA.objects.filter(id__in=ga_ids, program=batch.program, is_active=True)
                    }
                except Exception:
                    live_ga_by_id = {}

            seen_ga_ids = set()
            for po in raw_peos:
                for mapping in po.get("ga_mappings", []) or []:
                    ga_id = str(mapping.get("ga_id") or "")
                    if not ga_id or ga_id in seen_ga_ids:
                        continue
                    seen_ga_ids.add(ga_id)
                    live_ga = live_ga_by_id.get(ga_id)
                    raw_code = mapping.get("ga_code") or ""
                    order_number = getattr(live_ga, "order_number", None)
                    if order_number is None and raw_code.upper().startswith("GA-"):
                        try:
                            order_number = int(raw_code.split("-", 1)[1])
                        except (TypeError, ValueError, IndexError):
                            order_number = 0
                    ga_snapshot.append({
                        "id": ga_id,
                        "order_number": int(order_number or 0),
                        "code": raw_code or f"GA-{order_number or ''}".strip(),
                        "title": getattr(live_ga, "title", "") if live_ga else "",
                        "description": getattr(live_ga, "description", "") if live_ga else "",
                        "kpi_threshold": float(getattr(live_ga, "kpi_threshold", 0) or 0),
                        "is_active": True,
                    })

        vision = stored_vm.get("vision", {}) if isinstance(stored_vm, dict) else {}
        mission = stored_vm.get("mission", {}) if isinstance(stored_vm, dict) else {}
        vision_mission_snapshot = []
        if vision:
            vision_mission_snapshot.append({
                "id": vision.get("id"),
                "statement_type": "VISION",
                "statement": vision.get("vision_text", ""),
                "keywords": vision.get("keywords", []) or [],
            })
        if mission:
            vision_mission_snapshot.append({
                "id": mission.get("id"),
                "statement_type": "MISSION",
                "statement": mission.get("mission_text", ""),
                "keywords": mission.get("keywords", []) or [],
            })

        peo_by_id = {po.get("id"): po for po in peo_snapshot}
        ga_by_id = {ga.get("id"): ga for ga in ga_snapshot}
        ga_peo_mappings = []
        po_keyword_mappings = []
        for po in peo_snapshot:
            po_label = f"PO-{po.get('order_number', 0)}"
            for mapping in po.get("ga_mappings", []) or []:
                ga = ga_by_id.get(str(mapping.get("ga_id")))
                ga_peo_mappings.append({
                    "id": mapping.get("mapping_id"),
                    "po_id": po.get("id"),
                    "po_code": po_label,
                    "po_title": po.get("title"),
                    "ga_id": mapping.get("ga_id"),
                    "ga_code": mapping.get("ga_code") or (ga.get("code") if ga else ""),
                    "ga_title": ga.get("title") if ga else "",
                    "weight": mapping.get("weight"),
                })
            for mapping in po.get("keyword_mappings", []) or []:
                po_keyword_mappings.append({
                    "id": mapping.get("mapping_id"),
                    "po_id": mapping.get("peo_id") or po.get("id"),
                    "po_code": po_label,
                    "po_title": po.get("title"),
                    "mission_keyword": self._mapping_text(mapping, "mission_keyword", "mission_keyword_text"),
                    "vision_keyword": self._mapping_text(mapping, "vision_keyword", "vision_keyword_text"),
                })

        raw_vision_mission_mappings = []
        vision_mission_mappings = [
            {
                "mapping_id": mapping.get("mapping_id") or mapping.get("id"),
                "mission_keyword_id": mapping.get("mission_keyword_id") or mapping.get("mission_keyword"),
                "mission_keyword": self._mapping_text(mapping, "mission_keyword_text", "mission_keyword"),
                "vision_keyword_id": mapping.get("vision_keyword_id") or mapping.get("vision_keyword"),
                "vision_keyword": self._mapping_text(mapping, "vision_keyword_text", "vision_keyword"),
            }
            for mapping in raw_vision_mission_mappings
        ]

        empty_fields = {
            "ga": self.is_snapshot_empty(batch.ga_snapshot, "ga"),
            "peo": self.is_snapshot_empty(batch.peo_snapshot, "peo"),
            "vision_mission": self.is_snapshot_empty(batch.vision_mission_snapshot, "vision_mission"),
        }
        has_data = bool(peo_snapshot or ga_snapshot or vision_mission_snapshot)

        return {
            "batch_id": str(batch.id),
            "batch_name": batch.name,
            "program_id": str(batch.program_id),
            "program_name": getattr(batch.program, "name", ""),
            "program": getattr(batch.program, "name", ""),
            "status": batch.status,
            "snapshot_locked_date": batch.created_at,
            "is_locked": has_data,
            "peo_snapshot": peo_snapshot,
            "ga_snapshot": ga_snapshot,
            "vision_mission_snapshot": vision_mission_snapshot,
            "ga_peo_mappings": ga_peo_mappings,
            "po_keyword_mappings": po_keyword_mappings,
            "vision_mission_mappings": vision_mission_mappings,
            "snapshot_empty_fields": empty_fields,
        }


class BatchFrameworkSnapshotCopySerializer(serializers.Serializer):
    fields = serializers.ListField(
        child=serializers.ChoiceField(choices=("ga", "peo", "vision_mission")),
        allow_empty=False,
    )

    def validate_fields(self, value):
        seen = []
        for field in value:
            if field not in seen:
                seen.append(field)
        return seen


class DossierListSerializer(serializers.Serializer):
    """Lightweight batch listing for the HOD Batch Dossier Vault UI."""

    id = serializers.CharField()
    name = serializers.CharField()
    program_id = serializers.CharField()
    program_name = serializers.CharField()
    start_year = serializers.IntegerField()
    end_year = serializers.IntegerField()
    status = serializers.CharField()
    is_active = serializers.BooleanField()
    current_semester = serializers.IntegerField(allow_null=True)
    has_snapshot = serializers.BooleanField()
    snapshot_locked_date = serializers.DateTimeField(allow_null=True)

    def to_representation(self, batch):
        stored_peo = batch.peo_snapshot or {}
        stored_ga = batch.ga_snapshot or {}
        stored_vm = batch.vision_mission_snapshot or {}
        has_peo = bool(stored_peo.get("peos")) if isinstance(stored_peo, dict) else bool(stored_peo)
        has_ga = bool(stored_ga.get("gas")) if isinstance(stored_ga, dict) else bool(stored_ga)
        has_vm = bool(stored_vm)
        return {
            "id": str(batch.id),
            "name": batch.name,
            "program_id": str(batch.program_id),
            "program_name": getattr(batch.program, "name", ""),
            "start_year": batch.start_year,
            "end_year": batch.end_year,
            "status": batch.status,
            "is_active": bool(batch.is_active),
            "current_semester": batch.current_semester,
            "has_snapshot": has_peo or has_ga or has_vm,
            "snapshot_locked_date": batch.created_at if (has_peo or has_ga or has_vm) else None,
        }


class BatchStructureSerializer(BatchFrameworkSnapshotSerializer):
    """Shared read-only batch structure response for HOD and Coordinator views."""

    courses = serializers.ListField()

    def _get_courses(self, batch):
        from collections import defaultdict

        from django.db.models import Prefetch

        from obe.models import CLO, CLOGAMapping, CourseSession

        semester_number = self.context.get("semester")
        sessions = (
            CourseSession.objects
            .filter(batch=batch, is_active=True)
            .select_related("course", "semester")
            .order_by("semester__number", "course__code", "course__name")
        )
        if semester_number is not None:
            sessions = sessions.filter(semester__number=semester_number)

        sessions = list(sessions)
        course_ids = [session.course_id for session in sessions if session.course_id]
        version_id = getattr(batch, "curriculum_version_id", None)

        clos = CLO.objects.filter(
            course_id__in=course_ids,
            is_active=True,
        ).order_by("course_id", "order_number")
        if version_id:
            clos = clos.filter(curriculum_version_id=version_id)
        else:
            clos = clos.filter(curriculum_version__isnull=True)

        mapping_qs = (
            CLOGAMapping.objects
            .filter(is_active=True)
            .select_related("ga")
            .order_by("ga__order_number")
        )
        clos = clos.prefetch_related(Prefetch("ga_mappings", queryset=mapping_qs))

        clos_by_course = defaultdict(list)
        for clo in clos:
            clos_by_course[str(clo.course_id)].append(clo)

        course_rows = []
        seen_courses = set()
        for session in sessions:
            course = session.course
            if not course or str(course.id) in seen_courses:
                continue
            seen_courses.add(str(course.id))
            course_rows.append({
                "course_id": str(course.id),
                "course_name": course.name,
                "course_code": course.code,
                "semester_number": getattr(session.semester, "number", None),
                "clos": [
                    {
                        "clo_id": str(clo.id),
                        "clo_number": f"CLO-{clo.order_number}",
                        "title": clo.title or clo.description or "",
                        "mapped_gas": [
                            {
                                "ga_id": str(mapping.ga_id),
                                "ga_title": getattr(mapping.ga, "title", ""),
                                "ga_code": getattr(mapping.ga, "code", None) or f"GA-{getattr(mapping.ga, 'order_number', '')}",
                            }
                            for mapping in clo.ga_mappings.all()
                            if mapping.ga_id
                        ],
                    }
                    for clo in clos_by_course.get(str(course.id), [])
                ],
            })

        return course_rows

    def to_representation(self, batch):
        data = super().to_representation(batch)
        return {
            "batch_id": data["batch_id"],
            "batch_name": data["batch_name"],
            "snapshot_locked_date": data["snapshot_locked_date"],
            "ga_peo_mappings": data["ga_peo_mappings"],
            "ga_snapshot": data["ga_snapshot"],
            "peo_snapshot": data["peo_snapshot"],
            "vision_mission_snapshot": data["vision_mission_snapshot"],
            "po_keyword_mappings": data["po_keyword_mappings"],
            "vision_mission_mappings": data["vision_mission_mappings"],
            "snapshot_empty_fields": data["snapshot_empty_fields"],
            "courses": self._get_courses(batch),
        }
