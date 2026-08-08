import json
import urllib.request
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction, models
from decimal import Decimal
from core.models import Batch, Semester, Program
from students.models import Student
from ..models import GA, CLOGAMapping, CourseSession, CourseGAScore, GACQIRecord, GACQIResubmissionHistory, StudentCLOScore, ExitSurveyQuestion, ExitSurveyCycle, ExitSurveyResponse, ExitSurveyTemplate, get_ga_indirect_score, CourseFeedbackGAScore
from ..serializers import GASerializer, CLOGAMappingSerializer, CourseGAScoreSerializer, GACQIRecordSerializer, GACQIResubmissionHistorySerializer, CourseSessionSerializer, ExitSurveyQuestionSerializer, ExitSurveyCycleSerializer, ExitSurveyResponseSerializer
from ..services import calculate_ga_attainment_semester_cohort, calculate_ga_attainment_cumulative_cohort, calculate_ga_attainment_semester_student, calculate_ga_attainment_cumulative_student, check_and_trigger_ga_cqi, calculate_all_course_ga_scores, calculate_semester_ga_report, get_students_for_batch, get_effective_course_sessions
from retake.report_access_wrapper import get_ga_report_with_invalidation_check


# #region debug-point helper:ga-report-view
def _emit_ga_view_debug_event(hypothesis_id: str, location: str, message: str, data: dict):
    _path = ".dbg/ga-report-attainment.env"
    _url = "http://127.0.0.1:7777/event"
    _session_id = "ga-report-attainment"
    try:
        with open(_path, "r", encoding="utf-8") as env_file:
            for raw_line in env_file:
                line = raw_line.strip()
                if line.startswith("DEBUG_SERVER_URL="):
                    _url = line.split("=", 1)[1]
                elif line.startswith("DEBUG_SESSION_ID="):
                    _session_id = line.split("=", 1)[1]
    except OSError:
        pass

    try:
        payload = {
            "sessionId": _session_id,
            "runId": "pre-fix",
            "hypothesisId": hypothesis_id,
            "location": location,
            "msg": f"[DEBUG] {message}",
            "data": data,
        }
        urllib.request.urlopen(
            urllib.request.Request(
                _url,
                data=json.dumps(payload, default=str).encode(),
                headers={"Content-Type": "application/json"},
            ),
            timeout=1,
        ).read()
    except Exception:
        pass
# #endregion


def ensure_exit_survey_questions_for_program(program, *, lock_questions=False):
    """
    Backfill missing exit-survey questions for every active GA in a program.
    This keeps the survey aligned with the current GA list even if older rows are incomplete.
    """
    for ga in GA.objects.filter(program=program, is_active=True):
        default_text = f"I am confident in {ga.description}"
        question_qs = ExitSurveyQuestion.objects.filter(ga=ga).order_by('-is_active', '-created_at', '-updated_at')
        question = question_qs.first()
        created = False

        if question is None:
            question = ExitSurveyQuestion.objects.create(
                ga=ga,
                question_text=default_text,
                is_active=True,
                is_locked=lock_questions,
            )
            created = True
        else:
            duplicate_ids = list(question_qs.exclude(id=question.id).values_list('id', flat=True))
            if duplicate_ids:
                ExitSurveyQuestion.objects.filter(id__in=duplicate_ids).update(is_active=False)

        updates = []
        if not question.question_text:
            question.question_text = default_text
            updates.append("question_text")
        if not question.is_active:
            question.is_active = True
            updates.append("is_active")
        if lock_questions and not question.is_locked:
            question.is_locked = True
            updates.append("is_locked")

        if updates or created:
            question.save(update_fields=updates or None)


class GAListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, program_id):
        gas = GA.objects.filter(
            program_id=program_id,
            is_active=True
        )
        serializer = GASerializer(gas, many=True)
        return Response(serializer.data)

    @transaction.atomic
    def post(self, request, program_id):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can create GAs'}, status=status.HTTP_403_FORBIDDEN)
            
        print(f"DEBUG: GA POST request for program_id: {program_id}")
        print(f"DEBUG: Request data: {request.data}")
        
        custom_question_text = request.data.get('exit_survey_question_text')
        
        data = request.data.copy()
        data['program'] = program_id
        serializer = GASerializer(data=data)
        if serializer.is_valid():
            ga = serializer.save(skip_exit_survey=True)
            
            # Create or update exit survey question with custom text if provided
            # Deactivate previous active questions for this GA
            ExitSurveyQuestion.objects.filter(
                ga=ga,
                is_active=True
            ).update(is_active=False)
            
            # Create new question with custom text or auto-generate
            question_text = custom_question_text if custom_question_text else f"I am confident in {ga.description}"
            ExitSurveyQuestion.objects.create(
                ga=ga,
                question_text=question_text,
                is_locked=True,  # Locked by default
                is_active=True
            )
            
            return Response(
                GASerializer(ga).data,
                status=status.HTTP_201_CREATED
            )
        print(f"DEBUG: GA Serializer errors: {serializer.errors}")
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


class GADetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return GA.objects.get(
                pk=pk, is_active=True
            )
        except GA.DoesNotExist:
            return None

    def get(self, request, pk):
        ga = self.get_object(pk)
        if not ga:
            return Response(
                {'error': 'Not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        return Response(GASerializer(ga).data)

    @transaction.atomic
    def patch(self, request, pk):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can update GAs'}, status=status.HTTP_403_FORBIDDEN)
            
        ga = self.get_object(pk)
        if not ga:
            return Response(
                {'error': 'Not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        custom_question_text = request.data.get('exit_survey_question_text')
        
        serializer = GASerializer(
            ga, data=request.data, partial=True
        )
        if serializer.is_valid():
            ga = serializer.save(skip_exit_survey=True)
            
            if custom_question_text:
                # Deactivate previous active questions for this GA
                ExitSurveyQuestion.objects.filter(
                    ga=ga,
                    is_active=True
                ).update(is_active=False)
                
                # Create new question with custom text
                ExitSurveyQuestion.objects.create(
                    ga=ga,
                    question_text=custom_question_text,
                    is_locked=True,  # Locked by default
                    is_active=True
                )
            elif 'description' in request.data:
                # If description changed, auto-generate new question
                ExitSurveyQuestion.objects.filter(
                    ga=ga,
                    is_active=True
                ).update(is_active=False)
                
                question_text = f"I am confident in {ga.description}"
                ExitSurveyQuestion.objects.create(
                    ga=ga,
                    question_text=question_text,
                    is_locked=True,
                    is_active=True
                )
            
            return Response(GASerializer(ga).data)
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    def delete(self, request, pk):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can delete GAs'}, status=status.HTTP_403_FORBIDDEN)
            
        ga = self.get_object(pk)
        if not ga:
            return Response(
                {'error': 'Not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        ga.is_active = False
        ga.save()
        return Response({'success': True})


# ========== NEW GA MODULE VIEWS ==========

# 1. Get all GAs
class GAAllView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        gas = GA.objects.filter(is_active=True)
        return Response(GASerializer(gas, many=True).data)


# 2. Create CLO-GA mapping
class GACLOMappingCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, ga_id):
        try:
            ga = GA.objects.get(id=ga_id, is_active=True)
        except GA.DoesNotExist:
            return Response({'error': 'GA not found'}, status=status.HTTP_404_NOT_FOUND)
        data = request.data.copy()
        data['ga'] = ga_id
        serializer = CLOGAMappingSerializer(data=data)
        if serializer.is_valid():
            # Validate that clo's row sum is 1.00
            clo = serializer.validated_data['clo']
            existing_mappings = CLOGAMapping.objects.filter(clo=clo, is_active=True)
            total_weight = sum(m.weight for m in existing_mappings) + serializer.validated_data['weight']
            if round(float(total_weight), 2) != 1.00:
                return Response(
                    {'error': f'CLO weight row sum must be 1.00, got {total_weight}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Helper function to mark course sessions as done if all their assessments are finalized
def mark_existing_sessions_as_done(batch, semester):
    from assessments.models import Assessment
    sessions = CourseSession.objects.filter(
        batch=batch,
        semester=semester,
        is_active=True,
        assessment_status='IN_PROGRESS'
    )
    for session in sessions:
        # Check if all assessments for this session are finalized
        assessments = Assessment.objects.filter(
            course=session.course,
            batch=session.batch,
            semester=session.semester
        )
        all_finalized = all(assess.is_finalized for assess in assessments)
        if all_finalized and assessments.exists():
            session.assessment_status = 'ASSESSMENT_DONE'
            session.save()
            calculate_all_course_ga_scores(session)


# 4. Post Course Final Submit (Assessment Done)
class CourseFinalSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, session_id):
        try:
            session = CourseSession.objects.get(id=session_id, is_active=True)
        except CourseSession.DoesNotExist:
            return Response({'error': 'Course session not found'}, status=status.HTTP_404_NOT_FOUND)
        
        session.assessment_status = 'ASSESSMENT_DONE'
        session.save()
        
        # Calculate Course GA Scores
        calculate_all_course_ga_scores(session)
        
        # Check and mark existing sessions in the same semester as done
        if session.semester and session.batch:
            mark_existing_sessions_as_done(session.batch, session.semester)
        
        # Check if program end is ready (all courses in all semesters up to current_semester are done)
        # and trigger cumulative GA-CQI only.
        if session.batch and session.batch.is_program_end_ready:
            gas = GA.objects.filter(program=session.batch.program, is_active=True)
            for ga in gas:
                check_and_trigger_ga_cqi(session.batch, ga)
        
        return Response(CourseSessionSerializer(session).data)


# 5. Get Course GA Scores
class CourseGAScoresView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        try:
            session = CourseSession.objects.get(id=session_id, is_active=True)
        except CourseSession.DoesNotExist:
            return Response({'error': 'Course session not found'}, status=status.HTTP_404_NOT_FOUND)
        
        scores = CourseGAScore.objects.filter(course_session=session, is_active=True)
        return Response(CourseGAScoreSerializer(scores, many=True).data)


# 6. Get Semester GA Summary
class BatchSemesterGASummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_readiness_for_semester(self, batch: Batch, semester: Semester):
        # Get pending courses for this specific semester
        allowed_course_ids = []
        if batch.curriculum_version:
            allowed_course_ids = batch.curriculum_version.version_courses.filter(
                is_active=True
            ).values_list('course_id', flat=True)

        sessions_query = CourseSession.objects.filter(
            batch=batch,
            is_active=True,
            semester=semester,
        )
        if allowed_course_ids:
            sessions_query = sessions_query.filter(course_id__in=allowed_course_ids)
        
        sessions = sessions_query.select_related('course', 'instructor')
        courses_total = sessions.count()
        courses_assessment_done = sessions.filter(assessment_status='ASSESSMENT_DONE').count()

        pending_courses_list = []
        finalized_courses_list = []
        in_process_courses_list = []

        for session in sessions:
            course_info = {
                'id': str(session.id),
                'course_code': session.course.code,
                'course_name': session.course.name,
                'instructor_name': session.instructor.full_name if session.instructor else 'N/A',
            }
            if session.assessment_status == 'ASSESSMENT_DONE':
                finalized_courses_list.append(course_info)
            else:
                in_process_courses_list.append(course_info)
                pending_courses_list.append(session.course.code)

        if courses_total == 0:
            return {
                'ready': False,
                'finalized_courses': 0,
                'total_courses': 0,
                'pending_courses': [],
                'finalized_courses_list': [],
                'in_process_courses_list': [],
            }

        return {
            'ready': courses_assessment_done >= courses_total,
            'finalized_courses': courses_assessment_done,
            'total_courses': courses_total,
            'pending_courses': pending_courses_list,
            'finalized_courses_list': finalized_courses_list,
            'in_process_courses_list': in_process_courses_list,
        }

    def get(self, request, batch_id):
        semester_id = request.query_params.get('semester_id')
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)

        semester = None
        if semester_id:
            semester = Semester.objects.filter(id=semester_id, program=batch.program, is_active=True).first()
        elif batch.current_semester > 1:
            semester = Semester.objects.filter(
                program=batch.program,
                number=batch.current_semester - 1,
                is_active=True
            ).first()

        readiness = None
        if semester:
            readiness = self._get_readiness_for_semester(batch, semester)
        
        summaries = calculate_semester_ga_report(batch, semester) if semester else []

        return Response({
            'semester': {
                'id': str(semester.id) if semester else None,
                'number': semester.number if semester else None,
                'name': semester.name if semester else None,
            },
            'readiness': readiness,
            'ga_reports': summaries,
        })


# 7. Get Program GA Summary
class BatchProgramGASummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
        gas = GA.objects.filter(program=batch.program, is_active=True)
        summaries = []
        for ga in gas:
            final_score = calculate_ga_attainment_cumulative_cohort(batch, ga)
            summaries.append({
                'ga': GASerializer(ga).data,
                'final_score': float(final_score) if final_score is not None else None,
                'kpi_threshold': float(ga.kpi_threshold),
                'pass': final_score is not None and final_score >= float(ga.kpi_threshold)
            })
        
        return Response(summaries)


# 8. GA CQI Views
class GACQIRecordDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, cqi_id):
        try:
            cqi = GACQIRecord.objects.get(id=cqi_id)
        except GACQIRecord.DoesNotExist:
            return Response({'error': 'CQI not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(GACQIRecordSerializer(cqi).data)

    @transaction.atomic
    def patch(self, request, cqi_id):
        try:
            cqi = GACQIRecord.objects.get(id=cqi_id)
        except GACQIRecord.DoesNotExist:
            return Response({'error': 'CQI not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if program is end ready
        if not cqi.batch.is_program_end_ready:
            return Response({'error': 'Program not yet complete — GA-CQI not available until all semesters finish'}, status=status.HTTP_403_FORBIDDEN)
        
        if cqi.is_locked:
            return Response({'error': 'This CQI record is locked and cannot be updated'}, status=status.HTTP_403_FORBIDDEN)
        
        # Check if user is coordinator (role or secondary role) for submission
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_coordinator = (user_role == 'coordinator') or (user_secondary_role == 'coordinator')
        
        if not is_coordinator:
            return Response({'error': 'Only coordinators can update root cause/remedial plan'}, status=status.HTTP_403_FORBIDDEN)

        # Save history if there are changes to root_cause or remedial_plan
        if 'root_cause' in request.data or 'remedial_plan' in request.data:
            GACQIResubmissionHistory.objects.create(
                cqi_record=cqi,
                root_cause_snapshot=cqi.root_cause,
                remedial_plan_snapshot=cqi.remedial_plan,
                hod_comment_snapshot=cqi.hod_comment,
                status_at_time=cqi.status
            )

        serializer = GACQIRecordSerializer(cqi, data=request.data, partial=True)
        if serializer.is_valid():
            # If status is being set to PENDING, or if root/plan are provided and it was SENT_BACK
            if request.data.get('status') == 'PENDING' or ((request.data.get('root_cause') or cqi.root_cause) and (request.data.get('remedial_plan') or cqi.remedial_plan) and cqi.status == 'SENT_BACK'):
                serializer.validated_data['status'] = 'PENDING'
                serializer.validated_data['submitted_by'] = request.user
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GACQICreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_coordinator = (user_role == 'coordinator') or (user_secondary_role == 'coordinator')
        
        if not is_coordinator:
            return Response({'error': 'Only coordinators can create/update GA CQI records'}, status=status.HTTP_403_FORBIDDEN)
            
        # Get required fields from request data
        ga_id = request.data.get('ga')
        batch_id = request.data.get('batch')
        cqi_level = request.data.get('cqi_level', 'CUMULATIVE')
        
        if not ga_id or not batch_id:
            return Response({'error': 'ga and batch are required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            ga = GA.objects.get(id=ga_id)
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except (GA.DoesNotExist, Batch.DoesNotExist) as e:
            return Response({'error': 'GA or Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if program is end ready
        if not batch.is_program_end_ready:
            return Response({'error': 'Program not yet complete — GA-CQI not available until all semesters finish'}, status=status.HTTP_403_FORBIDDEN)
        
        # Try to get existing record
        cqi = GACQIRecord.objects.filter(ga=ga, batch=batch, cqi_level=cqi_level).first()
        
        if cqi:
            if cqi.is_locked:
                return Response({'error': 'This CQI record is locked and cannot be updated'}, status=status.HTTP_403_FORBIDDEN)
            
            # Save history
            GACQIResubmissionHistory.objects.create(
                cqi_record=cqi,
                root_cause_snapshot=cqi.root_cause,
                remedial_plan_snapshot=cqi.remedial_plan,
                hod_comment_snapshot=cqi.hod_comment,
                status_at_time=cqi.status
            )
            
            # Update existing record
            serializer = GACQIRecordSerializer(cqi, data=request.data, partial=True)
        else:
            # Create new record
            serializer = GACQIRecordSerializer(data=request.data)
            
        if serializer.is_valid():
            cqi = serializer.save(status='PENDING', submitted_by=request.user)
            return Response(GACQIRecordSerializer(cqi).data, status=status.HTTP_200_OK if cqi else status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GACQIApproveView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, cqi_id):
        try:
            cqi = GACQIRecord.objects.get(id=cqi_id)
        except GACQIRecord.DoesNotExist:
            return Response({'error': 'CQI not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if program is end ready
        if not cqi.batch.is_program_end_ready:
            return Response({'error': 'Program not yet complete — GA-CQI not available until all semesters finish'}, status=status.HTTP_403_FORBIDDEN)
        
        if cqi.is_locked:
            return Response({'error': 'This CQI record is already locked'}, status=status.HTTP_403_FORBIDDEN)
        
        # Check if user is HOD (role or secondary role)
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can approve GA CQI records'}, status=status.HTTP_403_FORBIDDEN)

        # Save history
        GACQIResubmissionHistory.objects.create(
            cqi_record=cqi,
            root_cause_snapshot=cqi.root_cause,
            remedial_plan_snapshot=cqi.remedial_plan,
            hod_comment_snapshot=cqi.hod_comment,
            status_at_time=cqi.status
        )

        cqi.status = 'FULLY_APPROVED'
        cqi.approved_by = request.user
        cqi.is_locked = True
        cqi.save()
        return Response(GACQIRecordSerializer(cqi).data)


class GACQIRejectView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, cqi_id):
        try:
            cqi = GACQIRecord.objects.get(id=cqi_id)
        except GACQIRecord.DoesNotExist:
            return Response({'error': 'CQI not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if program is end ready
        if not cqi.batch.is_program_end_ready:
            return Response({'error': 'Program not yet complete — GA-CQI not available until all semesters finish'}, status=status.HTTP_403_FORBIDDEN)
        
        if cqi.is_locked:
            return Response({'error': 'This CQI record is locked and cannot be rejected'}, status=status.HTTP_403_FORBIDDEN)
        
        # Check if user is HOD (role or secondary role)
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can reject GA CQI records'}, status=status.HTTP_403_FORBIDDEN)

        # Save history
        GACQIResubmissionHistory.objects.create(
            cqi_record=cqi,
            root_cause_snapshot=cqi.root_cause,
            remedial_plan_snapshot=cqi.remedial_plan,
            hod_comment_snapshot=cqi.hod_comment,
            status_at_time=cqi.status
        )

        cqi.status = 'SENT_BACK'
        if 'hod_comment' in request.data:
            cqi.hod_comment = request.data.get('hod_comment')
        cqi.save()
        return Response(GACQIRecordSerializer(cqi).data)


class GACQIHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, cqi_id):
        try:
            cqi = GACQIRecord.objects.get(id=cqi_id)
        except GACQIRecord.DoesNotExist:
            return Response({'error': 'CQI not found'}, status=status.HTTP_404_NOT_FOUND)
        
        history = cqi.history.all().order_by('-submitted_at')
        return Response(GACQIResubmissionHistorySerializer(history, many=True).data)


# 9. Unlock Course Assessment
class CourseUnlockView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, session_id):
        try:
            session = CourseSession.objects.get(id=session_id, is_active=True)
        except CourseSession.DoesNotExist:
            return Response({'error': 'Course session not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Mark all existing scores as stale
        CourseGAScore.objects.filter(course_session=session).update(is_stale=True, is_active=False)
        
        # Set back to in progress
        session.assessment_status = 'IN_PROGRESS'
        session.save()
        
        return Response(CourseSessionSerializer(session).data)


# 10. Get Batch Students List
class BatchStudentsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Use User model (core app) and Student model which both may have batch foreign keys
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        users = User.objects.filter(
            (models.Q(batch=batch) | models.Q(student_profile__batch=batch)),
            role__in=['student', 'alumni'],
            is_active=True
        ).distinct()
        
        student_list = []
        for user in users:
            # Try to get associated student profile if exists
            student_profile = None
            try:
                student_profile = Student.objects.get(user=user)
            except (ImportError, Student.DoesNotExist):
                pass
            
            student_list.append({
                'id': str(user.id),  # Use user's id (uuid)
                'student_id': user.custom_id or str(user.id),
                'name': user.full_name,
                'roll_number': student_profile.registration_number if student_profile else '',
                'is_active': user.is_active
            })
        
        return Response(student_list)


# 11. GA Report View
class BatchGAReportView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_readiness_for_cumulative_cohort(self, batch: Batch):
        # Only consider one effective course session per course code so a retake
        # or re-finalized course does not double count readiness.
        allowed_course_ids = []
        if batch.curriculum_version:
            allowed_course_ids = batch.curriculum_version.version_courses.filter(
                is_active=True
            ).values_list('course_id', flat=True)

        sessions = get_effective_course_sessions(
            batch,
            upto_semester=batch.current_semester,
            require_assessment_done=False,
        )
        if allowed_course_ids:
            allowed_course_ids = {str(course_id) for course_id in allowed_course_ids}
            sessions = [
                session for session in sessions
                if str(session.course_id) in allowed_course_ids
            ]

        courses_total = len(sessions)
        courses_assessment_done = sum(
            1 for session in sessions
            if session.assessment_status == 'ASSESSMENT_DONE'
        )

        pending_courses_list = []
        finalized_courses_list = []
        in_process_courses_list = []

        for session in sessions:
            course_info = {
                'id': str(session.id),
                'course_code': session.course.code,
                'course_name': session.course.name,
                'instructor_name': session.instructor.full_name if session.instructor else 'N/A',
                'semester_number': session.semester.number if session.semester else None,
                'semester_name': session.semester.name if session.semester else None,
            }
            if session.assessment_status == 'ASSESSMENT_DONE':
                finalized_courses_list.append(course_info)
            else:
                in_process_courses_list.append(course_info)
                pending_courses_list.append(session.course.code)

        if courses_total == 0:
            return {
                'ready': False,
                'finalized_courses': 0,
                'total_courses': 0,
                'pending_courses': [],
                'finalized_courses_list': [],
                'in_process_courses_list': [],
            }

        return {
            'ready': courses_assessment_done >= courses_total,
            'finalized_courses': courses_assessment_done,
            'total_courses': courses_total,
            'pending_courses': pending_courses_list,
            'finalized_courses_list': finalized_courses_list,
            'in_process_courses_list': in_process_courses_list,
        }

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)

        scope = request.query_params.get('scope', 'cohort')    # cohort|student|all_students|course_wise
        student_id = request.query_params.get('student_id', None)

        # For scope=student or all_students
        student_objs = []
        from django.contrib.auth import get_user_model
        User = get_user_model()
        if scope == 'student':
            if not student_id:
                return Response({'error': 'student_id is required when scope=student'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                user = User.objects.get(id=student_id)
                student_obj = Student.objects.get(user=user)
                student_objs = [student_obj]
            except (User.DoesNotExist, Student.DoesNotExist):
                return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)
        elif scope == 'all_students':
            # Get all students OR alumni in the batch with pre-fetched user
            student_objs = Student.objects.filter(
                (models.Q(user__batch=batch) | models.Q(batch=batch)),
                user__role__in=['student', 'alumni'],
                user__is_active=True
            ).select_related('user')

        # Readiness gate (only when scope=cohort)
        readiness = self._get_readiness_for_cumulative_cohort(batch)
        is_program_end_ready = batch.is_program_end_ready
        
        # Refresh indirect source tables first so the report can show real component percentages.
        from feedback.views import FeedbackService
        from ..services import calculate_exit_survey_ga_score
        FeedbackService.calculate(batch)

        # Calculate Exit Survey scores for all GAs before building the report
        gas = GA.objects.filter(program=batch.program, is_active=True).order_by('order_number')
        for ga in gas:
            calculate_exit_survey_ga_score(ga, batch)
        
        if scope == 'all_students':
            # Build student-level data
            student_reports = []
            
            # Pre-fetch all required data
            allowed_course_ids = []
            if batch.curriculum_version:
                allowed_course_ids = batch.curriculum_version.version_courses.filter(
                    is_active=True
                ).values_list('course_id', flat=True)
            course_sessions = get_effective_course_sessions(
                batch,
                require_assessment_done=False,
            )
            if allowed_course_ids:
                allowed_course_ids = {str(course_id) for course_id in allowed_course_ids}
                course_sessions = [
                    session for session in course_sessions
                    if str(session.course_id) in allowed_course_ids
                ]
            session_ids = [cs.id for cs in course_sessions]
            
            # Get all mappings for these courses and GAs
            mappings = CLOGAMapping.objects.filter(
                clo__course__in=[cs.course_id for cs in course_sessions],
                ga__in=gas,
                is_active=True,
                clo__is_active=True
            ).select_related('clo', 'ga')
            
            # Group mappings by (course_id, ga_id)
            mappings_by_course_ga = {}
            for mapping in mappings:
                key = (mapping.clo.course_id, mapping.ga_id)
                if key not in mappings_by_course_ga:
                    mappings_by_course_ga[key] = []
                mappings_by_course_ga[key].append(mapping)
                
            # Get all student CLO scores
            student_ids = [s.student_id for s in student_objs]
            student_clo_scores = StudentCLOScore.objects.filter(
                student_id__in=student_ids,
                course_session_id__in=session_ids,
                is_active=True,
            ).select_related('student', 'clo', 'course_session')
            
            # Group scores by (student_id, course_session_id, clo_id)
            scores_by_key = {}
            for score in student_clo_scores:
                key = (score.student_id, score.course_session_id, score.clo_id)
                scores_by_key[key] = score
                
            # Calculate for each student
            for student_obj in student_objs:
                user = student_obj.user
                student_ga_scores = []
                
                for ga in gas:
                    total_attainment = Decimal('0')
                    total_weight = Decimal('0')
                    
                    for session in course_sessions:
                        key = (session.course_id, ga.id)
                        session_mappings = mappings_by_course_ga.get(key, [])
                        
                        for mapping in session_mappings:
                            score_key = (student_obj.student_id, session.id, mapping.clo_id)
                            student_clo_score = scores_by_key.get(score_key)
                            
                            if student_clo_score:
                                contribution = student_clo_score.attainment * mapping.weight
                                total_attainment += contribution
                                total_weight += mapping.weight
                                
                    ga_attainment = None
                    if total_weight > 0:
                        ga_attainment = round(total_attainment / total_weight, 2)
                        
                    is_below = False
                    if ga_attainment is not None:
                        is_below = float(ga_attainment) < float(ga.kpi_threshold)
                        
                    student_ga_scores.append({
                        'ga_id': str(ga.id),
                        'ga_code': f'GA-{ga.order_number}',
                        'direct_score': float(ga_attainment) if ga_attainment is not None else None,
                        'is_below_threshold': is_below
                    })
                    
                student_reports.append({
                    'id': str(user.id),
                    'name': user.full_name,
                    'registration_number': student_obj.registration_number,
                    'ga_scores': student_ga_scores,
                    'is_dropped': not user.is_active,
                    'is_frozen': False
                })
            
            # Calculate cohort-level summary for footer
            cohort_summary = []
            from ..services import calculate_weighted_ga_score
            for ga in gas:
                weighted_result = calculate_weighted_ga_score(ga, batch)
                indirect_attainment = weighted_result['indirect_score']
                visible_scores = [
                    score['direct_score']
                    for report in student_reports
                    for score in report['ga_scores']
                    if score['ga_id'] == str(ga.id) and score['direct_score'] is not None
                ]
                direct_attainment = None
                if visible_scores:
                    direct_attainment = round(
                        sum(Decimal(str(score)) for score in visible_scores) / Decimal(len(visible_scores)),
                        2,
                    )

                final_score = None
                if direct_attainment is not None and indirect_attainment is not None:
                    final_score = round((direct_attainment * Decimal('0.8')) + (Decimal(str(indirect_attainment)) * Decimal('0.2')), 2)
                elif direct_attainment is not None:
                    final_score = direct_attainment
                elif indirect_attainment is not None:
                    final_score = Decimal(str(indirect_attainment))
                # #region debug-point D:all-students-footer
                _emit_ga_view_debug_event(
                    "D",
                    "obe/views/ga_views.py:BatchGAReportView.all_students",
                    "Calculated all-students footer direct attainment from visible student rows",
                    {
                        "batch_id": str(batch.id),
                        "ga_id": str(ga.id),
                        "ga_code": f"GA-{ga.order_number}",
                        "visible_student_score_count": len(visible_scores),
                        "visible_student_scores": visible_scores,
                        "footer_direct_attainment": direct_attainment,
                        "weighted_course_direct_attainment": weighted_result['direct_score'],
                    },
                )
                # #endregion
                cohort_summary.append({
                    'ga_id': str(ga.id),
                    'ga_code': f'GA-{ga.order_number}',
                    'ga_title': ga.title,
                    'ga_kpi_threshold': float(ga.kpi_threshold),
                    'direct_attainment': float(direct_attainment) if direct_attainment is not None else None,
                    'indirect_attainment': float(indirect_attainment) if indirect_attainment is not None else None,
                    'final_attainment': float(final_score) if final_score is not None else None,
                    'status': 'NOT_ASSESSED' if final_score is None else (
                        'ACHIEVED' if float(final_score) >= float(ga.kpi_threshold) else 'BELOW_TARGET'
                    )
                })
            
            return Response({
                'is_program_end_ready': is_program_end_ready,
                'gas': [{'ga_id': str(ga.id), 'ga_code': f'GA-{ga.order_number}', 'ga_title': ga.title, 'ga_kpi_threshold': float(ga.kpi_threshold)} for ga in gas],
                'students': student_reports,
                'cohort_summary': cohort_summary
            })
        elif scope == 'course_wise':
            # Build course-wise data
            allowed_course_ids = []
            if batch.curriculum_version:
                allowed_course_ids = batch.curriculum_version.version_courses.filter(
                    is_active=True
                ).values_list('course_id', flat=True)
            cs_query = get_effective_course_sessions(
                batch,
                upto_semester=batch.current_semester,
                require_assessment_done=False,
            )
            if allowed_course_ids:
                allowed_course_ids = {str(course_id) for course_id in allowed_course_ids}
                cs_query = [
                    session for session in cs_query
                    if str(session.course_id) in allowed_course_ids
                ]
            course_sessions = cs_query
            
            # Bulk fetch all CourseGAScores for these sessions and GAs
            course_session_ids = [cs.id for cs in course_sessions]
            course_ga_scores = CourseGAScore.objects.filter(
                course_session_id__in=course_session_ids,
                ga__in=gas,
                is_active=True,
            ).select_related('course_session', 'ga')
            
            # Group scores by (course_session_id, ga_id) for quick lookup
            scores_by_session_ga = {}
            for score in course_ga_scores:
                key = (score.course_session_id, score.ga_id)
                scores_by_session_ga[key] = score
            
            course_reports = []
            for session in course_sessions:
                course_ga_list = []
                for ga in gas:
                    key = (session.id, ga.id)
                    score_obj = scores_by_session_ga.get(key)
                    if score_obj:
                        is_below = float(score_obj.score) < float(ga.kpi_threshold)
                        course_ga_list.append({
                            'ga_id': str(ga.id),
                            'ga_code': f'GA-{ga.order_number}',
                            'score': float(score_obj.score),
                            'is_below_threshold': is_below
                        })
                    else:
                        course_ga_list.append({
                            'ga_id': str(ga.id),
                            'ga_code': f'GA-{ga.order_number}',
                            'score': None,
                            'is_below_threshold': False
                        })
                # #region debug-point A:course-wise-visible-rows
                _emit_ga_view_debug_event(
                    "A",
                    "obe/views/ga_views.py:BatchGAReportView.course_wise",
                    "Built course-wise visible GA row set for a course session",
                    {
                        "batch_id": str(batch.id),
                        "course_session_id": str(session.id),
                        "course_code": session.course.code,
                        "assessment_status": session.assessment_status,
                        "ga_scores": course_ga_list,
                    },
                )
                # #endregion
                course_reports.append({
                    'course_id': str(session.course.id),
                    'course_code': session.course.code,
                    'course_title': session.course.name,
                    'semester': session.semester.number if session.semester else None,
                    'ga_scores': course_ga_list
                })
                
            # Calculate cohort-level summary for footer (same as all_students)
            cohort_summary = []
            from ..services import calculate_weighted_ga_score
            for ga in gas:
                weighted_result = calculate_weighted_ga_score(ga, batch)
                final_score = weighted_result['final_score']
                direct_attainment = weighted_result['direct_score']
                indirect_attainment = weighted_result['indirect_score']
                visible_scores = [
                    item['score']
                    for report in course_reports
                    for item in report['ga_scores']
                    if item['ga_id'] == str(ga.id) and item['score'] is not None
                ]
                # #region debug-point D:course-wise-footer
                _emit_ga_view_debug_event(
                    "D",
                    "obe/views/ga_views.py:BatchGAReportView.course_wise_footer",
                    "Compared course-wise visible GA rows against footer direct attainment",
                    {
                        "batch_id": str(batch.id),
                        "ga_id": str(ga.id),
                        "ga_code": f"GA-{ga.order_number}",
                        "visible_course_score_count": len(visible_scores),
                        "visible_course_scores": visible_scores,
                        "footer_direct_attainment": direct_attainment,
                    },
                )
                # #endregion
                cohort_summary.append({
                    'ga_id': str(ga.id),
                    'ga_code': f'GA-{ga.order_number}',
                    'ga_title': ga.title,
                    'ga_kpi_threshold': float(ga.kpi_threshold),
                    'direct_attainment': float(direct_attainment) if direct_attainment is not None else None,
                    'indirect_attainment': float(indirect_attainment) if indirect_attainment is not None else None,
                    'final_attainment': float(final_score) if final_score is not None else None,
                    'status': 'NOT_ASSESSED' if final_score is None else (
                        'ACHIEVED' if float(final_score) >= float(ga.kpi_threshold) else 'BELOW_TARGET'
                    )
                })
                
            return Response({
                'is_program_end_ready': is_program_end_ready,
                'gas': [{'ga_id': str(ga.id), 'ga_code': f'GA-{ga.order_number}', 'ga_title': ga.title, 'ga_kpi_threshold': float(ga.kpi_threshold)} for ga in gas],
                'courses': course_reports,
                'cohort_summary': cohort_summary
            })
        
        # Get GA report using the updated calculation function
        ga_report_rows = get_ga_report_with_invalidation_check(batch)
        
        response_items = []
        for ga_row in ga_report_rows:
            ga = GA.objects.get(id=ga_row['ga_id'])
            
            # Trigger cumulative CQI only if program end is ready
            if is_program_end_ready:
                check_and_trigger_ga_cqi(batch, ga, 'CUMULATIVE')

            # Contributing courses: show course_ga_score per course session (only <= current semester AND in curriculum)
            allowed_course_ids = []
            if batch.curriculum_version:
                allowed_course_ids = batch.curriculum_version.version_courses.filter(
                    is_active=True
                ).values_list('course_id', flat=True)

            cs_query = get_effective_course_sessions(
                batch,
                upto_semester=batch.current_semester,
                require_assessment_done=False,
            )
            if allowed_course_ids:
                allowed_course_ids = {str(course_id) for course_id in allowed_course_ids}
                cs_query = [
                    session for session in cs_query
                    if str(session.course_id) in allowed_course_ids
                ]

            enrolled_students_count = get_students_for_batch(batch).count()
            contributing_courses = []
            for session in cs_query:
                score = CourseGAScore.objects.filter(course_session=session, ga=ga, is_active=True).first()
                # Keep the course visible even if it has not been finalized yet.
                course_ga_score = float(score.score) if score else None
                enrolled_students = score.enrolled_students if score else enrolled_students_count

                # Get Course Feedback (Indirect) score for this course & GA & batch.
                # If the course has not been finalized yet, expose N/A instead of zero.
                cf_score = None
                cf_score_obj = CourseFeedbackGAScore.objects.filter(
                    course=session.course,
                    ga=ga,
                    batch=batch,
                    is_active=True
                ).first()
                if cf_score_obj and cf_score_obj.score is not None:
                    cf_score = float(cf_score_obj.score)

                contributing_courses.append({
                    'course_code': session.course.code,
                    'course_name': session.course.name,
                    'course_ga_score': course_ga_score,
                    'course_feedback_score': cf_score,
                    'enrolled_students': enrolled_students,
                    'semester': session.semester.number if session.semester else None,
                    'credits': session.course.credit_hours,
                    'assessment_status': session.assessment_status,
                })

            # GA CQI records: cohort only, and only if program end is ready
            ga_cqi_records = []
            if is_program_end_ready:
                cqis = GACQIRecord.objects.filter(batch=batch, ga=ga, cqi_level='CUMULATIVE')
                for cqi in cqis:
                    ga_cqi_records.append(GACQIRecordSerializer(cqi).data)

            final_score = ga_row['final_score']
            if final_score is None:
                # Not assessed if missing data
                status_str = 'NOT_ASSESSED'
            else:
                status_str = 'ACHIEVED' if float(final_score) >= float(ga.kpi_threshold) else 'BELOW_TARGET'

            response_items.append({
                'ga_id': ga_row['ga_id'],
                'ga_code': ga_row['ga_code'],
                'ga_title': ga_row['ga_title'],
                'ga_attainment': final_score,
                'direct_score': ga_row['direct_score'],
                'indirect_score': ga_row['indirect_score'],
                'course_feedback_score': ga_row['course_feedback_score'],
                'course_feedback_coverage': ga_row['course_feedback_coverage'],
                'exit_survey_score': ga_row['exit_survey_score'],
                'exit_survey_coverage': ga_row['exit_survey_coverage'],
                'ga_kpi_threshold': float(ga.kpi_threshold),
                'status': status_str,
                'formula_applied': ga_row['formula_applied'],
                'breakdown': ga_row['breakdown'],
                'coverage': ga_row['coverage'],
                'contributing_courses': contributing_courses,
                'ga_cqi_records': ga_cqi_records,
            })

        print("=== returning response with response_items count:", len(response_items))
        # Return top-level object with is_program_end_ready, readiness, and data
        return Response({
            'is_program_end_ready': is_program_end_ready,
            'readiness': readiness,
            'ga_reports': response_items
        })


# ========== EXIT SURVEY VIEWS ==========

class GAExitSurveyQuestionListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, ga_id):
        try:
            ga = GA.objects.get(id=ga_id, is_active=True)
        except GA.DoesNotExist:
            return Response({'error': 'GA not found'}, status=status.HTTP_404_NOT_FOUND)
        
        questions = ExitSurveyQuestion.objects.filter(ga=ga, is_active=True).order_by('-created_at')
        return Response(ExitSurveyQuestionSerializer(questions, many=True).data)


class ExitSurveyQuestionDetailView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get_object(self, pk):
        try:
            return ExitSurveyQuestion.objects.get(id=pk, is_active=True)
        except ExitSurveyQuestion.DoesNotExist:
            return None
    
    def get(self, request, pk):
        question = self.get_object(pk)
        if not question:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ExitSurveyQuestionSerializer(question).data)
    
    @transaction.atomic
    def patch(self, request, pk):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can update exit survey questions'}, status=status.HTTP_403_FORBIDDEN)
            
        question = self.get_object(pk)
        if not question:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # If question is already locked, only allow updating is_active
        if question.is_locked and 'is_locked' not in request.data and 'is_active' not in request.data:
            return Response({'error': 'Question is locked and cannot be edited'}, status=status.HTTP_403_FORBIDDEN)
            
        serializer = ExitSurveyQuestionSerializer(question, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(ExitSurveyQuestionSerializer(question).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ExitSurveyCycleListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
            
        cycles = ExitSurveyCycle.objects.filter(batch=batch, is_active=True).order_by('-created_at')
        return Response(ExitSurveyCycleSerializer(cycles, many=True).data)


class ExitSurveyCycleActivateView(APIView):
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request, batch_id):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_coordinator = (user_role == 'coordinator') or (user_secondary_role == 'coordinator')
        
        if not is_coordinator:
            return Response({'error': 'Only coordinators can activate exit surveys'}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
            
        # Check if there's already an active cycle
        active_cycle = ExitSurveyCycle.objects.filter(batch=batch, status='ACTIVE', is_active=True).first()
        if active_cycle:
            return Response({'error': 'There is already an active exit survey cycle for this batch'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Get all locked and active exit survey questions for the program
        questions = ExitSurveyQuestion.objects.filter(
            ga__program=batch.program,
            is_locked=True,
            is_active=True
        )
        if not questions.exists():
            return Response({'error': 'No locked exit survey questions found for this program'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Create new cycle
        from django.utils import timezone
        cycle = ExitSurveyCycle.objects.create(
            batch=batch,
            status='ACTIVE',
            activated_by=request.user,
            activated_at=timezone.now()
        )
        
        # TODO: Generate UUID links for students and send emails (requires Alumni survey pattern)
        
        return Response(ExitSurveyCycleSerializer(cycle).data, status=status.HTTP_201_CREATED)


class ExitSurveyCycleCloseView(APIView):
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request, cycle_id):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_coordinator = (user_role == 'coordinator') or (user_secondary_role == 'coordinator')
        
        if not is_coordinator:
            return Response({'error': 'Only coordinators can close exit surveys'}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            cycle = ExitSurveyCycle.objects.get(id=cycle_id, is_active=True)
        except ExitSurveyCycle.DoesNotExist:
            return Response({'error': 'Cycle not found'}, status=status.HTTP_404_NOT_FOUND)
            
        if cycle.status != 'ACTIVE':
            return Response({'error': 'Only active cycles can be closed'}, status=status.HTTP_400_BAD_REQUEST)
            
        from django.utils import timezone
        cycle.status = 'CLOSED'
        cycle.closed_at = timezone.now()
        cycle.save()
        
        return Response(ExitSurveyCycleSerializer(cycle).data)


class ExitSurveyResponseView(APIView):
    # No authentication required - accessed via UUID link
    permission_classes = []
    
    def get(self, request, cycle_id):
        # Get questions for this cycle's program
        try:
            cycle = ExitSurveyCycle.objects.get(id=cycle_id, status='ACTIVE', is_active=True)
        except ExitSurveyCycle.DoesNotExist:
            return Response({'error': 'Active cycle not found'}, status=status.HTTP_404_NOT_FOUND)
            
        questions = ExitSurveyQuestion.objects.filter(
            ga__program=cycle.batch.program,
            is_locked=True,
            is_active=True
        )
        return Response(ExitSurveyQuestionSerializer(questions, many=True).data)
    
    @transaction.atomic
    def post(self, request, cycle_id, student_id):
        try:
            cycle = ExitSurveyCycle.objects.get(id=cycle_id, status='ACTIVE', is_active=True)
            student = Student.objects.get(id=student_id)
        except (ExitSurveyCycle.DoesNotExist, Student.DoesNotExist):
            return Response({'error': 'Cycle or student not found'}, status=status.HTTP_404_NOT_FOUND)
            
        responses_data = request.data.get('responses', [])
        for resp_data in responses_data:
            question_id = resp_data.get('question')
            score = resp_data.get('score')
            
            try:
                question = ExitSurveyQuestion.objects.get(id=question_id, is_locked=True, is_active=True)
            except ExitSurveyQuestion.DoesNotExist:
                continue
                
            # Update or create response
            ExitSurveyResponse.objects.update_or_create(
                cycle=cycle,
                student=student,
                question=question,
                defaults={'score': score}
            )
            
        return Response({'success': True})


class GAIndirectScoreView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, ga_id, batch_id):
        try:
            ga = GA.objects.get(id=ga_id, is_active=True)
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except (GA.DoesNotExist, Batch.DoesNotExist):
            return Response({'error': 'GA or Batch not found'}, status=status.HTTP_404_NOT_FOUND)
            
        indirect_score_data = get_ga_indirect_score(ga_id, batch_id)
        return Response(indirect_score_data)


# ========== NEW EXIT SURVEY ENDPOINTS ==========
class ExitSurveyQuestionListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Backfill missing questions so the coordinator always sees one row per active GA.
        for program_id in GA.objects.filter(is_active=True).values_list('program_id', flat=True).distinct():
            program = Program.objects.filter(id=program_id).first()
            if program:
                ensure_exit_survey_questions_for_program(program, lock_questions=True)

        ga_id = request.query_params.get('ga_id')
        queryset = ExitSurveyQuestion.objects.filter(is_active=True).select_related('ga')
        if ga_id:
            queryset = queryset.filter(ga_id=ga_id)
        queryset = queryset.order_by('ga__order_number', '-created_at')
        return Response(ExitSurveyQuestionSerializer(queryset, many=True).data)


class ExitSurveyQuestionGenerateView(APIView):
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_coordinator = (user_role == 'coordinator') or (user_secondary_role == 'coordinator')
        
        if not is_coordinator:
            return Response({'error': 'Only coordinators can generate exit survey questions'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get all active GAs
        gas = GA.objects.filter(is_active=True)
        
        # Generate questions for each GA
        for ga in gas:
            question_text = f"I am confident in {ga.description}"
            question_qs = ExitSurveyQuestion.objects.filter(ga=ga).order_by('-is_active', '-created_at', '-updated_at')
            question = question_qs.first()

            if question is None:
                ExitSurveyQuestion.objects.create(
                    ga=ga,
                    question_text=question_text,
                    is_locked=True,
                    is_active=True,
                )
                continue

            duplicate_ids = list(question_qs.exclude(id=question.id).values_list('id', flat=True))
            if duplicate_ids:
                ExitSurveyQuestion.objects.filter(id__in=duplicate_ids).update(is_active=False)

            updates = []
            if question.question_text != question_text:
                question.question_text = question_text
                updates.append("question_text")
            if not question.is_locked:
                question.is_locked = True
                updates.append("is_locked")
            if not question.is_active:
                question.is_active = True
                updates.append("is_active")

            if updates:
                question.save(update_fields=updates)
        
        return Response({'success': True})


class ExitSurveyTemplateStatusView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        template, created = ExitSurveyTemplate.objects.get_or_create(
            defaults={'is_locked': False, 'version': 1}
        )
        from ..serializers import ExitSurveyTemplateSerializer
        return Response(ExitSurveyTemplateSerializer(template).data)


class BatchToggleExitSurveyView(APIView):
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def patch(self, request, batch_id):
        print(f"DEBUG: BatchToggleExitSurveyView called for batch_id: {batch_id}")
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_coordinator_or_hod = (user_role in ['coordinator', 'hod']) or (user_secondary_role in ['coordinator', 'hod'])
        
        if not is_coordinator_or_hod:
            print("DEBUG: Not coordinator or HOD - returning 403")
            return Response({'error': 'Only coordinators or HODs can toggle exit survey'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
            print(f"DEBUG: Found batch {batch.name}, current exit_survey_enabled: {batch.exit_survey_enabled}")
        except Batch.DoesNotExist:
            print("DEBUG: Batch not found!")
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
        from django.utils import timezone
        batch.exit_survey_enabled = not batch.exit_survey_enabled
        print(f"DEBUG: Toggled to exit_survey_enabled: {batch.exit_survey_enabled}")
        if batch.exit_survey_enabled:
            batch.exit_survey_enabled_at = timezone.now()
            batch.graduation_status = 'in_progress'
        else:
            batch.exit_survey_enabled_at = None
            batch.graduation_status = 'not_graduating'
        batch.save()
        print("DEBUG: Batch saved!")
        
        return Response({
            'exit_survey_enabled': batch.exit_survey_enabled,
            'exit_survey_enabled_at': batch.exit_survey_enabled_at,
            'graduation_status': batch.graduation_status
        })


class BatchInitiateGraduationView(APIView):
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request, batch_id):
        user_role = request.user.role
        if user_role != 'SAC':
            return Response({'error': 'Only SAC can initiate graduation'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
        if batch.graduation_status == 'in_progress' or batch.graduation_status == 'graduated_partial' or batch.graduation_status == 'graduated_complete':
            return Response({'error': 'Graduation already initiated'}, status=status.HTTP_400_BAD_REQUEST)
        
        from django.utils import timezone
        batch.graduation_status = 'in_progress'
        batch.save()
        
        # Auto-graduate students who already submitted the exit survey
        # TODO: Uncomment once student model has status and is_active fields
        # for student in Student.objects.filter(batch=batch, exit_survey_submitted=True):
        #     student.status = 'alumni'
        #     student.is_active = False
        #     student.save()
        
        return Response({
            'graduation_initiated': True,
            'graduation_status': batch.graduation_status
        })


class BatchPendingExitSurveyView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
        pending_students = Student.objects.filter(batch=batch, exit_survey_submitted=False)
        
        # Prepare response
        students_data = []
        for student in pending_students:
            students_data.append({
                'id': student.id,
                'name': student.name,
                'registration_number': student.registration_number
            })
        
        return Response({
            'pending_count': pending_students.count(),
            'students': students_data
        })


class ExitSurveyMyQuestionsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            student = Student.objects.get(user=request.user)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

        batch = getattr(student, "batch", None)
        if not batch:
            return Response({'error': 'Student batch not found'}, status=status.HTTP_404_NOT_FOUND)

        # Make sure every active GA in the student's program has a locked question
        # before we build the survey payload.
        ensure_exit_survey_questions_for_program(batch.program, lock_questions=True)

        # Only show exit-survey questions for the student's program.
        questions = ExitSurveyQuestion.objects.filter(
            ga__program=batch.program,
            is_active=True,
            is_locked=True
        ).select_related("ga").order_by("ga__order_number", "created_at")
        return Response(ExitSurveyQuestionSerializer(questions, many=True).data)


class ExitSurveySubmitView(APIView):
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request):
        try:
            student = Student.objects.get(user=request.user)
        except Student.DoesNotExist:
            # Create a new student profile if it doesn't exist
            user_program = None
            if hasattr(request.user, 'program'):
                user_program = request.user.program
            elif hasattr(request.user, 'programs'):
                user_program = request.user.programs.first()
                
            student = Student.objects.create(
                user=request.user,
                name=request.user.full_name or request.user.username,
                registration_number=request.user.registration_number or request.user.custom_id or "",
                batch=request.user.batch,
                department=user_program
            )
        
        if student.exit_survey_submitted:
            return Response({'error': 'Exit survey already submitted'}, status=status.HTTP_400_BAD_REQUEST)

        batch = getattr(student, "batch", None)
        if not batch:
            return Response({'error': 'Student batch not found'}, status=status.HTTP_404_NOT_FOUND)

        # Keep the submitted-question count in sync with the current active GA set.
        ensure_exit_survey_questions_for_program(batch.program, lock_questions=True)
        
        responses_data = request.data.get('responses', [])
        
        # Validate all questions are answered
        questions = ExitSurveyQuestion.objects.filter(
            ga__program=batch.program,
            is_active=True,
            is_locked=True
        )
        if len(responses_data) != questions.count():
            return Response({'error': 'All questions must be answered'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Create responses
        for resp_data in responses_data:
            question_id = resp_data.get('question_id')
            rating_value = resp_data.get('rating_value')
            
            if not question_id or not rating_value:
                return Response({'error': 'Missing question_id or rating_value'}, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                question = ExitSurveyQuestion.objects.get(
                    id=question_id,
                    ga__program=batch.program,
                    is_active=True,
                    is_locked=True
                )
            except ExitSurveyQuestion.DoesNotExist:
                return Response({'error': f'Question {question_id} not found'}, status=status.HTTP_404_NOT_FOUND)
            
            ExitSurveyResponse.objects.create(
                student=student,
                question=question,
                rating_value=rating_value
            )
        
        # Mark student as having submitted the survey
        from django.utils import timezone
        student.exit_survey_submitted = True
        student.exit_survey_submitted_at = timezone.now()
        
        # If graduation has been initiated, auto-graduate the student
        # TODO: Uncomment once student model has status and is_active fields
        # if student.batch.graduation_initiated:
        #     student.status = 'alumni'
        #     student.is_active = False
        
        student.save()
        
        return Response({'success': True, 'message': 'Exit survey submitted successfully'})


class StudentPortalStatusView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        print(f"DEBUG: StudentPortalStatusView - User: {request.user.email}, role: {request.user.role}")
        try:
            student = Student.objects.get(user=request.user)
            print(f"DEBUG: Found existing student: {student.name}")
            # Sync student.batch with user.batch if they don't match
            # Get user's program (handle both 'program' and 'programs' cases)
            user_program = None
            if hasattr(request.user, 'program'):
                user_program = request.user.program
            elif hasattr(request.user, 'programs'):
                user_program = request.user.programs.first()  # Get first program if it's a many-to-many
            
            if student.batch != request.user.batch or student.department != user_program:
                print(f"DEBUG: Syncing student batch (old: {student.batch}, new: {request.user.batch})")
                student.batch = request.user.batch
                student.department = user_program
                student.save()
        except Student.DoesNotExist:
            print("DEBUG: Student not found - creating a new one!")
            # Create a new student profile for the user
            user_program = None
            if hasattr(request.user, 'program'):
                user_program = request.user.program
            elif hasattr(request.user, 'programs'):
                user_program = request.user.programs.first()
                
            student = Student.objects.create(
                user=request.user,
                name=request.user.full_name or request.user.username,
                registration_number=request.user.registration_number or request.user.custom_id or "",
                batch=request.user.batch,
                department=user_program
            )
            print(f"DEBUG: Created new student profile: {student}")
        
        batch = student.batch or request.user.batch
        print(f"DEBUG: Batch: {batch}, exit_survey_enabled: {batch.exit_survey_enabled if batch else 'N/A'}")
        
        if not batch:
            print("DEBUG: No batch found - returning locked=False")
            return Response({'locked': False})
        
        if not batch.exit_survey_enabled:
            print("DEBUG: Exit survey not enabled - returning locked=False")
            return Response({'locked': False})
        
        # Check if batch is in final semester
        print(f"DEBUG: Batch current semester: {batch.current_semester}, Program total semesters: {batch.program.total_semesters if batch.program else 'N/A'}")
        if batch.program and batch.current_semester != batch.program.total_semesters:
            print("DEBUG: Not final semester - returning locked=False")
            return Response({'locked': False})
        
        print(f"DEBUG: Student exit survey submitted: {student.exit_survey_submitted}")
        if student.exit_survey_submitted:
            print("DEBUG: Survey already submitted - returning locked=False")
            return Response({'locked': False})
        
        print("DEBUG: Returning locked=True!")
        return Response({
            'locked': True,
            'reason': 'exit_survey_required'
        })

class EnableResultEditingView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, session_id):
        try:
            session = CourseSession.objects.get(
                id=session_id,
                is_active=True
            )
        except CourseSession.DoesNotExist:
            return Response(
                {"error": "Course session not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Enable editing
        session.allow_result_editing = True
        session.save()

        return Response({
            "message": "Result editing enabled successfully."
        }, status=status.HTTP_200_OK)
