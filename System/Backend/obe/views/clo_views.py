from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from django.db import transaction, IntegrityError

from curriculum.models import CurriculumVersion
from ..models import CLO, CLOGAMapping, GA
from ..serializers import CLOSerializer, CLOGAMappingSerializer, GASerializer

from decimal import Decimal, InvalidOperation
from uuid import UUID


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def _resolve_curriculum_mode(batch, version):
    """
    Resolve the curriculum mode for the selected batch.

    Priority:
        1. Batch-level curriculum_mode
        2. Batch-level legacy/alternate mode fields
        3. Version-level curriculum_mode

    The fallback to the version-level mode is important because
    older data may have stored the mode on CurriculumVersion rather
    than on Batch. The selected batch is still validated separately.
    """

    candidates = [
        getattr(batch, "curriculum_mode", None),
        getattr(batch, "curriculumMode", None),
        getattr(batch, "mode", None),
        getattr(batch, "curriculum_mode_choice", None),
    ]

    curriculum_obj = getattr(batch, "curriculum", None)

    if curriculum_obj is not None:
        candidates.extend([
            getattr(curriculum_obj, "curriculum_mode", None),
            getattr(curriculum_obj, "mode", None),
        ])

    # Fallback to version-level mode.
    candidates.append(
        getattr(version, "curriculum_mode", None)
    )

    for value in candidates:
        if value is None:
            continue

        normalized = str(value).strip().lower()

        if normalized in ("progressive", "complete"):
            return normalized

    return None


def get_batch_for_version(request, version):
    """
    Resolve the batch context for a finalized curriculum version.

    The supplied batch_id must point to a batch assigned to this
    curriculum version.
    """

    batch_id = request.data.get("batch_id")

    if not batch_id:
        return None, Response(
            {
                "error": (
                    "batch_id is required when editing a finalized "
                    "curriculum version."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        # Preferred/current relation.
        batch = version.assigned_batches.filter(
            id=batch_id
        ).first()
    except Exception as e:
        batch = None

        # Legacy fallback, if the project still has a singular
        # batch relation on CurriculumVersion.
        try:
            if (
                getattr(version, "batch_id", None)
                and str(version.batch_id) == str(batch_id)
            ):
                batch = version.batch
        except Exception:
            pass

        if batch is None:
            return None, Response(
                {
                    "error": "Unable to resolve assigned batch.",
                    "detail": str(e),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    if not batch:
        return None, Response(
            {
                "error": (
                    "Batch is not assigned to this curriculum version."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Safety validation: selected batch must belong to the same
    # program as the selected curriculum version.
    batch_program_id = getattr(batch, "program_id", None)

    if (
        batch_program_id is not None
        and str(batch_program_id) != str(version.program_id)
    ):
        return None, Response(
            {
                "error": (
                    "Batch program must match curriculum version "
                    "program."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    return batch, None


def validate_finalized_semester_edit(request, version, course_id):
    """
    Validate whether a CLO belonging to a finalized version can
    be modified for the SELECTED batch.

    Rules:

    DRAFT:
        Always editable.

    COMPLETE:
        Fully locked after finalization.

    PROGRESSIVE:
        Only the selected batch's current semester is editable.

        Example:
            current_semester = 2

            Semester 1 -> LOCKED
            Semester 2 -> EDITABLE
            Semester 3 -> LOCKED
            Semester 4 -> LOCKED
    """

    # Draft versions remain editable without batch context.
    if version.status == "draft":
        return None, None

    # --------------------------------------------------------
    # Get selected batch
    # --------------------------------------------------------

    batch, error_response = get_batch_for_version(
        request,
        version,
    )

    if error_response:
        return None, error_response

    # --------------------------------------------------------
    # Resolve mode
    # --------------------------------------------------------

    curriculum_mode = _resolve_curriculum_mode(
        batch,
        version,
    )

    if curriculum_mode is None:
        return None, Response(
            {
                "error": (
                    "Curriculum mode is not configured for "
                    "the selected batch."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # --------------------------------------------------------
    # COMPLETE MODE
    # --------------------------------------------------------

    if curriculum_mode == "complete":
        return None, Response(
            {
                "error": (
                    "This curriculum is in Complete mode and is "
                    "fully locked after finalization."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # --------------------------------------------------------
    # PROGRESSIVE MODE
    # --------------------------------------------------------

    course_in_version = version.version_courses.filter(
        course_id=course_id,
        is_active=True,
    ).first()

    if not course_in_version:
        return None, Response(
            {
                "error": (
                    "This course is not assigned to the "
                    "selected curriculum version."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    course_semester = getattr(
        course_in_version,
        "semester_no",
        None,
    )

    if course_semester is None:
        return None, Response(
            {
                "error": (
                    "Course semester could not be determined."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    current_semester = getattr(
        batch,
        "current_semester",
        None,
    )

    if current_semester is None:
        # Preserve the project's existing safe default for
        # newly configured progressive batches.
        current_semester = 1

    try:
        course_semester = int(course_semester)
        current_semester = int(current_semester)
    except (TypeError, ValueError):
        return None, Response(
            {
                "error": (
                    "Invalid semester information for the "
                    "selected batch/course."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # --------------------------------------------------------
    # ONLY CURRENT SEMESTER IS EDITABLE
    # --------------------------------------------------------

    if course_semester != current_semester:
        return None, Response(
            {
                "error": (
                    f"Semester {course_semester} is locked. "
                    f"Only Semester {current_semester} "
                    "is currently editable."
                ),
                "course_semester": course_semester,
                "current_semester": current_semester,
                "curriculum_mode": "progressive",
                "batch_id": str(batch.id),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    return batch, None


# ============================================================
# 1. CLO LIST / CREATE
# ============================================================

class CLOListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    # --------------------------------------------------------
    # GET CLOs
    # --------------------------------------------------------

    def get(self, request, course_id, version_id):

        clos = CLO.objects.filter(
            course_id=course_id,
            curriculum_version_id=version_id,
            is_active=True
        )

        serializer = CLOSerializer(
            clos,
            many=True
        )

        return Response(serializer.data)

    # --------------------------------------------------------
    # CREATE CLO
    # --------------------------------------------------------

    def post(self, request, course_id, version_id):

        # ----------------------------------------------------
        # Get curriculum version
        # ----------------------------------------------------

        try:
            version = CurriculumVersion.objects.get(
                id=version_id
            )

        except CurriculumVersion.DoesNotExist:

            return Response(
                {
                    "error": "Version not found"
                },
                status=status.HTTP_404_NOT_FOUND
            )

        # ----------------------------------------------------
        # Validate edit permission
        # ----------------------------------------------------

        _, error_response = validate_finalized_semester_edit(
            request,
            version,
            course_id
        )

        if error_response:
            return error_response

        # ----------------------------------------------------
        # Prepare CLO data
        # ----------------------------------------------------

        data = request.data.copy()

        data["course"] = course_id
        data["curriculum_version"] = version_id

        # batch_id is only used for permission/context.
        # Do not send it to CLO serializer unless the model
        # actually contains such a field.
        data.pop("batch_id", None)

        serializer = CLOSerializer(
            data=data
        )

        if serializer.is_valid():

            serializer.save()

            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


# ============================================================
# 2. CLO DETAIL
# ============================================================

class CLODetailView(APIView):
    permission_classes = [IsAuthenticated]

    # --------------------------------------------------------
    # GET OBJECT
    # --------------------------------------------------------

    def get_object(self, pk):

        try:

            return CLO.objects.get(
                pk=pk,
                is_active=True
            )

        except CLO.DoesNotExist:

            return None

    # --------------------------------------------------------
    # UPDATE CLO
    # --------------------------------------------------------

    def patch(self, request, pk):

        clo = self.get_object(pk)

        if not clo:

            return Response(
                {
                    "error": "Not found"
                },
                status=status.HTTP_404_NOT_FOUND
            )

        # ----------------------------------------------------
        # Check curriculum version
        # ----------------------------------------------------

        version = clo.curriculum_version

        if version:

            _, error_response = validate_finalized_semester_edit(
                request,
                version,
                clo.course_id
            )

            if error_response:
                return error_response

        # ----------------------------------------------------
        # Update CLO
        # ----------------------------------------------------

        data = request.data.copy()

        # batch_id is permission/context only
        data.pop("batch_id", None)

        serializer = CLOSerializer(
            clo,
            data=data,
            partial=True
        )

        if serializer.is_valid():

            serializer.save()

            return Response(
                serializer.data
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    # --------------------------------------------------------
    # DELETE CLO
    # --------------------------------------------------------

    def delete(self, request, pk):

        clo = self.get_object(pk)

        if not clo:

            return Response(
                {
                    "error": "Not found"
                },
                status=status.HTTP_404_NOT_FOUND
            )

        # ----------------------------------------------------
        # Check curriculum version
        # ----------------------------------------------------

        version = clo.curriculum_version

        if version:

            _, error_response = validate_finalized_semester_edit(
                request,
                version,
                clo.course_id
            )

            if error_response:
                return error_response

        # ----------------------------------------------------
        # Soft delete
        # ----------------------------------------------------

        clo.is_active = False

        clo.save()

        return Response(
            {
                "success": True
            }
        )


# ============================================================
# 3. COPY CLOs
# ============================================================

class CLOCopyView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(
        self,
        request,
        course_id,
        version_id
    ):

        # ----------------------------------------------------
        # Target version
        # ----------------------------------------------------

        try:

            target_version = CurriculumVersion.objects.get(
                id=version_id
            )

        except CurriculumVersion.DoesNotExist:

            return Response(
                {
                    "error": "Target version not found"
                },
                status=status.HTTP_404_NOT_FOUND
            )

        # ----------------------------------------------------
        # Copy is currently allowed only to draft versions.
        #
        # Progressive finalized versions should normally use
        # the normal CLO create flow instead of copying.
        # ----------------------------------------------------

        if target_version.status != "draft":

            return Response(
                {
                    "error": (
                        "CLOs can only be copied to a draft "
                        "curriculum version."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ----------------------------------------------------
        # Source version
        # ----------------------------------------------------

        source_version_id = request.data.get(
            "source_version_id"
        )

        if not source_version_id:

            return Response(
                {
                    "error": "source_version_id required"
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ----------------------------------------------------
        # Source CLOs
        # ----------------------------------------------------

        source_clos = CLO.objects.filter(
            course_id=course_id,
            curriculum_version_id=source_version_id,
            is_active=True
        )

        if not source_clos.exists():

            return Response(
                {
                    "error": "No CLOs found in source version"
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ----------------------------------------------------
        # Copy
        # ----------------------------------------------------

        new_clos = []

        for s_clo in source_clos:

            new_clo = CLO.objects.create(
                course_id=course_id,
                curriculum_version_id=version_id,
                title=s_clo.title,
                description=s_clo.description,
                order_number=s_clo.order_number,
                bloom_level=s_clo.bloom_level,
                kpi_target=s_clo.kpi_target
            )

            new_clos.append(new_clo)

        return Response(
            CLOSerializer(
                new_clos,
                many=True
            ).data,
            status=status.HTTP_201_CREATED
        )


# ============================================================
# 4. CLO-GA MATRIX
# ============================================================

class CLOGAMatrixView(APIView):
    permission_classes = [IsAuthenticated]

    # --------------------------------------------------------
    # GET MATRIX
    # --------------------------------------------------------

    def get(
        self,
        request,
        course_id,
        version_id
    ):

        clos = CLO.objects.filter(
            course_id=course_id,
            curriculum_version_id=version_id,
            is_active=True
        )

        gas = GA.objects.filter(
            program__courses__id=course_id,
            is_active=True
        ).distinct()

        mappings = CLOGAMapping.objects.filter(
            clo__course_id=course_id,
            clo__curriculum_version_id=version_id,
            is_active=True
        )

        return Response(
            {
                "clos": CLOSerializer(
                    clos,
                    many=True
                ).data,

                "gas": GASerializer(
                    gas,
                    many=True
                ).data,

                "mappings": CLOGAMappingSerializer(
                    mappings,
                    many=True
                ).data
            }
        )

    # --------------------------------------------------------
    # SAVE MATRIX
    # --------------------------------------------------------

    @transaction.atomic
    def post(
        self,
        request,
        course_id,
        version_id
    ):

        # ----------------------------------------------------
        # Get version
        # ----------------------------------------------------

        try:

            version = CurriculumVersion.objects.get(
                id=version_id
            )

        except CurriculumVersion.DoesNotExist:

            return Response(
                {
                    "error": "Version not found"
                },
                status=status.HTTP_404_NOT_FOUND
            )

        # ----------------------------------------------------
        # Validate edit permission
        # ----------------------------------------------------

        _, error_response = validate_finalized_semester_edit(
            request,
            version,
            course_id
        )

        if error_response:
            return error_response

        # ----------------------------------------------------
        # Mappings
        # ----------------------------------------------------

        mappings_data = request.data.get(
            "mappings",
            []
        )

        if not isinstance(mappings_data, list):

            return Response(
                {
                    "error": "`mappings` must be a list"
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ====================================================
        # Normalize IDs
        # ====================================================

        def _norm_id(x):

            if x is None:
                return None

            if isinstance(x, UUID):
                return str(x)

            s = str(x).strip()

            if not s:
                return None

            try:
                return str(UUID(s))

            except Exception:
                return s

        # ====================================================
        # Load CLOs
        # ====================================================

        clos_qs = CLO.objects.filter(
            course_id=course_id,
            curriculum_version_id=version_id,
            is_active=True
        )

        clos_by_id = {}

        for c in clos_qs:

            clos_by_id[str(c.id)] = c

        if not clos_by_id:

            return Response(
                {
                    "error": (
                        "This course & version has no CLOs "
                        "defined yet. Add CLOs first before mapping."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ====================================================
        # CLO label helper
        # ====================================================

        def _clo_label(cid):

            c = clos_by_id.get(
                _norm_id(cid)
            )

            if c:
                return f"CLO-{c.order_number}"

            return f"CLO id={cid}"

        # ====================================================
        # Validate mappings
        # ====================================================

        grouped_weights = {}

        duplicates = set()

        seen_pairs = set()

        unknown_clos = []

        invalid_weights = []

        out_of_range = []

        missing_field_idx = []

        # ----------------------------------------------------
        # Read each mapping
        # ----------------------------------------------------

        for idx, m in enumerate(mappings_data):

            clo_raw = (
                m.get("clo_id")
                if m.get("clo_id") is not None
                else m.get("clo")
            )

            ga_raw = (
                m.get("ga_id")
                if m.get("ga_id") is not None
                else m.get("ga")
            )

            clo_id = _norm_id(clo_raw)
            ga_id = _norm_id(ga_raw)

            if clo_id is None or ga_id is None:

                missing_field_idx.append(
                    str(idx)
                )

                continue

            # ------------------------------------------------
            # Weight
            # ------------------------------------------------

            try:

                w_raw = m.get(
                    "weight",
                    m.get(
                        "weightage",
                        0
                    )
                )

                weight = Decimal(
                    str(w_raw)
                )

            except (
                InvalidOperation,
                TypeError,
                ValueError
            ):

                invalid_weights.append(
                    f"{_clo_label(clo_id)} -> "
                    f"GA {ga_id} (value={w_raw!r})"
                )

                continue

            # ------------------------------------------------
            # Range
            # ------------------------------------------------

            if (
                weight < 0
                or weight > Decimal("1.00")
            ):

                out_of_range.append(
                    f"{_clo_label(clo_id)} -> "
                    f"GA {ga_id} = {weight}"
                )

                continue

            # ------------------------------------------------
            # Zero weights
            # ------------------------------------------------

            if weight == 0:
                continue

            # ------------------------------------------------
            # CLO belongs to this course/version
            # ------------------------------------------------

            if clo_id not in clos_by_id:

                unknown_clos.append(
                    _clo_label(clo_id)
                )

                continue

            # ------------------------------------------------
            # Duplicate pair
            # ------------------------------------------------

            pair = (
                clo_id,
                ga_id
            )

            if pair in seen_pairs:

                duplicates.add(pair)

            seen_pairs.add(pair)

            # ------------------------------------------------
            # Group weights
            # ------------------------------------------------

            grouped_weights.setdefault(
                clo_id,
                {
                    "total": Decimal("0"),
                    "gas": []
                }
            )

            grouped_weights[clo_id]["gas"].append(
                ga_id
            )

            grouped_weights[clo_id]["total"] += weight

        # ====================================================
        # Validation errors
        # ====================================================

        errors = []

        # ----------------------------------------------------
        # Missing fields
        # ----------------------------------------------------

        if missing_field_idx:

            errors.append(
                "Following mappings are missing "
                "clo_id or ga_id (indexes): "
                + ", ".join(missing_field_idx)
            )

        # ----------------------------------------------------
        # Invalid weights
        # ----------------------------------------------------

        if invalid_weights:

            errors.append(
                "Invalid weight values: "
                + "; ".join(invalid_weights)
            )

        # ----------------------------------------------------
        # Out of range
        # ----------------------------------------------------

        if out_of_range:

            errors.append(
                "Weight must be between 0.00 and 1.00. "
                "Invalid entries: "
                + "; ".join(out_of_range)
            )

        # ----------------------------------------------------
        # Unknown CLOs
        # ----------------------------------------------------

        if unknown_clos:

            errors.append(
                "Following CLOs do not belong to this "
                "course & version: "
                + ", ".join(
                    sorted(
                        set(unknown_clos)
                    )
                )
            )

        # ----------------------------------------------------
        # Duplicate pairs
        # ----------------------------------------------------

        if duplicates:

            dup_parts = [
                f"{_clo_label(c)}/GA={g}"
                for c, g in duplicates
            ]

            errors.append(
                "Duplicate CLO-GA pairs in request: "
                + "; ".join(dup_parts)
            )

        # ====================================================
        # One CLO = EXACTLY one GA
        # ====================================================

        multi_gas_rows = []

        for clo_id, info in grouped_weights.items():

            if len(info["gas"]) > 1:

                multi_gas_rows.append(
                    _clo_label(clo_id)
                )

        if multi_gas_rows:

            errors.append(
                "Select only one GA for mapping. "
                "Following CLOs have more than one "
                "GA selected: "
                + ", ".join(
                    sorted(
                        set(multi_gas_rows)
                    )
                )
            )

        # ====================================================
        # Missing CLO selections
        # ====================================================

        all_clo_ids = set(
            clos_by_id.keys()
        )

        selected_clo_ids = set(
            grouped_weights.keys()
        )

        missing_clo_ids = (
            all_clo_ids
            - selected_clo_ids
        )

        if missing_clo_ids:

            names = [
                f"CLO-{clos_by_id[cid].order_number}"
                for cid in sorted(
                    missing_clo_ids,
                    key=lambda x:
                        clos_by_id[x].order_number
                )
            ]

            errors.append(
                "Following CLOs have no GA selected: "
                + ", ".join(names)
                + ". Each CLO must map to exactly one GA."
            )

        # ====================================================
        # Row sum must equal 1.00
        # ====================================================

        bad_rows = []

        for clo_id, info in grouped_weights.items():

            total = info["total"]

            if abs(
                float(total) - 1.0
            ) > 0.0001:

                clo = clos_by_id.get(
                    clo_id
                )

                if clo:

                    label = (
                        f"CLO-{clo.order_number} "
                        f"(current sum = "
                        f"{float(total):.2f}, "
                        f"expected 1.00)"
                    )

                else:

                    label = (
                        f"CLO id={clo_id} "
                        f"(sum={float(total):.2f})"
                    )

                bad_rows.append(
                    label
                )

        if bad_rows:

            errors.append(
                "Each CLO row must have weights "
                "that sum to exactly 1.00. "
                "Invalid rows: "
                + "; ".join(bad_rows)
            )

        # ====================================================
        # Return validation errors
        # ====================================================

        if errors:

            return Response(
                {
                    "error": " | ".join(errors)
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ====================================================
        # SAVE MAPPINGS
        # ====================================================

        try:

            with transaction.atomic():

                # ------------------------------------------------
                # Remove old mappings
                # ------------------------------------------------

                CLOGAMapping.objects.filter(
                    clo__course_id=course_id,
                    clo__curriculum_version_id=version_id
                ).delete()

                # ------------------------------------------------
                # Create new mappings
                # ------------------------------------------------

                created = []

                for m in mappings_data:

                    clo_id = _norm_id(
                        m.get("clo_id")
                        if m.get("clo_id") is not None
                        else m.get("clo")
                    )

                    ga_id = _norm_id(
                        m.get("ga_id")
                        if m.get("ga_id") is not None
                        else m.get("ga")
                    )

                    if (
                        clo_id is None
                        or ga_id is None
                    ):
                        continue

                    try:

                        w_raw = m.get(
                            "weight",
                            m.get(
                                "weightage",
                                0
                            )
                        )

                        weight = Decimal(
                            str(w_raw)
                        )

                    except (
                        InvalidOperation,
                        TypeError,
                        ValueError
                    ):

                        weight = Decimal("0")

                    if weight <= 0:
                        continue

                    mapping = CLOGAMapping.objects.create(
                        clo_id=clo_id,
                        ga_id=ga_id,
                        weight=weight
                    )

                    created.append(
                        mapping
                    )

            return Response(
                CLOGAMappingSerializer(
                    created,
                    many=True
                ).data,
                status=status.HTTP_201_CREATED
            )

        except IntegrityError as e:

            msg = str(e)
            lower = msg.lower()

            if (
                "unique" in lower
                and (
                    "clo" in lower
                    or "ga" in lower
                )
            ):

                detail = (
                    "Same CLO-GA combination already exists "
                    "after save (unique constraint). "
                    "Please refresh the page and try again."
                )

            else:

                detail = (
                    "Database integrity error while saving mappings."
                )

            return Response(
                {
                    "error": (
                        "Failed to save mappings due to "
                        "database conflict."
                    ),
                    "detail": detail
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        except Exception as e:

            return Response(
                {
                    "error": (
                        "Unexpected server error while saving mappings."
                    ),
                    "detail": str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ============================================================
# 5. COURSE CLO-GA MATRIX
# ============================================================

class CourseCLOGAMatrixView(APIView):
    permission_classes = [IsAuthenticated]

    def get(
        self,
        request,
        course_id
    ):

        # ----------------------------------------------------
        # Get course
        # ----------------------------------------------------

        from core.models import Course

        try:

            course = Course.objects.get(
                id=course_id,
                is_active=True
            )

        except Course.DoesNotExist:

            return Response(
                {
                    "error": "Course not found"
                },
                status=status.HTTP_404_NOT_FOUND
            )

        # ----------------------------------------------------
        # CLOs
        # ----------------------------------------------------

        clos = CLO.objects.filter(
            course=course,
            is_active=True
        )

        # ----------------------------------------------------
        # GAs
        # ----------------------------------------------------

        gas = GA.objects.filter(
            program=course.program,
            is_active=True
        )

        # ----------------------------------------------------
        # Mappings
        # ----------------------------------------------------

        mappings = CLOGAMapping.objects.filter(
            clo__course=course,
            is_active=True
        )

        return Response(
            {
                "clos": CLOSerializer(
                    clos,
                    many=True
                ).data,

                "gas": GASerializer(
                    gas,
                    many=True
                ).data,

                "mappings": CLOGAMappingSerializer(
                    mappings,
                    many=True
                ).data
            }
        )