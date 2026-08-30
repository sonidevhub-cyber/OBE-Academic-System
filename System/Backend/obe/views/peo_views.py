from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.contrib.auth import get_user_model
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from core.models import Batch
from students.models import Student
from ..models import PEO, GAPEOMapping, GA, AlumniSurveyQuestion, AlumniSurveyCycle, AlumniSurveyResponse, AlumniSurveySubmission, AlumniSurveyAnswer, EmployerSurveyCycle, EmployerSurveyResponse, get_peo_indirect_score, PEOCQIRecord, PEOCQISubmissionHistory, SurveyQuestion, SURVEY_TYPE_ALUMNI, SURVEY_TYPE_EMPLOYER, QUESTION_TYPE_RATING_SCALE, QUESTION_TYPE_SINGLE_SELECT, QUESTION_TYPE_TEXT
from ..serializers import PEOSerializer, GAPEOMappingSerializer, GASerializer, AlumniSurveyQuestionSerializer, AlumniSurveyCycleSerializer, AlumniSurveyResponseSerializer, PEOCQIRecordSerializer, PEOCQISubmissionHistorySerializer, SurveyQuestionSerializer, EmployerSurveyCycleSerializer, EmployerSurveyResponseSerializer
from ..services import calculate_all_peo_reports, calculate_peo_report, generate_employer_survey_tokens_for_cycle, dispatch_employer_survey_emails, submit_employer_survey_by_token

User = get_user_model()
ALUMNI_FEEDBACK_THRESHOLD = Decimal('50.00')
ALUMNI_FEEDBACK_DEFAULT_DAYS = 15
ALUMNI_FEEDBACK_EXTENSION_DAYS = 5


def _get_alumni_employment_distribution(batch):
    # Get distinct students' employment status from the latest cycle
    cycle = AlumniSurveyCycle.objects.filter(batch=batch, is_active=True).order_by('-created_at').first()
    if not cycle:
        return {}
    # Prefer submission rows so status-only submissions (UNEMPLOYED/HOUSEWIFE) are counted.
    records = cycle.submissions.filter(
        is_active=True,
        employment_status__isnull=False
    ).values('student_id', 'employment_status').distinct()
    if not records.exists():
        records = cycle.responses.filter(
            is_active=True,
            employment_status__isnull=False
        ).values('student_id', 'employment_status').distinct()
    distribution = {}
    for resp in records:
        status = resp['employment_status']
        distribution[status] = distribution.get(status, 0) + 1
    return distribution


def _get_top_employers(batch, limit=10):
    # Get distinct students' organization names
    cycle = AlumniSurveyCycle.objects.filter(batch=batch, is_active=True).order_by('-created_at').first()
    if not cycle:
        return []
    records = cycle.submissions.filter(
        is_active=True,
        organization_name__isnull=False,
        organization_name__gt=''
    ).values('student_id', 'organization_name').distinct()
    if not records.exists():
        records = cycle.responses.filter(
            is_active=True,
            organization_name__isnull=False,
            organization_name__gt=''
        ).values('student_id', 'organization_name').distinct()
    employer_counts = {}
    for resp in records:
        employer = resp['organization_name']
        employer_counts[employer] = employer_counts.get(employer, 0) + 1
    # Sort by count descending, take top 'limit'
    sorted_employers = sorted(employer_counts.items(), key=lambda x: (-x[1], x[0]))
    return [{'name': name, 'count': count} for name, count in sorted_employers[:limit]]


def _add_years(value, years):
    try:
        return value.replace(year=value.year + years)
    except ValueError:
        return value.replace(month=2, day=28, year=value.year + years)


def _get_alumni_feedback_eligible_count(batch):
    return User.objects.filter(
        batch=batch,
        role__iexact='alumni',
        is_active=True
    ).count()


def _get_alumni_feedback_response_count(cycle):
    submission_count = cycle.submissions.filter(is_active=True).values('student_id').distinct().count()
    if submission_count:
        return submission_count
    return cycle.responses.filter(is_active=True).values('student_id').distinct().count()


def _get_alumni_feedback_response_rate(cycle):
    eligible = _get_alumni_feedback_eligible_count(cycle.batch)
    if not eligible:
        return Decimal('0.00')
    responses = _get_alumni_feedback_response_count(cycle)
    return (Decimal(responses) / Decimal(eligible)) * Decimal('100.00')


def _refresh_alumni_feedback_cycle(cycle):
    if cycle.status != 'ACTIVE' or not cycle.is_active:
        return cycle

    response_rate = _get_alumni_feedback_response_rate(cycle)
    now = timezone.now()

    if response_rate >= (cycle.response_threshold or ALUMNI_FEEDBACK_THRESHOLD):
        cycle.status = 'CLOSED'
        cycle.closed_at = now
        cycle.is_active = True
        cycle.save(update_fields=['status', 'closed_at', 'is_active'])
        cycle.batch.alumni_feedback_enabled = False
        cycle.batch.alumni_feedback_due_at = cycle.due_at
        cycle.batch.save(update_fields=['alumni_feedback_enabled', 'alumni_feedback_due_at'])
        return cycle

    if cycle.due_at and now >= cycle.due_at and cycle.auto_extension_count < 1:
        cycle.due_at = cycle.due_at + timedelta(days=cycle.auto_extension_days or ALUMNI_FEEDBACK_EXTENSION_DAYS)
        cycle.auto_extension_count += 1
        cycle.save(update_fields=['due_at', 'auto_extension_count'])
        cycle.batch.alumni_feedback_due_at = cycle.due_at
        cycle.batch.save(update_fields=['alumni_feedback_due_at'])
    elif cycle.due_at and now >= cycle.due_at:
        # No more extensions allowed, close the survey
        cycle.status = 'CLOSED'
        cycle.closed_at = now
        cycle.is_active = True
        cycle.save(update_fields=['status', 'closed_at', 'is_active'])
        cycle.batch.alumni_feedback_enabled = False
        cycle.batch.alumni_feedback_due_at = cycle.due_at
        cycle.batch.save(update_fields=['alumni_feedback_enabled', 'alumni_feedback_due_at'])

    return cycle


def _resolve_due_at(request_data, default_days=ALUMNI_FEEDBACK_DEFAULT_DAYS):
    due_at_raw = request_data.get('due_at')
    duration_days = request_data.get('duration_days')

    if due_at_raw:
        parsed = parse_datetime(due_at_raw)
        if parsed:
            return parsed
    try:
        duration_days = int(duration_days)
    except (TypeError, ValueError):
        duration_days = default_days
    return timezone.now() + timedelta(days=duration_days)


def _ensure_active_alumni_questions_for_program(program):
    """
    Repair helper for legacy records: make sure every active PEO has one
    active locked alumni survey question so the alumni form can render.
    Ensures both legacy AlumniSurveyQuestion and NEW SurveyQuestion exist.
    """
    peos = PEO.objects.filter(program=program, is_active=True).order_by('order_number')
    alumni_template_prefix = "To what extent are you achieving this objective in your current professional role:"

    for peo in peos:
        # --- Legacy AlumniSurveyQuestion ---
        active_legacy = peo.alumni_survey_questions.filter(is_active=True).order_by('-created_at').first()
        if active_legacy:
            if not active_legacy.is_locked:
                active_legacy.is_locked = True
                active_legacy.save(update_fields=['is_locked'])
        else:
            question_text = (
                f"{alumni_template_prefix} {peo.description}"
                if peo.description
                else alumni_template_prefix.rstrip(':')
            )
            AlumniSurveyQuestion.objects.create(
                peo=peo,
                question_text=question_text,
                is_locked=True,
                is_active=True
            )

        # --- NEW SurveyQuestion ---
        peo_template_q = SurveyQuestion.objects.filter(
            peo=peo,
            survey_type=SURVEY_TYPE_ALUMNI,
            is_active=True,
        ).order_by('-created_at').first()
        if not peo_template_q:
            employer_q_text = (
                f"{alumni_template_prefix} {peo.description}"
                if peo.description
                else alumni_template_prefix.rstrip(':')
            )
            SurveyQuestion.objects.create(
                survey_type=SURVEY_TYPE_ALUMNI,
                program=program,
                peo=peo,
                question_text=employer_q_text,
                is_locked=True,
                is_active=True
            )
        elif not peo_template_q.is_locked:
            peo_template_q.is_locked = True
            peo_template_q.save(update_fields=['is_locked'])


class PEOListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, program_id):
        peos = PEO.objects.filter(
            program_id=program_id,
            is_active=True
        )
        serializer = PEOSerializer(peos, many=True)
        return Response(serializer.data)

    def post(self, request, program_id):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can create PEOs'}, status=status.HTTP_403_FORBIDDEN)
            
        print(f"DEBUG: PEO POST request for program_id: {program_id}")
        print(f"DEBUG: Request data: {request.data}")
        alumni_question_text = request.data.get('alumni_survey_question_text')
        data = request.data.copy()
        data['program'] = program_id
        serializer = PEOSerializer(data=data)
        if serializer.is_valid():
            peo = serializer.save(skip_alumni_survey=True)

            question_text = alumni_question_text if alumni_question_text else (
                f"To what extent are you achieving this objective in your current professional role: {peo.description}"
                if peo.description else "To what extent are you achieving this objective in your current professional role"
            )
            AlumniSurveyQuestion.objects.create(
                peo=peo,
                question_text=question_text,
                is_locked=True,
                is_active=True
            )
            return Response(
                PEOSerializer(peo).data,
                status=status.HTTP_201_CREATED
            )
        print(f"DEBUG: PEO Serializer errors: {serializer.errors}")
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


class PEODetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return PEO.objects.get(
                pk=pk, is_active=True
            )
        except PEO.DoesNotExist:
            return None

    def get(self, request, pk):
        peo = self.get_object(pk)
        if not peo:
            return Response(
                {'error': 'Not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        return Response(PEOSerializer(peo).data)

    def patch(self, request, pk):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can update PEOs'}, status=status.HTTP_403_FORBIDDEN)
            
        peo = self.get_object(pk)
        if not peo:
            return Response(
                {'error': 'Not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        alumni_question_text = request.data.get('alumni_survey_question_text')
        description_changed = 'description' in request.data and request.data.get('description') != peo.description
        current_question = peo.alumni_survey_questions.filter(is_active=True).order_by('-created_at').first()
        serializer = PEOSerializer(
            peo, data=request.data, partial=True
        )
        if serializer.is_valid():
            peo = serializer.save(skip_alumni_survey=True)

            current_question_text = current_question.question_text if current_question else None
            should_replace_question = (
                current_question is None
                or (alumni_question_text is not None and alumni_question_text != current_question_text)
                or (alumni_question_text is None and description_changed)
            )

            if should_replace_question:
                AlumniSurveyQuestion.objects.filter(
                    peo=peo,
                    is_active=True
                ).update(is_active=False)

                question_text = alumni_question_text if alumni_question_text else (
                    f"To what extent are you achieving this objective in your current professional role: {peo.description}"
                    if peo.description else "To what extent are you achieving this objective in your current professional role"
                )
                AlumniSurveyQuestion.objects.create(
                    peo=peo,
                    question_text=question_text,
                    is_locked=True,
                    is_active=True
                )

            return Response(PEOSerializer(peo).data)
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    def delete(self, request, pk):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can delete PEOs'}, status=status.HTTP_403_FORBIDDEN)
            
        peo = self.get_object(pk)
        if not peo:
            return Response(
                {'error': 'Not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        peo.is_active = False
        peo.save()
        return Response(
            {'success': True},
            status=status.HTTP_200_OK
        )


class GAPEOMatrixView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, program_id):
        gas = GA.objects.filter(
            program_id=program_id,
            is_active=True
        )
        peos = PEO.objects.filter(
            program_id=program_id,
            is_active=True
        )
        mappings = GAPEOMapping.objects.filter(
            ga__program_id=program_id,
            is_active=True
        )
        return Response({
            'gas': GASerializer(gas, many=True).data,
            'peos': PEOSerializer(
                peos, many=True
            ).data,
            'mappings': GAPEOMappingSerializer(
                mappings, many=True
            ).data
        })

    @transaction.atomic
    def post(self, request, program_id):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can update GA-PO mappings'}, status=status.HTTP_403_FORBIDDEN)
        
        # Delete existing mappings
        GAPEOMapping.objects.filter(
            ga__program_id=program_id
        ).delete()

        mappings_data = request.data.get(
            'mappings', []
        )
        
        # Group mappings by GA for equal weight distribution (per GA row = 100%)
        ga_groups = {}
        for m in mappings_data:
            ga_id = m['ga_id']
            if ga_id not in ga_groups:
                ga_groups[ga_id] = []
            ga_groups[ga_id].append(m)
        
        created = []
        for ga_id, ga_mappings in ga_groups.items():
            n = len(ga_mappings)
            if n == 0:
                continue
            
            # Calculate equal weight default
            equal_weight = (Decimal('100.00') / Decimal(n)).quantize(Decimal('0.01'))
            
            # Process each mapping: use provided weight if explicitly set (>0), else equal
            processed_weights = []
            total_weight = Decimal('0.00')
            for m in ga_mappings:
                provided_weight = m.get('weight')
                try:
                    provided_weight = Decimal(str(provided_weight)) if provided_weight is not None else Decimal('0.00')
                except (InvalidOperation, ValueError):
                    provided_weight = Decimal('0.00')
                
                if provided_weight > Decimal('0.00'):
                    processed_weights.append(provided_weight)
                    total_weight += provided_weight
                else:
                    processed_weights.append(None)  # Marked for default equal
            
            # Fill in equal weights for those not explicitly set
            remaining_slots = sum(1 for w in processed_weights if w is None)
            remaining_total = Decimal('100.00') - total_weight
            
            if remaining_slots > 0 and remaining_total > 0:
                slot_weight = (remaining_total / Decimal(remaining_slots)).quantize(Decimal('0.01'))
                # Distribute and adjust the last one for rounding
                assigned = Decimal('0.00')
                equal_idx = 0
                last_equal_idx = sum(1 for w in processed_weights if w is None) - 1
                for i in range(len(processed_weights)):
                    if processed_weights[i] is None:
                        if equal_idx == last_equal_idx or remaining_slots == 1:
                            processed_weights[i] = (remaining_total - assigned).quantize(Decimal('0.01'))
                        else:
                            processed_weights[i] = slot_weight
                            assigned += slot_weight
                        equal_idx += 1
                        remaining_slots -= 1
            elif remaining_slots > 0:
                # No remaining total: just set to equal
                for i in range(len(processed_weights)):
                    if processed_weights[i] is None:
                        processed_weights[i] = equal_weight
            
            # Now create all mappings for this GA
            for m, final_weight in zip(ga_mappings, processed_weights):
                # Clamp to 0-100 just in case
                final_weight = max(Decimal('0.00'), min(Decimal('100.00'), final_weight))
                mapping = GAPEOMapping.objects.create(
                    ga_id=m['ga_id'],
                    peo_id=m['peo_id'],
                    weight=final_weight
                )
                created.append(mapping)

        return Response(
            GAPEOMappingSerializer(
                created, many=True
            ).data,
            status=status.HTTP_201_CREATED
        )


# ========== ALUMNI SURVEY VIEWS ==========

class PEOAlumniSurveyQuestionListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, peo_id):
        try:
            peo = PEO.objects.get(id=peo_id, is_active=True)
        except PEO.DoesNotExist:
            return Response({'error': 'PO not found'}, status=status.HTTP_404_NOT_FOUND)
        
        has_new = SurveyQuestion.objects.filter(
            peo=peo,
            survey_type=SURVEY_TYPE_ALUMNI,
            is_active=True
        ).exists()
        if not has_new and not peo.alumni_survey_questions.filter(is_active=True).exists():
            _ensure_active_alumni_questions_for_program(peo.program)

        questions = SurveyQuestion.objects.filter(
            peo=peo,
            survey_type=SURVEY_TYPE_ALUMNI,
            is_active=True
        ).order_by('-created_at')
        if questions.exists():
            return Response(SurveyQuestionSerializer(questions, many=True).data)

        legacy = AlumniSurveyQuestion.objects.filter(peo=peo, is_active=True).order_by('-created_at')
        return Response(AlumniSurveyQuestionSerializer(legacy, many=True).data)


class AlumniSurveyQuestionDetailView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get_object(self, pk):
        try:
            return AlumniSurveyQuestion.objects.get(id=pk, is_active=True)
        except AlumniSurveyQuestion.DoesNotExist:
            return None
    
    def get(self, request, pk):
        question = self.get_object(pk)
        if not question:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(AlumniSurveyQuestionSerializer(question).data)
    
    @transaction.atomic
    def patch(self, request, pk):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can update alumni survey questions'}, status=status.HTTP_403_FORBIDDEN)
            
        question = self.get_object(pk)
        if not question:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        
        if question.is_locked and 'is_locked' not in request.data and 'is_active' not in request.data:
            return Response({'error': 'Question is locked and cannot be edited'}, status=status.HTTP_403_FORBIDDEN)
            
        serializer = AlumniSurveyQuestionSerializer(question, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(AlumniSurveyQuestionSerializer(question).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AlumniSurveyCycleListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
            
        cycles = AlumniSurveyCycle.objects.filter(batch=batch, is_active=True).order_by('-created_at')
        for cycle in cycles:
            _refresh_alumni_feedback_cycle(cycle)
        return Response(AlumniSurveyCycleSerializer(cycles, many=True).data)


class AlumniSurveyCycleCreateView(APIView):
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request, batch_id):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_allowed = (
            (user_role == 'coordinator')
            or (user_secondary_role == 'coordinator')
            or (user_role == 'hod')
            or (user_secondary_role == 'hod')
        )
        
        if not is_allowed:
            return Response({'error': 'Only coordinators or HODs can create alumni survey cycles'}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
        survey_window = request.data.get('survey_window')
        if not survey_window:
            return Response({'error': 'survey_window is required'}, status=status.HTTP_400_BAD_REQUEST)

        due_at = _resolve_due_at(request.data)
        
        # Check if there's already an active cycle for this window
        active_cycle = AlumniSurveyCycle.objects.filter(
            batch=batch, 
            survey_window=survey_window, 
            status='ACTIVE', 
            is_active=True
        ).first()
        if active_cycle:
            return Response({'error': 'There is already an active alumni survey cycle for this window and batch'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Create new cycle
        cycle = AlumniSurveyCycle.objects.create(
            batch=batch,
            survey_window=survey_window,
            status='DRAFT',
            due_at=due_at
        )
        batch.alumni_feedback_due_at = due_at
        batch.save(update_fields=['alumni_feedback_due_at'])
        
        return Response(AlumniSurveyCycleSerializer(cycle).data, status=status.HTTP_201_CREATED)


class AlumniSurveyCycleActivateView(APIView):
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request, cycle_id):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_allowed = (
            (user_role == 'coordinator')
            or (user_secondary_role == 'coordinator')
            or (user_role == 'hod')
            or (user_secondary_role == 'hod')
        )
        
        if not is_allowed:
            return Response({'error': 'Only coordinators or HODs can activate alumni surveys'}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            cycle = AlumniSurveyCycle.objects.get(id=cycle_id, is_active=True)
        except AlumniSurveyCycle.DoesNotExist:
            return Response({'error': 'Cycle not found'}, status=status.HTTP_404_NOT_FOUND)
            
        if cycle.status != 'DRAFT':
            return Response({'error': 'Only draft cycles can be activated'}, status=status.HTTP_400_BAD_REQUEST)
            
        new_questions = SurveyQuestion.objects.filter(
            survey_type=SURVEY_TYPE_ALUMNI,
            program=cycle.batch.program,
            is_locked=True,
            is_active=True
        )
        legacy_questions = AlumniSurveyQuestion.objects.filter(
            peo__program=cycle.batch.program,
            is_locked=True,
            is_active=True
        )
        if not new_questions.exists() and not legacy_questions.exists():
            return Response({'error': 'No locked alumni survey questions found for this program'}, status=status.HTTP_400_BAD_REQUEST)

        if not cycle.due_at:
            cycle.due_at = _resolve_due_at({}, default_days=ALUMNI_FEEDBACK_DEFAULT_DAYS)
            
        # Activate the cycle
        cycle.status = 'ACTIVE'
        cycle.activated_by = request.user
        cycle.activated_at = timezone.now()
        cycle.save()
        cycle.batch.alumni_feedback_due_at = cycle.due_at
        cycle.batch.save(update_fields=['alumni_feedback_due_at'])
        
        return Response(AlumniSurveyCycleSerializer(cycle).data)


class AlumniSurveyCycleCloseView(APIView):
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request, cycle_id):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_allowed = (
            (user_role == 'coordinator')
            or (user_secondary_role == 'coordinator')
            or (user_role == 'hod')
            or (user_secondary_role == 'hod')
        )
        
        if not is_allowed:
            return Response({'error': 'Only coordinators or HODs can close alumni surveys'}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            cycle = AlumniSurveyCycle.objects.get(id=cycle_id, is_active=True)
        except AlumniSurveyCycle.DoesNotExist:
            return Response({'error': 'Cycle not found'}, status=status.HTTP_404_NOT_FOUND)
            
        if cycle.status != 'ACTIVE':
            return Response({'error': 'Only active cycles can be closed'}, status=status.HTTP_400_BAD_REQUEST)
            
        cycle.status = 'CLOSED'
        cycle.closed_at = timezone.now()
        cycle.save()
        cycle.batch.alumni_feedback_enabled = False
        cycle.batch.alumni_feedback_due_at = cycle.due_at
        cycle.batch.save(update_fields=['alumni_feedback_enabled', 'alumni_feedback_due_at'])
        
        return Response(AlumniSurveyCycleSerializer(cycle).data)


class BatchToggleAlumniFeedbackView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, batch_id):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_allowed = (
            (user_role == 'hod')
            or (user_secondary_role == 'hod')
            or (user_role == 'coordinator')
            or (user_secondary_role == 'coordinator')
        )

        if not is_allowed:
            return Response({'error': 'Only coordinators or HODs can manage alumni feedback'}, status=status.HTTP_403_FORBIDDEN)

        try:
            batch = Batch.objects.select_for_update().get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)

        active_cycle = AlumniSurveyCycle.objects.filter(
            batch=batch,
            survey_window='2_YEARS',
            is_active=True
        ).order_by('-created_at').first()

        if batch.alumni_feedback_enabled:
            if active_cycle:
                _refresh_alumni_feedback_cycle(active_cycle)
                response_rate = _get_alumni_feedback_response_rate(active_cycle)
                if active_cycle.status == 'ACTIVE' and response_rate < (active_cycle.response_threshold or ALUMNI_FEEDBACK_THRESHOLD):
                    return Response(
                        {'error': 'Alumni feedback cannot be disabled until response rate reaches 50%'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                active_cycle.status = 'CLOSED'
                active_cycle.closed_at = timezone.now()
                active_cycle.save(update_fields=['status', 'closed_at'])

            batch.alumni_feedback_enabled = False
            if active_cycle and active_cycle.due_at:
                batch.alumni_feedback_due_at = active_cycle.due_at
            batch.save(update_fields=['alumni_feedback_enabled', 'alumni_feedback_due_at'])
            return Response({
                'alumni_feedback_enabled': False,
                'alumni_feedback_enabled_at': batch.alumni_feedback_enabled_at,
                'cycle': AlumniSurveyCycleSerializer(active_cycle).data if active_cycle else None,
            })

        # Check if there's already a closed cycle for this survey window
        closed_cycle = AlumniSurveyCycle.objects.filter(
            batch=batch,
            survey_window='2_YEARS',
            status='CLOSED',
            is_active=True
        ).order_by('-created_at').first()
        if closed_cycle:
            return Response(
                {'error': 'Alumni survey for this window has already been closed and cannot be re-enabled.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        due_at = _resolve_due_at(request.data)

        if active_cycle and active_cycle.status == 'DRAFT':
            active_cycle.status = 'ACTIVE'
            active_cycle.activated_by = request.user
            active_cycle.activated_at = timezone.now()
            active_cycle.due_at = due_at
            active_cycle.save(update_fields=['status', 'activated_by', 'activated_at', 'due_at'])
            cycle = active_cycle
        elif active_cycle and active_cycle.status == 'ACTIVE':
            active_cycle.due_at = due_at
            active_cycle.save(update_fields=['due_at'])
            cycle = active_cycle
        else:
            cycle = AlumniSurveyCycle.objects.create(
                batch=batch,
                survey_window='2_YEARS',
                status='ACTIVE',
                activated_by=request.user,
                activated_at=timezone.now(),
                due_at=due_at
            )

        batch.alumni_feedback_enabled = True
        batch.alumni_feedback_enabled_at = timezone.now()
        batch.alumni_feedback_due_at = due_at
        batch.save(update_fields=['alumni_feedback_enabled', 'alumni_feedback_enabled_at', 'alumni_feedback_due_at'])

        return Response({
            'alumni_feedback_enabled': True,
            'alumni_feedback_enabled_at': batch.alumni_feedback_enabled_at,
            'cycle': AlumniSurveyCycleSerializer(cycle).data,
        })


class AlumniSurveyResponseView(APIView):
    permission_classes = []
    
    def get(self, request, cycle_id):
        try:
            cycle = AlumniSurveyCycle.objects.get(id=cycle_id, status='ACTIVE', is_active=True)
        except AlumniSurveyCycle.DoesNotExist:
            return Response({'error': 'Active cycle not found'}, status=status.HTTP_404_NOT_FOUND)

        _refresh_alumni_feedback_cycle(cycle)
        if cycle.status != 'ACTIVE':
            return Response({'error': 'Active cycle not found'}, status=status.HTTP_404_NOT_FOUND)

        _ensure_active_alumni_questions_for_program(cycle.batch.program)
             
        new_questions = SurveyQuestion.objects.filter(
            survey_type=SURVEY_TYPE_ALUMNI,
            is_active=True,
        ).filter(
            Q(program=cycle.batch.program) | Q(program__isnull=True)
        ).select_related('peo').order_by('peo__order_number', 'created_at')
        if new_questions.exists():
            # Move general (peo is null) questions to the front
            q_list = list(new_questions)
            general = [q for q in q_list if q.peo_id is None]
            peo_mapped = [q for q in q_list if q.peo_id is not None]
            ordered_qs = general + peo_mapped
            return Response(SurveyQuestionSerializer(ordered_qs, many=True).data)

        legacy = AlumniSurveyQuestion.objects.filter(
            peo__program=cycle.batch.program,
            is_locked=True,
            is_active=True
        )
        return Response(AlumniSurveyQuestionSerializer(legacy, many=True).data)
    
    @transaction.atomic
    def post(self, request, cycle_id, student_id):
        try:
            cycle = AlumniSurveyCycle.objects.get(id=cycle_id, status='ACTIVE', is_active=True)
            student = (
                Student.objects.filter(user_id=student_id).first()
                or Student.objects.filter(student_id=student_id).first()
                or Student.objects.filter(custom_id=student_id).first()
            )
            if not student:
                raise Student.DoesNotExist
        except (AlumniSurveyCycle.DoesNotExist, Student.DoesNotExist):
            return Response({'error': 'Cycle or student not found'}, status=status.HTTP_404_NOT_FOUND)

        _refresh_alumni_feedback_cycle(cycle)
        if cycle.status != 'ACTIVE':
            return Response({'error': 'Alumni feedback is closed'}, status=status.HTTP_400_BAD_REQUEST)

        existing_submission = (
            AlumniSurveyResponse.objects.filter(cycle=cycle, student=student, is_active=True).exists()
            or AlumniSurveySubmission.objects.filter(cycle=cycle, student=student, is_active=True).exists()
        )
        if existing_submission:
            return Response({'error': 'Alumni survey already submitted'}, status=status.HTTP_400_BAD_REQUEST)
            
        responses_data = request.data.get('responses', [])
        employment_status = request.data.get('employment_status')
        organization_name = request.data.get('organization_name')
        current_designation = request.data.get('current_designation')
        employer_contact_name = (request.data.get('employer_contact_name') or '').strip()
        employer_contact_email = (
            request.data.get('employer_contact_email')
            or request.data.get('employer_email')
            or ''
        )
        employer_contact_email = str(employer_contact_email).strip().lower()

        # --- Higher Studies details ---
        higher_studies_university = (request.data.get('higher_studies_university') or '').strip() or None
        higher_studies_degree = (request.data.get('higher_studies_degree') or '').strip() or None
        higher_studies_country = (request.data.get('higher_studies_country') or '').strip() or None

        submission, _ = AlumniSurveySubmission.objects.update_or_create(
            cycle=cycle,
            student=student,
            defaults={
                'employment_status': employment_status or None,
                'organization_name': organization_name or None,
                'current_designation': current_designation or None,
                'employer_contact_name': employer_contact_name or None,
                'employer_contact_email': employer_contact_email or None,
                'higher_studies_university': higher_studies_university,
                'higher_studies_degree': higher_studies_degree,
                'higher_studies_country': higher_studies_country,
                'is_active': True,
            },
        )
        
        # Save employment status on the first legacy response to keep it consistent
        first_legacy_saved = False
        saved_any_new = False
        for resp_data in responses_data:
            question_id = resp_data.get('question')
            score = resp_data.get('score')
            selected_option_label = resp_data.get('selected_option_label')
            text_answer = resp_data.get('text_answer')

            # --- NEW: save to AlumniSurveyAnswer using SurveyQuestion (primary path) ---
            try:
                sq = SurveyQuestion.objects.get(id=question_id, is_active=True)
                answer_defaults = {
                    'score': None,
                    'selected_option_label': selected_option_label if selected_option_label else None,
                    'text_answer': text_answer if text_answer else None,
                    'is_active': True,
                }
                if sq.question_type == QUESTION_TYPE_TEXT:
                    pass
                else:
                    # RATING_SCALE or SINGLE_SELECT -> save score if provided (1-based option index)
                    try:
                        score_int = int(score)
                        if 1 <= score_int <= 5:
                            answer_defaults['score'] = score_int
                        elif score_int > 0:
                            # preserve score number even if > 5 (optional large scales)
                            answer_defaults['score'] = score_int
                    except (ValueError, TypeError):
                        pass
                    # Save selected_option_label explicitly even if score provided (for custom option text fidelity)
                    if selected_option_label:
                        answer_defaults['selected_option_label'] = str(selected_option_label)

                AlumniSurveyAnswer.objects.update_or_create(
                    submission=submission,
                    question=sq,
                    defaults=answer_defaults,
                )
                saved_any_new = True
            except SurveyQuestion.DoesNotExist:
                pass

            # --- LEGACY: save to AlumniSurveyResponse using AlumniSurveyQuestion (compat) ---
            try:
                question = AlumniSurveyQuestion.objects.get(id=question_id, is_locked=True, is_active=True)
            except AlumniSurveyQuestion.DoesNotExist:
                try:
                    sq_match = SurveyQuestion.objects.get(id=question_id, is_active=True)
                    if sq_match.peo_id:
                        question = AlumniSurveyQuestion.objects.filter(
                            peo_id=sq_match.peo_id,
                            is_locked=True,
                            is_active=True
                        ).order_by('-created_at').first()
                    else:
                        question = None
                except SurveyQuestion.DoesNotExist:
                    question = None
            if question is None:
                continue
                
            # Legacy compat: best-effort numeric score or default to 3 midpoint
            try:
                legacy_score = int(score)
            except (ValueError, TypeError):
                legacy_score = 3 if text_answer or selected_option_label else None
            if legacy_score is None:
                continue

            update_dict = {'score': legacy_score}
            if not first_legacy_saved:
                if employment_status:
                    update_dict['employment_status'] = employment_status
                if organization_name:
                    update_dict['organization_name'] = organization_name
                if current_designation:
                    update_dict['current_designation'] = current_designation
                first_legacy_saved = True
                
            AlumniSurveyResponse.objects.update_or_create(
                cycle=cycle,
                student=student,
                question=question,
                defaults=update_dict
            )

        if not saved_any_new and not first_legacy_saved and responses_data:
            return Response({'error': 'No valid survey questions matched the submission.'}, status=status.HTTP_400_BAD_REQUEST)

        _refresh_alumni_feedback_cycle(cycle)
        employer_email_summary = None
        if (
            employment_status in ('EMPLOYED', 'SELF_EMPLOYED')
            and employer_contact_email
        ):
            employer_cycle, _ = EmployerSurveyCycle.objects.get_or_create(
                batch=cycle.batch,
                linked_alumni_cycle=cycle,
                survey_window=cycle.survey_window,
                is_active=True,
                defaults={
                    'status': 'ACTIVE',
                    'due_at': cycle.due_at,
                    'response_threshold': Decimal('30.00'),
                    'auto_extension_days': 2,
                    'activated_at': timezone.now(),
                },
            )
            if employer_cycle.status != 'ACTIVE':
                employer_cycle.status = 'ACTIVE'
                employer_cycle.activated_at = employer_cycle.activated_at or timezone.now()
                employer_cycle.save(update_fields=['status', 'activated_at'])

            token_summary = generate_employer_survey_tokens_for_cycle(str(employer_cycle.id))
            dispatch_summary = dispatch_employer_survey_emails(
                str(employer_cycle.id),
                request=request,
            )
            employer_email_summary = {
                **dispatch_summary,
                'created': token_summary.get('created', 0),
                'skipped_duplicate': token_summary.get('skipped_duplicate', 0),
                'missing_email': token_summary.get('missing_email', 0),
                'total_seeds': token_summary.get('total_seeds', 0),
            }

        return Response({'success': True, 'employer_email': employer_email_summary})


def _can_manage_employer_surveys(user):
    role = getattr(user, 'role', '')
    secondary_role = getattr(user, 'secondary_role', '')
    return role in ('hod', 'coordinator', 'admin') or secondary_role in ('hod', 'coordinator', 'admin')


class EmployerSurveyCycleListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        if not _can_manage_employer_surveys(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        cycles = EmployerSurveyCycle.objects.filter(
            batch_id=batch_id,
            is_active=True,
        ).select_related('batch', 'linked_alumni_cycle').order_by('-created_at')
        return Response(EmployerSurveyCycleSerializer(cycles, many=True).data)


class EmployerSurveyCycleCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _can_manage_employer_surveys(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data.copy()
        batch_id = data.get('batch')
        if not batch_id:
            return Response({'error': 'batch is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)

        linked_alumni_cycle = None
        linked_alumni_cycle_id = data.get('linked_alumni_cycle')
        if linked_alumni_cycle_id:
            linked_alumni_cycle = AlumniSurveyCycle.objects.filter(
                id=linked_alumni_cycle_id,
                batch=batch,
                is_active=True,
            ).first()

        if linked_alumni_cycle is None:
            linked_alumni_cycle = AlumniSurveyCycle.objects.filter(
                batch=batch,
                survey_window=data.get('survey_window') or '2_YEARS',
                is_active=True,
            ).order_by('-created_at').first()

        cycle = EmployerSurveyCycle.objects.create(
            batch=batch,
            linked_alumni_cycle=linked_alumni_cycle,
            survey_window=data.get('survey_window') or '2_YEARS',
            status=data.get('status') or 'DRAFT',
            due_at=_resolve_due_at(data, default_days=ALUMNI_FEEDBACK_DEFAULT_DAYS),
            response_threshold=data.get('response_threshold') or Decimal('30.00'),
            auto_extension_days=data.get('auto_extension_days') or 2,
            activated_by=request.user if (data.get('status') == 'ACTIVE') else None,
            activated_at=timezone.now() if (data.get('status') == 'ACTIVE') else None,
        )
        return Response(EmployerSurveyCycleSerializer(cycle).data, status=status.HTTP_201_CREATED)


class EmployerSurveyCycleGenerateTokensView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, cycle_id):
        if not _can_manage_employer_surveys(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        try:
            summary = generate_employer_survey_tokens_for_cycle(str(cycle_id))
        except EmployerSurveyCycle.DoesNotExist:
            return Response({'error': 'Employer survey cycle not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(summary)


class EmployerSurveyCycleDispatchEmailsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, cycle_id):
        if not _can_manage_employer_surveys(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        try:
            EmployerSurveyCycle.objects.get(id=cycle_id, is_active=True)
        except EmployerSurveyCycle.DoesNotExist:
            return Response({'error': 'Employer survey cycle not found'}, status=status.HTTP_404_NOT_FOUND)

        token_summary = generate_employer_survey_tokens_for_cycle(str(cycle_id))
        email_summary = dispatch_employer_survey_emails(
            str(cycle_id),
            request=request,
            frontend_base_url=request.data.get('frontend_base_url') if isinstance(request.data, dict) else None,
        )
        return Response({
            **email_summary,
            'created': token_summary.get('created', 0),
            'skipped_duplicate': token_summary.get('skipped_duplicate', 0),
            'missing_email': token_summary.get('missing_email', 0),
            'total_seeds': token_summary.get('total_seeds', 0),
        })


class EmployerSurveyCycleResponsesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, cycle_id):
        if not _can_manage_employer_surveys(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        try:
            EmployerSurveyCycle.objects.get(id=cycle_id, is_active=True)
        except EmployerSurveyCycle.DoesNotExist:
            return Response({'error': 'Employer survey cycle not found'}, status=status.HTTP_404_NOT_FOUND)

        responses = EmployerSurveyResponse.objects.filter(
            cycle_id=cycle_id,
        ).select_related(
            'cycle', 'alumni_student', 'alumni_survey_submission',
        ).prefetch_related('answers', 'answers__question').order_by('-created_at')
        return Response(EmployerSurveyResponseSerializer(responses, many=True).data)


class EmployerSurveyPublicView(APIView):
    authentication_classes = []
    permission_classes = []

    def get_response(self, token):
        return EmployerSurveyResponse.objects.filter(
            response_token=token,
        ).select_related('cycle', 'cycle__batch', 'cycle__batch__program').first()

    def get(self, request, token):
        response_obj = self.get_response(token)
        if response_obj is None:
            return Response({'valid': False, 'message': 'Survey link not found'}, status=status.HTTP_404_NOT_FOUND)
        has_answers = response_obj.answers.filter(is_active=True).exists()
        if has_answers and (response_obj.submitted_at is not None or response_obj.token_used_at is not None):
            return Response({'valid': False, 'message': 'This survey link has already been used'}, status=status.HTTP_409_CONFLICT)
        if has_answers and not response_obj.is_active:
            return Response({'valid': False, 'message': 'This survey link is no longer active'}, status=status.HTTP_410_GONE)

        questions_qs = SurveyQuestion.objects.filter(
            survey_type='EMPLOYER',
            is_active=True,
        ).filter(
            Q(program=response_obj.cycle.batch.program) | Q(program__isnull=True)
        ).select_related('peo').order_by('peo__order_number', 'created_at')

        q_list = list(questions_qs)
        general = [q for q in q_list if q.peo_id is None]
        peo_mapped = [q for q in q_list if q.peo_id is not None]
        questions = general + peo_mapped

        return Response({
            'valid': True,
            'employer_email': response_obj.employer_email,
            'employer_organization': response_obj.employer_organization,
            'employee_name_at_org': response_obj.employee_name_at_org,
            'questions': SurveyQuestionSerializer(questions, many=True).data,
        })

    def post(self, request, token):
        try:
            result = submit_employer_survey_by_token(
                str(token),
                request.data.get('answers', []),
                request.data.get('additional_feedback'),
            )
            return Response(result, status=status.HTTP_201_CREATED)
        except LookupError as exc:
            return Response({'message': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except PermissionError as exc:
            return Response({'message': str(exc)}, status=status.HTTP_409_CONFLICT)


class AlumniSurveyStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'enabled': False, 'submitted': False}, status=status.HTTP_404_NOT_FOUND)

        cycle = AlumniSurveyCycle.objects.filter(
            batch=batch,
            survey_window='2_YEARS',
            is_active=True
        ).order_by('-created_at').first()

        if cycle:
            _refresh_alumni_feedback_cycle(cycle)
            if cycle.status != 'ACTIVE':
                cycle = None

        student = (
            getattr(request.user, 'student_profile', None)
            or Student.objects.filter(user=request.user).first()
        )
        if not student:
            student_ref = request.query_params.get('student_id')
            if student_ref:
                student = (
                    Student.objects.filter(student_id=student_ref).first()
                    or Student.objects.filter(custom_id=student_ref).first()
                    or Student.objects.filter(registration_number=student_ref).first()
                    or Student.objects.filter(user_id=student_ref).first()
                )

        submitted = False
        if cycle and student:
            submitted = (
                AlumniSurveySubmission.objects.filter(cycle=cycle, student=student, is_active=True).exists()
                or AlumniSurveyResponse.objects.filter(cycle=cycle, student=student, is_active=True).exists()
            )

        return Response({
            'enabled': bool(batch.alumni_feedback_enabled),
            'submitted': submitted,
            'cycle_id': str(cycle.id) if cycle else None,
            'response_count': _get_alumni_feedback_response_count(cycle) if cycle else 0,
            'eligible_alumni_count': _get_alumni_feedback_eligible_count(batch),
            'response_rate': float(_get_alumni_feedback_response_rate(cycle)) if cycle else 0,
        })


class AlumniEmploymentStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
        employment_distribution = _get_alumni_employment_distribution(batch)
        top_employers = _get_top_employers(batch)
        
        return Response({
            'employment_distribution': employment_distribution,
            'top_employers': top_employers
        })


class PEOIndirectScoreView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, peo_id, batch_id):
        try:
            peo = PEO.objects.get(id=peo_id, is_active=True)
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except (PEO.DoesNotExist, Batch.DoesNotExist):
            return Response({'error': 'PO or Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
        survey_window = request.query_params.get('survey_window')
        indirect_score_data = get_peo_indirect_score(peo_id, batch_id, survey_window)
        return Response(indirect_score_data)


class PEOReportView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
        peo_reports = calculate_all_peo_reports(batch)
        return Response(peo_reports)


class PEOCQIListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can view PO CQI records'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get batch_id from query params if provided
        batch_id = request.query_params.get('batch_id')
        if batch_id:
            cqi_records = PEOCQIRecord.objects.filter(batch_id=batch_id)
        else:
            cqi_records = PEOCQIRecord.objects.all()
        
        return Response(PEOCQIRecordSerializer(cqi_records, many=True).data)


class PEOCQIDetailView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, cqi_id):
        try:
            cqi = PEOCQIRecord.objects.get(id=cqi_id)
        except PEOCQIRecord.DoesNotExist:
            return Response({'error': 'PO CQI record not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(PEOCQIRecordSerializer(cqi).data)
    
    @transaction.atomic
    def patch(self, request, cqi_id):
        try:
            cqi = PEOCQIRecord.objects.get(id=cqi_id)
        except PEOCQIRecord.DoesNotExist:
            return Response({'error': 'PO CQI record not found'}, status=status.HTTP_404_NOT_FOUND)
        
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can update PO CQI records'}, status=status.HTTP_403_FORBIDDEN)
        
        if cqi.is_locked:
            return Response({'error': 'This PO CQI record is locked and cannot be updated'}, status=status.HTTP_403_FORBIDDEN)
        
        # Save history if there are changes to root_cause or remedial_plan
        if 'root_cause' in request.data or 'remedial_plan' in request.data:
            PEOCQISubmissionHistory.objects.create(
                cqi_record=cqi,
                root_cause_snapshot=cqi.root_cause,
                remedial_plan_snapshot=cqi.remedial_plan,
                status_at_time=cqi.status
            )
        
        serializer = PEOCQIRecordSerializer(cqi, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PEOCQISubmitView(APIView):
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request, cqi_id):
        try:
            cqi = PEOCQIRecord.objects.get(id=cqi_id)
        except PEOCQIRecord.DoesNotExist:
            return Response({'error': 'PO CQI record not found'}, status=status.HTTP_404_NOT_FOUND)
        
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can submit PO CQI records'}, status=status.HTTP_403_FORBIDDEN)
        
        if cqi.is_locked:
            return Response({'error': 'This PO CQI record is locked and cannot be submitted'}, status=status.HTTP_403_FORBIDDEN)
        
        # Save history
        PEOCQISubmissionHistory.objects.create(
            cqi_record=cqi,
            root_cause_snapshot=cqi.root_cause,
            remedial_plan_snapshot=cqi.remedial_plan,
            status_at_time=cqi.status
        )
        
        cqi.status = 'APPROVED'
        cqi.submitted_by = request.user
        cqi.is_locked = True
        cqi.save()
        
        return Response(PEOCQIRecordSerializer(cqi).data)


class PEOCQICreateView(APIView):
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can create PO CQI records'}, status=status.HTTP_403_FORBIDDEN)
        
        peo_id = request.data.get('peo')
        batch_id = request.data.get('batch')
        
        try:
            peo = PEO.objects.get(id=peo_id)
            batch = Batch.objects.get(id=batch_id)
        except (PEO.DoesNotExist, Batch.DoesNotExist):
            return Response({'error': 'PO or Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if program end ready
        if not batch.is_program_end_ready:
            return Response({'error': 'Program not yet complete - PO CQI not available until all semesters finish'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get or create existing record
        cqi, created = PEOCQIRecord.objects.get_or_create(
            peo=peo,
            batch=batch
        )
        
        if not created and cqi.is_locked:
            return Response({'error': 'This PO CQI record is locked and cannot be updated'}, status=status.HTTP_403_FORBIDDEN)
        
        if not created:
            # Save history
            PEOCQISubmissionHistory.objects.create(
                cqi_record=cqi,
                root_cause_snapshot=cqi.root_cause,
                remedial_plan_snapshot=cqi.remedial_plan,
                status_at_time=cqi.status
            )
        
        # Calculate attainment value if not provided
        if 'attainment_value' not in request.data:
            peo_result = calculate_peo_report(peo, batch)
            if peo_result and peo_result['final_score'] is not None:
                request.data['attainment_value'] = peo_result['final_score']
        
        if 'kpi_threshold_at_trigger' not in request.data:
            request.data['kpi_threshold_at_trigger'] = peo.kpi_threshold
        
        serializer = PEOCQIRecordSerializer(cqi, data=request.data, partial=not created)
        if serializer.is_valid():
            serializer.save()
            return Response(PEOCQIRecordSerializer(cqi).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PEOCQIHistoryView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, cqi_id):
        try:
            cqi = PEOCQIRecord.objects.get(id=cqi_id)
        except PEOCQIRecord.DoesNotExist:
            return Response({'error': 'PO CQI record not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(PEOCQISubmissionHistorySerializer(cqi.history.all(), many=True).data)


# ========== FLEXIBLE SurveyQuestion (Alumni + Employer) VIEWS ==========

class ProgramSurveyQuestionListView(APIView):
    """List all SurveyQuestions for a program. Filter by ?survey_type=ALUMNI/EMPLOYER or ?peo_id=<uuid>.
    Authenticated users (including alumni/students) can always read ALUMNI questions for their program.
    Only HOD / coordinator / admin / teacher can read EMPLOYER or unfiltered lists."""
    permission_classes = [IsAuthenticated]

    def get(self, request, program_id):
        user_role = getattr(request.user, 'role', '')
        user_secondary_role = getattr(request.user, 'secondary_role', '')
        is_staff = (user_role in ('hod', 'coordinator', 'admin', 'teacher')
                    or user_secondary_role in ('hod', 'coordinator', 'admin', 'teacher'))

        qs = SurveyQuestion.objects.filter(program_id=program_id)
        survey_type = request.query_params.get('survey_type')
        peo_id = request.query_params.get('peo_id')
        general = request.query_params.get('general')

        if not is_staff:
            # Alumni / students can read only ALUMNI-type questions
            if survey_type and survey_type != SURVEY_TYPE_ALUMNI:
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
            survey_type = SURVEY_TYPE_ALUMNI

        if survey_type:
            qs = qs.filter(survey_type=survey_type)
        if peo_id:
            qs = qs.filter(peo_id=peo_id)
        if general in ('1', 'true', 'True'):
            qs = qs.filter(peo__isnull=True)
        elif general in ('0', 'false', 'False'):
            qs = qs.filter(peo__isnull=False)

        items = list(qs.select_related('peo').order_by('peo__order_number', 'created_at'))
        general_items = [q for q in items if q.peo_id is None]
        peo_items = [q for q in items if q.peo_id is not None]
        ordered = general_items + peo_items

        return Response(SurveyQuestionSerializer(ordered, many=True).data)


class SurveyQuestionListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_role = getattr(request.user, 'role', '')
        user_secondary_role = getattr(request.user, 'secondary_role', '')
        if user_role not in ('hod', 'coordinator', 'admin', 'teacher') and user_secondary_role not in ('hod', 'coordinator', 'admin', 'teacher'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        qs = SurveyQuestion.objects.all()
        survey_type = request.query_params.get('survey_type')
        if survey_type:
            qs = qs.filter(survey_type=survey_type)
        return Response(SurveyQuestionSerializer(qs, many=True).data)

    def post(self, request):
        user_role = getattr(request.user, 'role', '')
        user_secondary_role = getattr(request.user, 'secondary_role', '')
        is_hod = user_role == 'hod' or user_secondary_role == 'hod'
        is_coord = user_role == 'coordinator' or user_secondary_role == 'coordinator'
        if not (is_hod or is_coord or user_role == 'admin'):
            return Response({'error': 'Only HODs or coordinators can create survey questions'}, status=status.HTTP_403_FORBIDDEN)

        payload = request.data
        survey_type = payload.get('survey_type') if payload else None
        if survey_type not in ('ALUMNI', 'EMPLOYER'):
            return Response({'error': 'survey_type must be ALUMNI or EMPLOYER'}, status=status.HTTP_400_BAD_REQUEST)
        if not payload.get('program'):
            return Response({'error': 'program is required'}, status=status.HTTP_400_BAD_REQUEST)
        q_text = payload.get('question_text') or ''
        if not str(q_text).strip():
            return Response({'error': 'question_text is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            serializer = SurveyQuestionSerializer(data=payload)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response(
                {'error': f'Failed to create survey question: {exc.__class__.__name__}: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class SurveyQuestionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return SurveyQuestion.objects.get(pk=pk)
        except SurveyQuestion.DoesNotExist:
            return None

    def get(self, request, pk):
        obj = self.get_object(pk)
        if not obj:
            return Response({'error': 'Survey question not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(SurveyQuestionSerializer(obj).data)

    def patch(self, request, pk):
        user_role = getattr(request.user, 'role', '')
        user_secondary_role = getattr(request.user, 'secondary_role', '')
        is_hod = user_role == 'hod' or user_secondary_role == 'hod'
        is_coord = user_role == 'coordinator' or user_secondary_role == 'coordinator'
        if not (is_hod or is_coord or user_role == 'admin'):
            return Response({'error': 'Only HODs or coordinators can update survey questions'}, status=status.HTTP_403_FORBIDDEN)

        obj = self.get_object(pk)
        if not obj:
            return Response({'error': 'Survey question not found'}, status=status.HTTP_404_NOT_FOUND)

        allowed_fields = {
            'question_text',
            'question_type',
            'custom_options',
            'is_locked',
            'is_active',
            'peo',
            'survey_type',
            'program',
        }
        payload = request.data or {}
        data = {k: v for k, v in payload.items() if k in allowed_fields}
        try:
            serializer = SurveyQuestionSerializer(obj, data=data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response(
                {'error': f'Failed to update survey question: {exc.__class__.__name__}: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def delete(self, request, pk):
        user_role = getattr(request.user, 'role', '')
        user_secondary_role = getattr(request.user, 'secondary_role', '')
        is_hod = user_role == 'hod' or user_secondary_role == 'hod'
        is_coord = user_role == 'coordinator' or user_secondary_role == 'coordinator'
        if not (is_hod or is_coord or user_role == 'admin'):
            return Response({'error': 'Only HODs or coordinators can delete survey questions'}, status=status.HTTP_403_FORBIDDEN)

        obj = self.get_object(pk)
        if not obj:
            return Response({'error': 'Survey question not found'}, status=status.HTTP_404_NOT_FOUND)
        # Soft delete by default
        obj.is_active = False
        obj.save(update_fields=['is_active', 'updated_at'])
        return Response({'success': True})


class SurveyQuestionLockView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user_role = getattr(request.user, 'role', '')
        user_secondary_role = getattr(request.user, 'secondary_role', '')
        is_hod = user_role == 'hod' or user_secondary_role == 'hod'
        if not (is_hod or user_role == 'admin'):
            return Response({'error': 'Only HODs can lock survey questions'}, status=status.HTTP_403_FORBIDDEN)

        try:
            obj = SurveyQuestion.objects.get(pk=pk)
        except SurveyQuestion.DoesNotExist:
            return Response({'error': 'Survey question not found'}, status=status.HTTP_404_NOT_FOUND)
        obj.is_locked = True
        obj.save(update_fields=['is_locked', 'updated_at'])
        return Response(SurveyQuestionSerializer(obj).data)


class PEOCQICloseView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, cqi_id):
        try:
            cqi = PEOCQIRecord.objects.get(id=cqi_id)
        except PEOCQIRecord.DoesNotExist:
            return Response({'error': 'PO-CQI not found'}, status=status.HTTP_404_NOT_FOUND)

        user_role = getattr(request.user, 'role', '')
        user_secondary_role = getattr(request.user, 'secondary_role', '')
        is_hod = user_role == 'hod' or user_secondary_role == 'hod'
        if not is_hod:
            return Response({'error': 'Only HODs can close PO-CQI records'}, status=status.HTTP_403_FORBIDDEN)

        if cqi.status == 'CLOSED_IMPLEMENTED':
            return Response({'error': 'This PO-CQI record is already closed'}, status=status.HTTP_400_BAD_REQUEST)

        implemented_in_batch_id = request.data.get('implemented_in_batch')
        action_taken_description = request.data.get('action_taken_description', '')

        if not implemented_in_batch_id:
            return Response(
                {'error': 'implemented_in_batch is mandatory'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not action_taken_description or not str(action_taken_description).strip():
            return Response(
                {'error': 'action_taken_description is mandatory'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            impl_batch = Batch.objects.get(id=implemented_in_batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Implementation batch not found'}, status=status.HTTP_404_NOT_FOUND)

        peo_result = calculate_peo_report(cqi.peo, impl_batch)
        resulting_attainment = None
        if peo_result and peo_result.get('final_score') is not None:
            resulting_attainment = round(Decimal(str(peo_result['final_score'])), 2)

        PEOCQISubmissionHistory.objects.create(
            cqi_record=cqi,
            root_cause_snapshot=cqi.root_cause,
            remedial_plan_snapshot=cqi.remedial_plan,
            status_at_time=cqi.status
        )

        cqi.implemented_in_batch = impl_batch
        cqi.action_taken_description = action_taken_description.strip()
        cqi.resulting_attainment = resulting_attainment
        cqi.closed_by = request.user
        cqi.closed_at = timezone.now()
        cqi.status = 'CLOSED_IMPLEMENTED'
        cqi.is_locked = True
        cqi.save()

        return Response(PEOCQIRecordSerializer(cqi).data, status=status.HTTP_200_OK)

