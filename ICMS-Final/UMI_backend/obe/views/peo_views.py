from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.contrib.auth import get_user_model
from datetime import timedelta
from decimal import Decimal
from core.models import Batch
from students.models import Student
from ..models import PEO, GAPEOMapping, GA, AlumniSurveyQuestion, AlumniSurveyCycle, AlumniSurveyResponse, get_peo_indirect_score, PEOCQIRecord, PEOCQISubmissionHistory
from ..serializers import PEOSerializer, GAPEOMappingSerializer, GASerializer, AlumniSurveyQuestionSerializer, AlumniSurveyCycleSerializer, AlumniSurveyResponseSerializer, PEOCQIRecordSerializer, PEOCQISubmissionHistorySerializer
from ..services import calculate_all_peo_reports, calculate_peo_report

User = get_user_model()
ALUMNI_FEEDBACK_THRESHOLD = Decimal('50.00')
ALUMNI_FEEDBACK_DEFAULT_DAYS = 15
ALUMNI_FEEDBACK_EXTENSION_DAYS = 5


def _get_alumni_employment_distribution(batch):
    # Get distinct students' employment status from the latest cycle
    cycle = AlumniSurveyCycle.objects.filter(batch=batch, is_active=True).order_by('-created_at').first()
    if not cycle:
        return {}
    # Get distinct (student_id, employment_status) pairs
    responses = cycle.responses.filter(is_active=True, employment_status__isnull=False).values('student_id', 'employment_status').distinct()
    distribution = {}
    for resp in responses:
        status = resp['employment_status']
        distribution[status] = distribution.get(status, 0) + 1
    return distribution


def _get_top_employers(batch, limit=10):
    # Get distinct students' organization names
    cycle = AlumniSurveyCycle.objects.filter(batch=batch, is_active=True).order_by('-created_at').first()
    if not cycle:
        return []
    responses = cycle.responses.filter(is_active=True, organization_name__isnull=False, organization_name__gt='').values('student_id', 'organization_name').distinct()
    employer_counts = {}
    for resp in responses:
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
    """
    peos = PEO.objects.filter(program=program, is_active=True).order_by('order_number')

    for peo in peos:
        active_question = peo.alumni_survey_questions.filter(is_active=True).order_by('-created_at').first()

        if active_question:
            if not active_question.is_locked:
                active_question.is_locked = True
                active_question.save(update_fields=['is_locked'])
            continue

        question_text = (
            f"To what extent are you achieving this objective in your current professional role: {peo.description}"
            if peo.description
            else "To what extent are you achieving this objective in your current professional role"
        )

        AlumniSurveyQuestion.objects.create(
            peo=peo,
            question_text=question_text,
            is_locked=True,
            is_active=True
        )


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
            return Response({'error': 'Only HODs can update GA-PEO mappings'}, status=status.HTTP_403_FORBIDDEN)
        
        # Delete existing mappings
        GAPEOMapping.objects.filter(
            ga__program_id=program_id
        ).delete()

        mappings_data = request.data.get(
            'mappings', []
        )
        created = []
        for m in mappings_data:
            mapping = GAPEOMapping.objects.create(
                ga_id=m['ga_id'],
                peo_id=m['peo_id'],
                weight=m.get('weight', Decimal('0.00'))
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
            return Response({'error': 'PEO not found'}, status=status.HTTP_404_NOT_FOUND)
        
        if not peo.alumni_survey_questions.filter(is_active=True).exists():
            _ensure_active_alumni_questions_for_program(peo.program)

        questions = AlumniSurveyQuestion.objects.filter(peo=peo, is_active=True).order_by('-created_at')
        return Response(AlumniSurveyQuestionSerializer(questions, many=True).data)


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
            
        # Get all locked and active alumni survey questions for the program
        questions = AlumniSurveyQuestion.objects.filter(
            peo__program=cycle.batch.program,
            is_locked=True,
            is_active=True
        )
        if not questions.exists():
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
             
        questions = AlumniSurveyQuestion.objects.filter(
            peo__program=cycle.batch.program,
            is_locked=True,
            is_active=True
        )
        return Response(AlumniSurveyQuestionSerializer(questions, many=True).data)
    
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

        existing_submission = AlumniSurveyResponse.objects.filter(
            cycle=cycle,
            student=student,
            is_active=True
        ).exists()
        if existing_submission:
            return Response({'error': 'Alumni survey already submitted'}, status=status.HTTP_400_BAD_REQUEST)
            
        responses_data = request.data.get('responses', [])
        employment_status = request.data.get('employment_status')
        organization_name = request.data.get('organization_name')
        current_designation = request.data.get('current_designation')
        
        # Save employment status on the first response to keep it consistent
        first_response_saved = False
        for resp_data in responses_data:
            question_id = resp_data.get('question')
            score = resp_data.get('score')
            
            try:
                question = AlumniSurveyQuestion.objects.get(id=question_id, is_locked=True, is_active=True)
            except AlumniSurveyQuestion.DoesNotExist:
                continue
                
            update_dict = {'score': score}
            if not first_response_saved:
                if employment_status:
                    update_dict['employment_status'] = employment_status
                if organization_name:
                    update_dict['organization_name'] = organization_name
                if current_designation:
                    update_dict['current_designation'] = current_designation
                first_response_saved = True
                
            AlumniSurveyResponse.objects.update_or_create(
                cycle=cycle,
                student=student,
                question=question,
                defaults=update_dict
            )

        _refresh_alumni_feedback_cycle(cycle)
        return Response({'success': True})


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
            submitted = AlumniSurveyResponse.objects.filter(
                cycle=cycle,
                student=student,
                is_active=True
            ).exists()

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
            return Response({'error': 'PEO or Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
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
            return Response({'error': 'Only HODs can view PEO CQI records'}, status=status.HTTP_403_FORBIDDEN)
        
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
            return Response({'error': 'PEO CQI record not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(PEOCQIRecordSerializer(cqi).data)
    
    @transaction.atomic
    def patch(self, request, cqi_id):
        try:
            cqi = PEOCQIRecord.objects.get(id=cqi_id)
        except PEOCQIRecord.DoesNotExist:
            return Response({'error': 'PEO CQI record not found'}, status=status.HTTP_404_NOT_FOUND)
        
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can update PEO CQI records'}, status=status.HTTP_403_FORBIDDEN)
        
        if cqi.is_locked:
            return Response({'error': 'This PEO CQI record is locked and cannot be updated'}, status=status.HTTP_403_FORBIDDEN)
        
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
            return Response({'error': 'PEO CQI record not found'}, status=status.HTTP_404_NOT_FOUND)
        
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can submit PEO CQI records'}, status=status.HTTP_403_FORBIDDEN)
        
        if cqi.is_locked:
            return Response({'error': 'This PEO CQI record is locked and cannot be submitted'}, status=status.HTTP_403_FORBIDDEN)
        
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
            return Response({'error': 'Only HODs can create PEO CQI records'}, status=status.HTTP_403_FORBIDDEN)
        
        peo_id = request.data.get('peo')
        batch_id = request.data.get('batch')
        
        try:
            peo = PEO.objects.get(id=peo_id)
            batch = Batch.objects.get(id=batch_id)
        except (PEO.DoesNotExist, Batch.DoesNotExist):
            return Response({'error': 'PEO or Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if program end ready
        if not batch.is_program_end_ready:
            return Response({'error': 'Program not yet complete — PEO CQI not available until all semesters finish'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get or create existing record
        cqi, created = PEOCQIRecord.objects.get_or_create(
            peo=peo,
            batch=batch
        )
        
        if not created and cqi.is_locked:
            return Response({'error': 'This PEO CQI record is locked and cannot be updated'}, status=status.HTTP_403_FORBIDDEN)
        
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
            return Response({'error': 'PEO CQI record not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(PEOCQISubmissionHistorySerializer(cqi.history.all(), many=True).data)

