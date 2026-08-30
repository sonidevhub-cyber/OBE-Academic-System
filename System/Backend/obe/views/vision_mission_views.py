from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from decimal import Decimal
from core.models import Batch
from ..models import (
    Vision, Mission,
    VisionKeyword, MissionKeyword,
    PEOKeywordMapping,
    PEO, VisionMissionCQI,
    VisionMissionCQIRecord,
)
from ..services import calculate_all_peo_reports
from ..serializers import (
    VisionSerializer, MissionSerializer,
    VisionKeywordSerializer, MissionKeywordSerializer,
    PEOKeywordMappingSerializer,
    VisionMissionCQIRecordSerializer,
)
from django.utils import timezone as django_timezone

def _is_hod(user):
    role = getattr(user, 'role', '') or ''
    secondary_role = getattr(user, 'secondary_role', '') or ''
    active_role = getattr(user, 'active_role', '') or ''
    return 'hod' in {role.lower(), secondary_role.lower(), active_role.lower()}


def _get_user_department_ids(user):
    dept_ids = set()
    profile = getattr(user, 'instructor_profile', None)
    if profile and getattr(profile, 'department', None):
        dept_ids.add(str(profile.department.id))
    programs = getattr(user, 'programs', None)
    if programs:
        for program in programs.all():
            if getattr(program, 'department', None):
                dept_ids.add(str(program.department.id))
    if _is_hod(user) and not dept_ids:
        from core.models import Department
        hod_profile = getattr(user, 'instructor_profile', None)
        if hod_profile and getattr(hod_profile, 'department_id', None):
            dept_ids.add(str(hod_profile.department_id))
        else:
            dept_ids.update(
                str(dept_id)
                for dept_id in Department.objects.filter(
                    programs__coordinators=user,
                    is_active=True,
                ).values_list('id', flat=True)
            )
    return dept_ids


def _can_access_department(user, department_id):
    if getattr(user, 'is_superuser', False):
        return True
    user_dept_ids = _get_user_department_ids(user)
    return str(department_id) in user_dept_ids


def _to_float(value):
    if value is None:
        return None
    return float(Decimal(str(value)).quantize(Decimal('0.01')))


def _target_from_peos(peos):
    targets = [Decimal(str(peo.kpi_threshold)) for peo in peos if getattr(peo, 'kpi_threshold', None) is not None]
    if not targets:
        return Decimal('60.00')
    return sum(targets) / Decimal(len(targets))


def _target_from_peo_snapshots(peos):
    targets = [Decimal(str(peo.get('kpi_threshold'))) for peo in peos if peo.get('kpi_threshold') is not None]
    if not targets:
        return Decimal('60.00')
    return sum(targets) / Decimal(len(targets))


def _status(score, target):
    if score is None:
        return 'Not Assessed'
    return 'Achieved' if score >= target else 'Not Achieved'


def _calculate_vm_keyword_score(keyword_type, keyword, batch):
    peo_reports = calculate_all_peo_reports(batch)
    peo_score_by_id = {
        row['peo_id']: Decimal(str(row['final_score']))
        for row in peo_reports
        if row.get('final_score') is not None
    }

    lookup = {'mission_keyword': keyword} if keyword_type == 'MISSION' else {'vision_keyword': keyword}
    mappings = list(
        PEOKeywordMapping.objects.filter(
            peo__program=batch.program,
            peo__is_active=True,
            is_active=True,
            **lookup,
        ).select_related('peo')
    )
    mapped_peos = [mapping.peo for mapping in mappings]
    scores = [peo_score_by_id[str(peo.id)] for peo in mapped_peos if str(peo.id) in peo_score_by_id]
    return (sum(scores) / Decimal(len(scores))) if scores else None


STOP_WORDS = {
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'as', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'between', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
    'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
    'too', 'very', 'just', 'because', 'but', 'and', 'or', 'if', 'while',
    'that', 'this', 'these', 'those', 'what', 'which', 'who', 'whom',
    'it', 'its', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours',
    'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves',
    'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
    'they', 'them', 'their', 'theirs', 'themselves', 'also', 'about',
    'up', 'out', 'down', 'off', 'over', 'across', 'among', 'against',
    'without', 'within', 'along', 'around', 'behind', 'beyond',
    'toward', 'upon', 'per', 'etc'
}


def _extract_candidate_phrases(text):
    if not text:
        return []
    cleaned = text.replace('\n', ' ').replace('\r', ' ')
    for punc in ['.', ',', ';', ':', '!', '?', '"', "'", '(', ')', '[', ']', '{', '}', '-', '—', '/']:
        cleaned = cleaned.replace(punc, ' ')
    words = cleaned.split()
    filtered = [w for w in words if len(w) >= 3 and w.lower() not in STOP_WORDS]
    candidates = set()
    for w in filtered:
        candidates.add(w.capitalize())
    for i in range(len(filtered) - 1):
        phrase = f"{filtered[i].capitalize()} {filtered[i + 1].capitalize()}"
        candidates.add(phrase)
    for i in range(len(filtered) - 2):
        phrase = f"{filtered[i].capitalize()} {filtered[i + 1].capitalize()} {filtered[i + 2].capitalize()}"
        candidates.add(phrase)
    return sorted(candidates, key=lambda s: (-len(s.split()), s.lower()))


class DepartmentVisionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, department_id):
        if not _can_access_department(request.user, department_id):
            return Response(
                {'error': 'You are not authorized to view Vision and Mission for this department.'},
                status=status.HTTP_403_FORBIDDEN
            )
        vision = Vision.objects.filter(
            department_id=department_id, is_active=True
        ).order_by('-created_at').first()
        if not vision:
            return Response({'id': None, 'statement': '', 'keywords': []})
        keywords = VisionKeyword.objects.filter(vision=vision, is_active=True)
        data = VisionSerializer(vision).data
        data['keywords'] = VisionKeywordSerializer(keywords, many=True).data
        return Response(data)

    @transaction.atomic
    def post(self, request, department_id):
        if not _is_hod(request.user):
            return Response(
                {'error': 'You are not authorized to manage Vision. Only HODs can update the department Vision.'},
                status=status.HTTP_403_FORBIDDEN
            )
        if not _can_access_department(request.user, department_id):
            return Response(
                {'error': 'You are not authorized to manage Vision for this department.'},
                status=status.HTTP_403_FORBIDDEN
            )
        statement = (request.data.get('statement') or '').strip()
        if not statement:
            return Response(
                {'error': 'Vision statement cannot be empty.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        vision = Vision.objects.create(
            department_id=department_id,
            statement=statement,
            created_by=request.user,
            is_active=True,
        )
        return Response(VisionSerializer(vision).data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def patch(self, request, department_id):
        if not _is_hod(request.user):
            return Response(
                {'error': 'You are not authorized to manage Vision. Only HODs can update the department Vision.'},
                status=status.HTTP_403_FORBIDDEN
            )
        if not _can_access_department(request.user, department_id):
            return Response(
                {'error': 'You are not authorized to manage Vision for this department.'},
                status=status.HTTP_403_FORBIDDEN
            )
        vision = Vision.objects.filter(
            department_id=department_id, is_active=True
        ).order_by('-created_at').first()
        statement = (request.data.get('statement') or '').strip()
        if not statement:
            return Response(
                {'error': 'Vision statement cannot be empty.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if vision and vision.statement == statement:
            keywords = VisionKeyword.objects.filter(vision=vision, is_active=True)
            data = VisionSerializer(vision).data
            data['keywords'] = VisionKeywordSerializer(keywords, many=True).data
            return Response(data)
        vision = Vision.objects.create(
            department_id=department_id,
            statement=statement,
            created_by=request.user,
            is_active=True,
        )
        keywords = VisionKeyword.objects.filter(vision=vision, is_active=True)
        data = VisionSerializer(vision).data
        data['keywords'] = VisionKeywordSerializer(keywords, many=True).data
        return Response(data)


class DepartmentMissionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, department_id):
        if not _can_access_department(request.user, department_id):
            return Response(
                {'error': 'You are not authorized to view Vision and Mission for this department.'},
                status=status.HTTP_403_FORBIDDEN
            )
        mission = Mission.objects.filter(
            department_id=department_id, is_active=True
        ).order_by('-created_at').first()
        if not mission:
            return Response({'id': None, 'statement': '', 'keywords': []})
        keywords = MissionKeyword.objects.filter(mission=mission, is_active=True)
        data = MissionSerializer(mission).data
        data['keywords'] = MissionKeywordSerializer(keywords, many=True).data
        return Response(data)

    @transaction.atomic
    def post(self, request, department_id):
        if not _is_hod(request.user):
            return Response(
                {'error': 'You are not authorized to manage Mission. Only HODs can update the department Mission.'},
                status=status.HTTP_403_FORBIDDEN
            )
        if not _can_access_department(request.user, department_id):
            return Response(
                {'error': 'You are not authorized to manage Mission for this department.'},
                status=status.HTTP_403_FORBIDDEN
            )
        statement = (request.data.get('statement') or '').strip()
        if not statement:
            return Response(
                {'error': 'Mission statement cannot be empty.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        mission = Mission.objects.create(
            department_id=department_id,
            statement=statement,
            created_by=request.user,
            is_active=True,
        )
        return Response(MissionSerializer(mission).data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def patch(self, request, department_id):
        if not _is_hod(request.user):
            return Response(
                {'error': 'You are not authorized to manage Mission. Only HODs can update the department Mission.'},
                status=status.HTTP_403_FORBIDDEN
            )
        if not _can_access_department(request.user, department_id):
            return Response(
                {'error': 'You are not authorized to manage Mission for this department.'},
                status=status.HTTP_403_FORBIDDEN
            )
        mission = Mission.objects.filter(
            department_id=department_id, is_active=True
        ).order_by('-created_at').first()
        statement = (request.data.get('statement') or '').strip()
        if not statement:
            return Response(
                {'error': 'Mission statement cannot be empty.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if mission and mission.statement == statement:
            keywords = MissionKeyword.objects.filter(mission=mission, is_active=True)
            data = MissionSerializer(mission).data
            data['keywords'] = MissionKeywordSerializer(keywords, many=True).data
            return Response(data)
        mission = Mission.objects.create(
            department_id=department_id,
            statement=statement,
            created_by=request.user,
            is_active=True,
        )
        keywords = MissionKeyword.objects.filter(mission=mission, is_active=True)
        data = MissionSerializer(mission).data
        data['keywords'] = MissionKeywordSerializer(keywords, many=True).data
        return Response(data)


class ExtractKeywordsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        source_type = (request.data.get('source_type') or '').lower()
        text = request.data.get('text') or ''
        if source_type not in ('vision', 'mission'):
            return Response(
                {'error': 'source_type must be "vision" or "mission".'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not text.strip():
            return Response(
                {'error': 'Text cannot be empty for keyword extraction.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        candidates = _extract_candidate_phrases(text)
        return Response({
            'candidates': candidates[:80],
        })


class VisionKeywordListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, vision_id):
        try:
            vision = Vision.objects.get(id=vision_id)
        except Vision.DoesNotExist:
            return Response({'error': 'Vision not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not _can_access_department(request.user, vision.department_id):
            return Response(
                {'error': 'You are not authorized to view keywords for this department.'},
                status=status.HTTP_403_FORBIDDEN
            )
        keywords = VisionKeyword.objects.filter(vision=vision, is_active=True).order_by('text')
        return Response(VisionKeywordSerializer(keywords, many=True).data)

    @transaction.atomic
    def post(self, request, vision_id):
        if not _is_hod(request.user):
            return Response(
                {'error': 'You are not authorized to manage Vision keywords. Only HODs can update keywords.'},
                status=status.HTTP_403_FORBIDDEN
            )
        try:
            vision = Vision.objects.get(id=vision_id)
        except Vision.DoesNotExist:
            return Response({'error': 'Vision not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not _can_access_department(request.user, vision.department_id):
            return Response(
                {'error': 'You are not authorized to manage keywords for this department.'},
                status=status.HTTP_403_FORBIDDEN
            )
        keywords_data = request.data.get('keywords', []) or []
        if not isinstance(keywords_data, list):
            return Response(
                {'error': '"keywords" must be a list of strings or objects with a "text" field.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        existing_texts = set(
            VisionKeyword.objects.filter(vision=vision).values_list('text', flat=True)
        )
        created = []
        for item in keywords_data:
            if isinstance(item, str):
                text = item
            elif isinstance(item, dict):
                text = item.get('text') or ''
            else:
                continue
            text = str(text).strip()
            if not text or len(text) > 255:
                continue
            if text.lower() in (t.lower() for t in existing_texts):
                kw = VisionKeyword.objects.filter(vision=vision, text__iexact=text).first()
                if kw and not kw.is_active:
                    kw.is_active = True
                    kw.save()
                    created.append(kw)
                elif kw:
                    created.append(kw)
                continue
            kw = VisionKeyword.objects.create(vision=vision, text=text, is_active=True)
            existing_texts.add(text)
            created.append(kw)
        return Response(VisionKeywordSerializer(created, many=True).data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def delete(self, request, vision_id):
        if not _is_hod(request.user):
            return Response(
                {'error': 'You are not authorized to remove Vision keywords. Only HODs can update keywords.'},
                status=status.HTTP_403_FORBIDDEN
            )
        try:
            vision = Vision.objects.get(id=vision_id)
        except Vision.DoesNotExist:
            return Response({'error': 'Vision not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not _can_access_department(request.user, vision.department_id):
            return Response(
                {'error': 'You are not authorized to manage keywords for this department.'},
                status=status.HTTP_403_FORBIDDEN
            )
        keyword_id = request.data.get('keyword_id') if isinstance(request.data, dict) else None
        text = request.data.get('text') if isinstance(request.data, dict) else None
        qs = VisionKeyword.objects.filter(vision=vision, is_active=True)
        if keyword_id:
            qs = qs.filter(id=keyword_id)
        elif text:
            qs = qs.filter(text__iexact=str(text).strip())
        else:
            return Response(
                {'error': 'Provide keyword_id or text to remove a keyword.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        deactivated_count = qs.count()
        qs.update(is_active=False)
        return Response({'success': True, 'deactivated_count': deactivated_count})


class MissionKeywordListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, mission_id):
        try:
            mission = Mission.objects.get(id=mission_id)
        except Mission.DoesNotExist:
            return Response({'error': 'Mission not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not _can_access_department(request.user, mission.department_id):
            return Response(
                {'error': 'You are not authorized to view keywords for this department.'},
                status=status.HTTP_403_FORBIDDEN
            )
        keywords = MissionKeyword.objects.filter(mission=mission, is_active=True).order_by('text')
        return Response(MissionKeywordSerializer(keywords, many=True).data)

    @transaction.atomic
    def post(self, request, mission_id):
        if not _is_hod(request.user):
            return Response(
                {'error': 'You are not authorized to manage Mission keywords. Only HODs can update keywords.'},
                status=status.HTTP_403_FORBIDDEN
            )
        try:
            mission = Mission.objects.get(id=mission_id)
        except Mission.DoesNotExist:
            return Response({'error': 'Mission not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not _can_access_department(request.user, mission.department_id):
            return Response(
                {'error': 'You are not authorized to manage keywords for this department.'},
                status=status.HTTP_403_FORBIDDEN
            )
        keywords_data = request.data.get('keywords', []) or []
        if not isinstance(keywords_data, list):
            return Response(
                {'error': '"keywords" must be a list of strings or objects with a "text" field.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        existing_texts = set(
            MissionKeyword.objects.filter(mission=mission).values_list('text', flat=True)
        )
        created = []
        for item in keywords_data:
            if isinstance(item, str):
                text = item
            elif isinstance(item, dict):
                text = item.get('text') or ''
            else:
                continue
            text = str(text).strip()
            if not text or len(text) > 255:
                continue
            if text.lower() in (t.lower() for t in existing_texts):
                kw = MissionKeyword.objects.filter(mission=mission, text__iexact=text).first()
                if kw and not kw.is_active:
                    kw.is_active = True
                    kw.save()
                    created.append(kw)
                elif kw:
                    created.append(kw)
                continue
            kw = MissionKeyword.objects.create(mission=mission, text=text, is_active=True)
            existing_texts.add(text)
            created.append(kw)
        return Response(MissionKeywordSerializer(created, many=True).data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def delete(self, request, mission_id):
        if not _is_hod(request.user):
            return Response(
                {'error': 'You are not authorized to remove Mission keywords. Only HODs can update keywords.'},
                status=status.HTTP_403_FORBIDDEN
            )
        try:
            mission = Mission.objects.get(id=mission_id)
        except Mission.DoesNotExist:
            return Response({'error': 'Mission not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not _can_access_department(request.user, mission.department_id):
            return Response(
                {'error': 'You are not authorized to manage keywords for this department.'},
                status=status.HTTP_403_FORBIDDEN
            )
        keyword_id = request.data.get('keyword_id') if isinstance(request.data, dict) else None
        text = request.data.get('text') if isinstance(request.data, dict) else None
        qs = MissionKeyword.objects.filter(mission=mission, is_active=True)
        if keyword_id:
            qs = qs.filter(id=keyword_id)
        elif text:
            qs = qs.filter(text__iexact=str(text).strip())
        else:
            return Response(
                {'error': 'Provide keyword_id or text to remove a keyword.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        deactivated_count = qs.count()
        qs.update(is_active=False)
        return Response({'success': True, 'deactivated_count': deactivated_count})


class ProgramPEOKeywordMappingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, program_id):
        from core.models.program import Program
        try:
            program = Program.objects.get(id=program_id)
        except Program.DoesNotExist:
            return Response({'error': 'Program not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not _can_access_department(request.user, program.department_id):
            return Response(
                {'error': 'You are not authorized to view PO-keyword mappings for this program.'},
                status=status.HTTP_403_FORBIDDEN
            )
        peos = PEO.objects.filter(program_id=program_id, is_active=True).order_by('order_number')
        vision = Vision.objects.filter(
            department_id=program.department_id, is_active=True
        ).order_by('-created_at').first()
        mission = Mission.objects.filter(
            department_id=program.department_id, is_active=True
        ).order_by('-created_at').first()
        vision_keywords = VisionKeyword.objects.filter(vision=vision, is_active=True).order_by('text') if vision else []
        mission_keywords = MissionKeyword.objects.filter(mission=mission, is_active=True).order_by('text') if mission else []
        mappings = PEOKeywordMapping.objects.filter(
            peo__program_id=program_id,
            is_active=True,
        )
        return Response({
            'peos': [
                {
                    'id': str(p.id),
                    'order_number': p.order_number,
                    'title': p.title,
                    'description': p.description,
                } for p in peos
            ],
            'vision_keywords': VisionKeywordSerializer(vision_keywords, many=True).data,
            'mission_keywords': MissionKeywordSerializer(mission_keywords, many=True).data,
            'mappings': PEOKeywordMappingSerializer(mappings, many=True).data,
        })

    @transaction.atomic
    def post(self, request, program_id):
        if not _is_hod(request.user):
            return Response(
                {'error': 'You are not authorized to manage PO-keyword mappings. Only HODs can update mappings.'},
                status=status.HTTP_403_FORBIDDEN
            )
        from core.models.program import Program
        try:
            program = Program.objects.get(id=program_id)
        except Program.DoesNotExist:
            return Response({'error': 'Program not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not _can_access_department(request.user, program.department_id):
            return Response(
                {'error': 'You are not authorized to manage mappings for this program.'},
                status=status.HTTP_403_FORBIDDEN
            )
        mappings_data = request.data.get('mappings', []) or []
        if not isinstance(mappings_data, list):
            return Response(
                {'error': '"mappings" must be a list of objects with peo_id and mission_keyword_id or vision_keyword_id.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        valid_peo_ids = {
            str(item_id)
            for item_id in PEO.objects.filter(program_id=program_id, is_active=True).values_list('id', flat=True)
        }
        vision = Vision.objects.filter(
            department_id=program.department_id, is_active=True
        ).order_by('-created_at').first()
        mission = Mission.objects.filter(
            department_id=program.department_id, is_active=True
        ).order_by('-created_at').first()
        valid_vk_ids = {
            str(item_id)
            for item_id in VisionKeyword.objects.filter(vision=vision, is_active=True).values_list('id', flat=True)
        } if vision else set()
        valid_mk_ids = {
            str(item_id)
            for item_id in MissionKeyword.objects.filter(mission=mission, is_active=True).values_list('id', flat=True)
        } if mission else set()
        PEOKeywordMapping.objects.filter(peo__program_id=program_id).update(is_active=False)
        created = []
        seen = set()
        for m in mappings_data:
            peo_id = m.get('peo_id') or m.get('peo')
            mk_id = m.get('mission_keyword_id') or m.get('mission_keyword')
            vk_id = m.get('vision_keyword_id') or m.get('vision_keyword')
            if not peo_id or (not mk_id and not vk_id):
                continue
            peo_id_safe = str(peo_id)
            mk_id = str(mk_id) if mk_id else None
            vk_id = str(vk_id) if vk_id else None
            if peo_id_safe not in valid_peo_ids:
                continue
            mk_id_safe = mk_id if mk_id in valid_mk_ids else None
            vk_id_safe = vk_id if vk_id in valid_vk_ids else None
            if not mk_id_safe and not vk_id_safe:
                continue
            for field_name, keyword_id in (('mission_keyword_id', mk_id_safe), ('vision_keyword_id', vk_id_safe)):
                if not keyword_id:
                    continue
                key = (peo_id_safe, field_name, keyword_id)
                if key in seen:
                    continue
                seen.add(key)
                defaults = {'is_active': True}
                if field_name == 'mission_keyword_id':
                    mapping, _ = PEOKeywordMapping.objects.update_or_create(
                        peo_id=peo_id_safe,
                        mission_keyword_id=keyword_id,
                        defaults={**defaults, 'vision_keyword_id': None},
                    )
                else:
                    mapping, _ = PEOKeywordMapping.objects.update_or_create(
                        peo_id=peo_id_safe,
                        vision_keyword_id=keyword_id,
                        defaults={**defaults, 'mission_keyword_id': None},
                    )
                created.append(mapping)
        return Response(
            PEOKeywordMappingSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )


class BatchVisionMissionAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.select_related('program', 'program__department').get(id=batch_id)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found.'}, status=status.HTTP_404_NOT_FOUND)

        department = batch.program.department
        if not department:
            return Response({'error': 'Batch program has no department.'}, status=status.HTTP_400_BAD_REQUEST)
        if not _can_access_department(request.user, department.id):
            return Response(
                {'error': 'You are not authorized to view Vision and Mission analytics for this batch.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        vm_snapshot = batch.vision_mission_snapshot or {}
        peo_snapshot = batch.peo_snapshot or {}
        vision_snapshot = vm_snapshot.get('vision') or {}
        mission_snapshot = vm_snapshot.get('mission') or {}
        vision_keywords = vision_snapshot.get('keywords') or []
        mission_keywords = mission_snapshot.get('keywords') or []
        peo_snapshots = peo_snapshot.get('peos') or []
        peo_snapshot_by_id = {peo.get('id'): peo for peo in peo_snapshots}

        if not vm_snapshot:
            vision = Vision.objects.filter(department=department, is_active=True).order_by('-created_at').first()
            mission = Mission.objects.filter(department=department, is_active=True).order_by('-created_at').first()
            vision_keywords = [
                {'id': str(keyword.id), 'text': keyword.text}
                for keyword in (VisionKeyword.objects.filter(vision=vision, is_active=True).order_by('text') if vision else [])
            ]
            mission_keywords = [
                {'id': str(keyword.id), 'text': keyword.text}
                for keyword in (MissionKeyword.objects.filter(mission=mission, is_active=True).order_by('text') if mission else [])
            ]

        peo_reports = calculate_all_peo_reports(batch)
        peo_score_by_id = {
            row['peo_id']: Decimal(str(row['final_score']))
            for row in peo_reports
            if row.get('final_score') is not None
        }
        cqi_records = VisionMissionCQI.objects.filter(batch=batch, is_active=True)
        cqi_by_mission = {str(record.mission_keyword_id): record for record in cqi_records if record.mission_keyword_id}
        cqi_by_vision = {str(record.vision_keyword_id): record for record in cqi_records if record.vision_keyword_id}

        mission_rows = []
        mission_score_by_id = {}
        for keyword in mission_keywords:
            mappings = [
                mapping for mapping in vm_snapshot.get('peo_keyword_mappings', [])
                if mapping.get('mission_keyword_id') == keyword.get('id')
            ]
            mapped_peos = [
                peo_snapshot_by_id.get(mapping.get('peo_id'))
                for mapping in mappings
                if peo_snapshot_by_id.get(mapping.get('peo_id'))
            ]
            if not mapped_peos:
                live_mappings = PEOKeywordMapping.objects.filter(
                    mission_keyword_id=keyword.get('id'),
                    peo__program=batch.program,
                    peo__is_active=True,
                    is_active=True,
                ).select_related('peo')
                mapped_peos = [
                    {
                        'id': str(mapping.peo_id),
                        'code': f"PO-{mapping.peo.order_number}",
                        'kpi_threshold': str(mapping.peo.kpi_threshold),
                    }
                    for mapping in live_mappings
                ]
            scores = [peo_score_by_id[peo['id']] for peo in mapped_peos if peo.get('id') in peo_score_by_id]
            score = (sum(scores) / Decimal(len(scores))) if scores else None
            target = _target_from_peo_snapshots(mapped_peos)
            row_status = _status(score, target)
            cqi = cqi_by_mission.get(str(keyword.get('id')))
            if score is not None:
                mission_score_by_id[str(keyword.get('id'))] = score

            mission_rows.append({
                'keyword_type': 'MISSION',
                'keyword_id': str(keyword.get('id')),
                'keyword': keyword.get('text'),
                'target_kpi': _to_float(target),
                'attainment_score': _to_float(score),
                'status': row_status,
                'cqi_action_required': row_status == 'Not Achieved',
                'hod_action_plan': cqi.hod_action_plan if cqi else '',
                'cqi_record_id': str(cqi.id) if cqi else None,
                'cqi_status': cqi.status if cqi else None,
                'is_locked': cqi.is_locked if cqi else False,
                'implemented_in_batch': str(cqi.implemented_in_batch_id) if cqi and cqi.implemented_in_batch_id else None,
                'implemented_in_batch_name': cqi.implemented_in_batch.name if cqi and cqi.implemented_in_batch else None,
                'action_taken_description': cqi.action_taken_description if cqi else None,
                'resulting_attainment': _to_float(cqi.resulting_attainment) if cqi else None,
                'closed_at': cqi.closed_at.isoformat() if cqi and cqi.closed_at else None,
                'mapped_count': len(mapped_peos),
                'mapped_items': [peo.get('code') for peo in mapped_peos],
            })

        vision_rows = []
        for keyword in vision_keywords:
            mappings = [
                mapping for mapping in vm_snapshot.get('peo_keyword_mappings', [])
                if mapping.get('vision_keyword_id') == keyword.get('id')
            ]
            mapped_peos = [
                peo_snapshot_by_id.get(mapping.get('peo_id'))
                for mapping in mappings
                if peo_snapshot_by_id.get(mapping.get('peo_id'))
            ]
            if not mapped_peos:
                live_mappings = PEOKeywordMapping.objects.filter(
                    vision_keyword_id=keyword.get('id'),
                    peo__program=batch.program,
                    peo__is_active=True,
                    is_active=True,
                ).select_related('peo')
                mapped_peos = [
                    {
                        'id': str(mapping.peo_id),
                        'code': f"PO-{mapping.peo.order_number}",
                        'kpi_threshold': str(mapping.peo.kpi_threshold),
                    }
                    for mapping in live_mappings
                ]
            scores = [peo_score_by_id[peo['id']] for peo in mapped_peos if peo.get('id') in peo_score_by_id]
            score = (sum(scores) / Decimal(len(scores))) if scores else None
            target = _target_from_peo_snapshots(mapped_peos)

            row_status = _status(score, target)
            cqi = cqi_by_vision.get(str(keyword.get('id')))
            vision_rows.append({
                'keyword_type': 'VISION',
                'keyword_id': str(keyword.get('id')),
                'keyword': keyword.get('text'),
                'target_kpi': _to_float(target),
                'attainment_score': _to_float(score),
                'status': row_status,
                'cqi_action_required': row_status == 'Not Achieved',
                'hod_action_plan': cqi.hod_action_plan if cqi else '',
                'cqi_record_id': str(cqi.id) if cqi else None,
                'cqi_status': cqi.status if cqi else None,
                'is_locked': cqi.is_locked if cqi else False,
                'implemented_in_batch': str(cqi.implemented_in_batch_id) if cqi and cqi.implemented_in_batch_id else None,
                'implemented_in_batch_name': cqi.implemented_in_batch.name if cqi and cqi.implemented_in_batch else None,
                'action_taken_description': cqi.action_taken_description if cqi else None,
                'resulting_attainment': _to_float(cqi.resulting_attainment) if cqi else None,
                'closed_at': cqi.closed_at.isoformat() if cqi and cqi.closed_at else None,
                'mapped_count': len(mapped_peos),
                'mapped_items': [peo.get('code') for peo in mapped_peos],
            })

        return Response({
            'batch_id': str(batch.id),
            'program_id': str(batch.program_id),
            'department_id': str(department.id),
            'vision': {
                'id': vision_snapshot.get('id'),
                'statement': vision_snapshot.get('vision_text', ''),
                'keywords': vision_keywords,
            },
            'mission': {
                'id': mission_snapshot.get('id'),
                'statement': mission_snapshot.get('mission_text', ''),
                'keywords': mission_keywords,
            },
            'vision_rows': vision_rows,
            'mission_rows': mission_rows,
            'is_hod': _is_hod(request.user),
        })


class VisionMissionCQIUpsertView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, batch_id):
        if not _is_hod(request.user):
            return Response(
                {'error': 'Only HODs can save Vision/Mission CQI action plans.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            batch = Batch.objects.select_related('program', 'program__department').get(id=batch_id)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found.'}, status=status.HTTP_404_NOT_FOUND)

        department = batch.program.department
        if not department or not _can_access_department(request.user, department.id):
            return Response(
                {'error': 'You are not authorized to save Vision/Mission CQI for this batch.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        keyword_type = (request.data.get('keyword_type') or '').upper()
        keyword_id = request.data.get('keyword_id')
        hod_action_plan = (request.data.get('hod_action_plan') or '').strip()
        attainment_value = request.data.get('attainment_value')
        target_kpi = request.data.get('target_kpi')
        cqi_action_required = bool(request.data.get('cqi_action_required', True))

        if keyword_type not in ('MISSION', 'VISION') or not keyword_id:
            return Response(
                {'error': 'keyword_type and keyword_id are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        defaults = {
            'keyword_type': keyword_type,
            'hod_action_plan': hod_action_plan,
            'attainment_value': Decimal(str(attainment_value)) if attainment_value is not None else None,
            'kpi_threshold_at_trigger': Decimal(str(target_kpi)) if target_kpi is not None else None,
            'cqi_action_required': cqi_action_required,
            'updated_by': request.user,
            'is_active': True,
        }

        if keyword_type == 'MISSION':
            try:
                keyword = MissionKeyword.objects.select_related('mission').get(id=keyword_id, is_active=True)
            except MissionKeyword.DoesNotExist:
                return Response({'error': 'Mission keyword not found.'}, status=status.HTTP_404_NOT_FOUND)
            if keyword.mission.department_id != department.id:
                return Response({'error': 'Mission keyword does not belong to this batch department.'}, status=status.HTTP_400_BAD_REQUEST)
            cqi, created = VisionMissionCQI.objects.update_or_create(
                batch=batch,
                mission_keyword=keyword,
                defaults={**defaults, 'vision_keyword': None, 'created_by': request.user},
            )
        else:
            try:
                keyword = VisionKeyword.objects.select_related('vision').get(id=keyword_id, is_active=True)
            except VisionKeyword.DoesNotExist:
                return Response({'error': 'Vision keyword not found.'}, status=status.HTTP_404_NOT_FOUND)
            if keyword.vision.department_id != department.id:
                return Response({'error': 'Vision keyword does not belong to this batch department.'}, status=status.HTTP_400_BAD_REQUEST)
            cqi, created = VisionMissionCQI.objects.update_or_create(
                batch=batch,
                vision_keyword=keyword,
                defaults={**defaults, 'mission_keyword': None, 'created_by': request.user},
            )

        return Response({
            'id': str(cqi.id),
            'keyword_type': cqi.keyword_type,
            'keyword_id': str(cqi.mission_keyword_id or cqi.vision_keyword_id),
            'hod_action_plan': cqi.hod_action_plan,
            'attainment_value': _to_float(cqi.attainment_value),
            'target_kpi': _to_float(cqi.kpi_threshold_at_trigger),
            'cqi_action_required': cqi.cqi_action_required,
            'created': created,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class VisionMissionCQICloseView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, cqi_id):
        if not _is_hod(request.user):
            return Response(
                {'error': 'Only HODs can close Vision/Mission CQI records.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            cqi = VisionMissionCQI.objects.select_related(
                'batch', 'batch__program', 'batch__program__department',
                'mission_keyword', 'vision_keyword',
            ).get(id=cqi_id, is_active=True)
        except VisionMissionCQI.DoesNotExist:
            return Response({'error': 'Vision/Mission CQI not found.'}, status=status.HTTP_404_NOT_FOUND)

        department = cqi.batch.program.department if cqi.batch and cqi.batch.program else None
        if not department or not _can_access_department(request.user, department.id):
            return Response(
                {'error': 'You are not authorized to close this Vision/Mission CQI record.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if cqi.status == 'CLOSED_IMPLEMENTED':
            return Response({'error': 'This Vision/Mission CQI record is already closed.'}, status=status.HTTP_400_BAD_REQUEST)

        implemented_in_batch_id = request.data.get('implemented_in_batch')
        action_taken_description = request.data.get('action_taken_description', '')
        if not implemented_in_batch_id:
            return Response({'error': 'implemented_in_batch is mandatory.'}, status=status.HTTP_400_BAD_REQUEST)
        if not action_taken_description or not str(action_taken_description).strip():
            return Response({'error': 'action_taken_description is mandatory.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            impl_batch = Batch.objects.select_related('program', 'program__department').get(id=implemented_in_batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Implementation batch not found.'}, status=status.HTTP_404_NOT_FOUND)

        if impl_batch.program.department_id != department.id:
            return Response(
                {'error': 'Implementation batch must belong to the same department.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        keyword = cqi.mission_keyword if cqi.keyword_type == 'MISSION' else cqi.vision_keyword
        resulting_attainment = _calculate_vm_keyword_score(cqi.keyword_type, keyword, impl_batch) if keyword else None

        cqi.implemented_in_batch = impl_batch
        cqi.action_taken_description = str(action_taken_description).strip()
        cqi.resulting_attainment = round(resulting_attainment, 2) if resulting_attainment is not None else None
        cqi.closed_by = request.user
        cqi.closed_at = django_timezone.now()
        cqi.status = 'CLOSED_IMPLEMENTED'
        cqi.is_locked = True
        cqi.save()

        return Response({
            'id': str(cqi.id),
            'keyword_type': cqi.keyword_type,
            'keyword_id': str(cqi.mission_keyword_id or cqi.vision_keyword_id),
            'hod_action_plan': cqi.hod_action_plan,
            'attainment_value': _to_float(cqi.attainment_value),
            'target_kpi': _to_float(cqi.kpi_threshold_at_trigger),
            'cqi_action_required': cqi.cqi_action_required,
            'implemented_in_batch': str(cqi.implemented_in_batch_id),
            'implemented_in_batch_name': cqi.implemented_in_batch.name if cqi.implemented_in_batch else None,
            'action_taken_description': cqi.action_taken_description,
            'resulting_attainment': _to_float(cqi.resulting_attainment),
            'closed_by': str(cqi.closed_by_id) if cqi.closed_by_id else None,
            'closed_by_name': cqi.closed_by.full_name if cqi.closed_by else None,
            'closed_at': cqi.closed_at.isoformat() if cqi.closed_at else None,
            'status': cqi.status,
            'is_locked': cqi.is_locked,
        }, status=status.HTTP_200_OK)


class VisionMissionCQIRecordListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _is_hod(request.user):
            return Response(
                {'error': 'Only HODs can view Vision/Mission CQI review records.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        dept_ids = _get_user_department_ids(request.user)
        qs = VisionMissionCQIRecord.objects.filter(is_active=True)
        if dept_ids and not request.user.is_superuser:
            qs = qs.filter(department_id__in=dept_ids)
        qs = qs.select_related('department', 'reviewed_by').order_by('-review_date', '-created_at')
        return Response(VisionMissionCQIRecordSerializer(qs, many=True).data)

    @transaction.atomic
    def post(self, request):
        if not _is_hod(request.user):
            return Response(
                {'error': 'Only HODs can create Vision/Mission CQI review records.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        department_id = request.data.get('department')
        if not department_id:
            return Response(
                {'error': 'department is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not _can_access_department(request.user, department_id):
            return Response(
                {'error': 'You are not authorized for this department.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        statement_type = (request.data.get('statement_type') or '').upper()
        decision = (request.data.get('decision') or '').upper()
        justification = request.data.get('justification', '')
        new_statement = request.data.get('new_statement')
        trigger_type = (request.data.get('trigger_type') or 'MANUAL').upper()

        if statement_type not in ('VISION', 'MISSION'):
            return Response(
                {'error': 'statement_type must be VISION or MISSION.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if decision not in ('RETAINED', 'REVISED'):
            return Response(
                {'error': 'decision must be RETAINED or REVISED.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if trigger_type not in ('SCHEDULED', 'MANUAL'):
            return Response(
                {'error': 'trigger_type must be SCHEDULED or MANUAL.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not justification or not str(justification).strip():
            return Response(
                {'error': 'justification is mandatory.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if decision == 'REVISED' and (not new_statement or not str(new_statement).strip()):
            return Response(
                {'error': 'new_statement is required when decision is REVISED.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if statement_type == 'VISION':
            prev = Vision.objects.filter(department_id=department_id, is_active=True).order_by('-created_at').first()
        else:
            prev = Mission.objects.filter(department_id=department_id, is_active=True).order_by('-created_at').first()
        previous_snapshot = prev.statement if prev else ''

        record = VisionMissionCQIRecord.objects.create(
            department_id=department_id,
            statement_type=statement_type,
            trigger_type=trigger_type,
            review_date=django_timezone.now(),
            reviewed_by=request.user,
            previous_statement_snapshot=previous_snapshot,
            decision=decision,
            justification=str(justification).strip(),
            new_statement=str(new_statement).strip() if decision == 'REVISED' and new_statement else None,
            status='REVIEWED',
        )

        return Response(
            VisionMissionCQIRecordSerializer(record).data,
            status=status.HTTP_201_CREATED,
        )
