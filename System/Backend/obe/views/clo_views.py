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


class CLOListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id, version_id):
        clos = CLO.objects.filter(
            course_id=course_id,
            curriculum_version_id=version_id,
            is_active=True
        )
        serializer = CLOSerializer(clos, many=True)
        return Response(serializer.data)

    def post(self, request, course_id, version_id):
        # Check if version is editable
        try:
            version = CurriculumVersion.objects.get(id=version_id)
            if version.status != 'draft':
                if version.batch and version.batch.current_semester:
                    # Get the semester number for this course in this version
                    course_in_version = version.version_courses.filter(course_id=course_id).first()
                    if course_in_version and course_in_version.semester_no <= version.batch.current_semester:
                        return Response({'error': 'Cannot add/update CLOs for current or past semesters in a finalized version'}, status=status.HTTP_400_BAD_REQUEST)
        except CurriculumVersion.DoesNotExist:
            return Response({'error': 'Version not found'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data.copy()
        data['course'] = course_id
        data['curriculum_version'] = version_id
        serializer = CLOSerializer(data=data)
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


class CLODetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return CLO.objects.get(
                pk=pk, is_active=True
            )
        except CLO.DoesNotExist:
            return None

    def patch(self, request, pk):
        clo = self.get_object(pk)
        if not clo:
            return Response(
                {'error': 'Not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if version is editable
        if clo.curriculum_version and clo.curriculum_version.status != 'draft':
            version = clo.curriculum_version
            if version.batch and version.batch.current_semester:
                course_in_version = version.version_courses.filter(course_id=clo.course_id).first()
                if course_in_version and course_in_version.semester_no <= version.batch.current_semester:
                    return Response({'error': 'Cannot update CLOs for current or past semesters in a finalized version'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = CLOSerializer(
            clo, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    def delete(self, request, pk):
        clo = self.get_object(pk)
        if not clo:
            return Response(
                {'error': 'Not found'},
                status=status.HTTP_404_NOT_FOUND
            )
            
        # Check if version is editable
        if clo.curriculum_version and clo.curriculum_version.status != 'draft':
            version = clo.curriculum_version
            if version.batch and version.batch.current_semester:
                course_in_version = version.version_courses.filter(course_id=clo.course_id).first()
                if course_in_version and course_in_version.semester_no <= version.batch.current_semester:
                    return Response({'error': 'Cannot delete CLOs for current or past semesters in a finalized version'}, status=status.HTTP_400_BAD_REQUEST)

        clo.is_active = False
        clo.save()
        return Response({'success': True})


class CLOCopyView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(
        self, request, course_id, version_id
    ):
        # Check if target version is editable
        try:
            target_version = CurriculumVersion.objects.get(id=version_id)
            if target_version.status != 'draft':
                return Response({'error': 'Cannot copy CLOs to a finalized version'}, status=status.HTTP_400_BAD_REQUEST)
        except CurriculumVersion.DoesNotExist:
            return Response({'error': 'Target version not found'}, status=status.HTTP_404_NOT_FOUND)

        source_version_id = request.data.get(
            'source_version_id'
        )
        if not source_version_id:
            return Response(
                {'error': 'source_version_id required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        source_clos = CLO.objects.filter(
            course_id=course_id,
            curriculum_version_id=source_version_id,
            is_active=True
        )

        if not source_clos.exists():
            return Response(
                {'error': 'No CLOs found in source version'},
                status=status.HTTP_400_BAD_REQUEST
            )

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
        
        return Response(CLOSerializer(new_clos, many=True).data, status=status.HTTP_201_CREATED)


class CLOGAMatrixView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id, version_id):
        clos = CLO.objects.filter(
            course_id=course_id,
            curriculum_version_id=version_id,
            is_active=True
        )
        from ..models import GA
        gas = GA.objects.filter(
            program__courses__id=course_id,
            is_active=True
        ).distinct()
        mappings = CLOGAMapping.objects.filter(
            clo__course_id=course_id,
            clo__curriculum_version_id=version_id,
            is_active=True
        )
        return Response({
            'clos': CLOSerializer(
                clos, many=True
            ).data,
            'gas': GASerializer(
                gas, many=True
            ).data,
            'mappings': CLOGAMappingSerializer(
                mappings, many=True
            ).data
        })

    @transaction.atomic
    def post(
        self, request, course_id, version_id
    ):
        # Check if version is editable (Only allow if version is draft OR course is in upcoming semester)
        try:
            version = CurriculumVersion.objects.get(id=version_id)
            if version.status != 'draft':
                if version.batch and version.batch.current_semester:
                    course_in_version = version.version_courses.filter(course_id=course_id).first()
                    if course_in_version and course_in_version.semester_no <= version.batch.current_semester:
                        return Response({'error': 'Cannot update CLO mappings for current or past semesters in a finalized version'}, status=status.HTTP_400_BAD_REQUEST)
        except CurriculumVersion.DoesNotExist:
            return Response({'error': 'Version not found'}, status=status.HTTP_404_NOT_FOUND)

        mappings_data = request.data.get('mappings', [])

        if not isinstance(mappings_data, list):
            return Response({'error': '`mappings` must be a list'}, status=status.HTTP_400_BAD_REQUEST)

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

        # Load all CLOs for this course+version and build lookup (id_str -> CLO object)
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
                {'error': 'This course & version has no CLOs defined yet. Add CLOs first before mapping.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        def _clo_label(cid):
            c = clos_by_id.get(_norm_id(cid))
            if c:
                return f"CLO-{c.order_number}"
            return f"CLO id={cid}"

        # ---- Validate each incoming mapping ----
        grouped_weights = {}
        duplicates = set()
        seen_pairs = set()
        unknown_clos = []
        invalid_weights = []
        out_of_range = []
        missing_field_idx = []

        for idx, m in enumerate(mappings_data):
            clo_raw = m.get('clo_id') if m.get('clo_id') is not None else m.get('clo')
            ga_raw = m.get('ga_id') if m.get('ga_id') is not None else m.get('ga')
            clo_id = _norm_id(clo_raw)
            ga_id = _norm_id(ga_raw)
            if clo_id is None or ga_id is None:
                missing_field_idx.append(str(idx))
                continue
            try:
                w_raw = m.get('weight', m.get('weightage', 0))
                weight = Decimal(str(w_raw))
            except (InvalidOperation, TypeError, ValueError):
                invalid_weights.append(f"{_clo_label(clo_id)} -> GA {ga_id} (value={w_raw!r})")
                continue
            if weight < 0 or weight > Decimal('1.00'):
                out_of_range.append(f"{_clo_label(clo_id)} -> GA {ga_id} = {weight}")
                continue
            if weight == 0:
                continue
            if clo_id not in clos_by_id:
                unknown_clos.append(_clo_label(clo_id))
                continue
            pair = (clo_id, ga_id)
            if pair in seen_pairs:
                duplicates.add(pair)
            seen_pairs.add(pair)
            grouped_weights.setdefault(clo_id, {'total': Decimal('0'), 'gas': []})
            grouped_weights[clo_id]['gas'].append(ga_id)
            grouped_weights[clo_id]['total'] += weight

        errors = []
        if missing_field_idx:
            errors.append(f"Following mappings are missing clo_id or ga_id (indexes): {', '.join(missing_field_idx)}")
        if invalid_weights:
            errors.append(f"Invalid weight values: {'; '.join(invalid_weights)}")
        if out_of_range:
            errors.append(f"Weight must be between 0.00 and 1.00. Invalid entries: {'; '.join(out_of_range)}")
        if unknown_clos:
            errors.append(f"Following CLOs do not belong to this course & version: {', '.join(sorted(set(unknown_clos)))}")
        if duplicates:
            dup_parts = [f"{_clo_label(c)}/GA={g}" for c, g in duplicates]
            errors.append(f"Duplicate CLO-GA pairs in request: {'; '.join(dup_parts)}")

        # ---- 1 CLO can map to EXACTLY 1 GA only ----
        multi_gas_rows = []
        for clo_id, info in grouped_weights.items():
            if len(info['gas']) > 1:
                multi_gas_rows.append(_clo_label(clo_id))
        if multi_gas_rows:
            errors.append(f"Select only one GA for mapping. Following CLOs have more than one GA selected: {', '.join(sorted(set(multi_gas_rows)))}")

        # ---- Missing CLO selections (CLOs with no GA at all) ----
        all_clo_ids = set(clos_by_id.keys())
        selected_clo_ids = set(grouped_weights.keys())
        missing_clo_ids = all_clo_ids - selected_clo_ids
        if missing_clo_ids:
            names = [f"CLO-{clos_by_id[cid].order_number}" for cid in sorted(missing_clo_ids, key=lambda x: clos_by_id[x].order_number)]
            errors.append(f"Following CLOs have no GA selected: {', '.join(names)}. Each CLO must map to exactly one GA.")

        # ---- Row sum == 1.00 validation (with 1 GA per row, this should always pass with auto-split) ----
        bad_rows = []
        for clo_id, info in grouped_weights.items():
            total = info['total']
            if abs(float(total) - 1.0) > 0.0001:
                clo = clos_by_id.get(clo_id)
                if clo:
                    label = f"CLO-{clo.order_number} (current sum = {float(total):.2f}, expected 1.00)"
                else:
                    label = f"CLO id={clo_id} (sum={float(total):.2f})"
                bad_rows.append(label)
        if bad_rows:
            errors.append(f"Each CLO row must have weights that sum to exactly 1.00. Invalid rows: {'; '.join(bad_rows)}")

        if errors:
            return Response(
                {'error': ' | '.join(errors)},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():
                CLOGAMapping.objects.filter(
                    clo__course_id=course_id,
                    clo__curriculum_version_id=version_id
                ).delete()

                created = []
                for m in mappings_data:
                    clo_id = _norm_id(m.get('clo_id') if m.get('clo_id') is not None else m.get('clo'))
                    ga_id = _norm_id(m.get('ga_id') if m.get('ga_id') is not None else m.get('ga'))
                    if clo_id is None or ga_id is None:
                        continue
                    try:
                        w_raw = m.get('weight', m.get('weightage', 0))
                        weight = Decimal(str(w_raw))
                    except (InvalidOperation, TypeError, ValueError):
                        weight = Decimal('0')
                    if weight <= 0:
                        continue
                    mapping = CLOGAMapping.objects.create(
                        clo_id=clo_id,
                        ga_id=ga_id,
                        weight=weight
                    )
                    created.append(mapping)

            return Response(
                CLOGAMappingSerializer(created, many=True).data,
                status=status.HTTP_201_CREATED
            )
        except IntegrityError as e:
            msg = str(e)
            lower = msg.lower()
            if 'unique' in lower and ('clo' in lower or 'ga' in lower):
                detail = 'Same CLO-GA combination already exists after save (unique constraint). Please refresh the page and try again.'
            else:
                detail = 'Database integrity error while saving mappings.'
            return Response(
                {'error': 'Failed to save mappings due to database conflict.', 'detail': detail},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': 'Unexpected server error while saving mappings.', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# 3. Get CLO-GA matrix for a course
class CourseCLOGAMatrixView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        # Get course, check core.Course exists
        from core.models import Course
        from ..models import GA
        try:
            course = Course.objects.get(id=course_id, is_active=True)
        except Course.DoesNotExist:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)
        # Get all clos for this course (any version)
        clos = CLO.objects.filter(course=course, is_active=True)
        # Get all gas for this course's program
        gas = GA.objects.filter(program=course.program, is_active=True)
        # Get all mappings
        mappings = CLOGAMapping.objects.filter(clo__course=course, is_active=True)
        return Response({
            'clos': CLOSerializer(clos, many=True).data,
            'gas': GASerializer(gas, many=True).data,
            'mappings': CLOGAMappingSerializer(mappings, many=True).data
        })

