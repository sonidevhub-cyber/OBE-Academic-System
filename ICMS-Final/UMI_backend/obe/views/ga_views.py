from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from decimal import Decimal
from core.models import Batch, Semester
from students.models import Student
from ..models import GA, CLOGAMapping, CourseSession, CourseGAScore, GACQIRecord, GACQIResubmissionHistory, StudentCLOScore
from ..serializers import GASerializer, CLOGAMappingSerializer, CourseGAScoreSerializer, GACQIRecordSerializer, GACQIResubmissionHistorySerializer, CourseSessionSerializer
from ..services import calculate_ga_attainment_semester_cohort, calculate_ga_attainment_cumulative_cohort, calculate_ga_attainment_semester_student, calculate_ga_attainment_cumulative_student, check_and_trigger_ga_cqi, calculate_all_course_ga_scores


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
        
        data = request.data.copy()
        data['program'] = program_id
        serializer = GASerializer(data=data)
        if serializer.is_valid():
            ga = serializer.save()
            
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
        
        serializer = GASerializer(
            ga, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
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
        
        # Check if all courses in the semester are done → generate semester GA report (calculate semester attainment for all GAs)
        if session.semester and session.batch:
            all_sessions_in_semester = CourseSession.objects.filter(
                batch=session.batch,
                semester=session.semester,
                is_active=True
            )
            done_sessions_in_semester = all_sessions_in_semester.filter(assessment_status='ASSESSMENT_DONE')
            if all_sessions_in_semester.count() == done_sessions_in_semester.count() and all_sessions_in_semester.exists():
                # Calculate semester GA attainment and check for semester-level CQI for all GAs
                gas = GA.objects.filter(program=session.batch.program, is_active=True)
                for ga in gas:
                    # Check if we should trigger semester-level CQI
                    check_and_trigger_ga_cqi(session.batch, ga, 'SEMESTER', session.semester.number)
        
        # Check if program end is ready (all courses in all semesters up to current_semester are done) → trigger cumulative CQI
        if session.batch and session.batch.is_program_end_ready:
            gas = GA.objects.filter(program=session.batch.program, is_active=True)
            for ga in gas:
                check_and_trigger_ga_cqi(session.batch, ga, 'CUMULATIVE')
        
        return Response(CourseSessionSerializer(session).data)


# 5. Get Course GA Scores
class CourseGAScoresView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        try:
            session = CourseSession.objects.get(id=session_id, is_active=True)
        except CourseSession.DoesNotExist:
            return Response({'error': 'Course session not found'}, status=status.HTTP_404_NOT_FOUND)
        
        scores = CourseGAScore.objects.filter(course_session=session)
        return Response(CourseGAScoreSerializer(scores, many=True).data)


# 6. Get Semester GA Summary
class BatchSemesterGASummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        # Get semester from request params?
        semester_id = request.query_params.get('semester_id')
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Get all GAs
        gas = GA.objects.filter(program=batch.program, is_active=True)
        summaries = []
        for ga in gas:
            if semester_id:
                try:
                    semester = Semester.objects.get(id=semester_id)
                    ga_score = calculate_ga_attainment_semester_cohort(batch, semester, ga)
                except Semester.DoesNotExist:
                    ga_score = None
            else:
                ga_score = None
            
            summaries.append({
                'ga': GASerializer(ga).data,
                'score': float(ga_score) if ga_score else None,
                'kpi_threshold': float(ga.kpi_threshold),
                'pass': ga_score is not None and ga_score >= float(ga.kpi_threshold)
            })
        
        return Response(summaries)


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
                'final_score': float(final_score),
                'kpi_threshold': float(ga.kpi_threshold),
                'pass': final_score >= float(ga.kpi_threshold)
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
        CourseGAScore.objects.filter(course_session=session).update(is_stale=True)
        
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
        
        # Use User model (core app) which is what has the batch foreign key
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        users = User.objects.filter(
            batch=batch,
            role='student',
            is_active=True
        )
        
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
        # Only consider courses where semester number <= batch's current semester
        sessions = CourseSession.objects.filter(
            batch=batch,
            is_active=True,
            semester__number__lte=batch.current_semester,
        )
        courses_total = sessions.count()
        courses_assessment_done = sessions.filter(assessment_status='ASSESSMENT_DONE').count()

        if courses_total == 0:
            return {
                'ready': False,
                'finalized_courses': 0,
                'total_courses': 0,
                'missing_courses': [],
            }

        missing = []
        if courses_assessment_done < courses_total:
            # Identify missing courses by code for readability
            missing_qs = sessions.exclude(assessment_status='ASSESSMENT_DONE')
            missing = list(missing_qs.values_list('course__code', flat=True).distinct())

        return {
            'ready': courses_assessment_done >= courses_total,
            'finalized_courses': courses_assessment_done,
            'total_courses': courses_total,
            'missing_courses': missing,
        }

    def get(self, request, batch_id):
        print("=== BatchGAReportView ===")
        print("batch_id:", batch_id)
        print("request.query_params:", request.query_params)
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            print("ERROR: Batch not found")
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)

        scope = request.query_params.get('scope', 'cohort')    # cohort|student
        student_id = request.query_params.get('student_id', None)
        print("scope:", scope)
        print("student_id:", student_id)

        # For scope=student
        student_obj = None
        if scope == 'student':
            if not student_id:
                print("ERROR: student_id missing")
                return Response({'error': 'student_id is required when scope=student'}, status=status.HTTP_400_BAD_REQUEST)
            # Get User first
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(id=student_id)
                student_obj = Student.objects.get(user=user)
            except (User.DoesNotExist, Student.DoesNotExist):
                print("ERROR: Student not found")
                return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)
            print("student_obj found:", student_obj)

        # Readiness gate (only when scope=cohort)
        if scope == 'cohort':
            readiness = self._get_readiness_for_cumulative_cohort(batch)
            if not readiness['ready']:
                return Response(readiness)

        is_program_end_ready = batch.is_program_end_ready
        
        # Determine ga rows
        gas = GA.objects.filter(program=batch.program, is_active=True)
        response_items = []
        print("=== GA count:", gas.count())

        for ga in gas:
            ga_attainment = None
            contributing_courses = []
            ga_cqi_records = []
            ga_code = f'GA-{ga.order_number}'

            if scope == 'cohort':
                ga_attainment = calculate_ga_attainment_cumulative_cohort(batch, ga)
                
                # Trigger cumulative CQI only if program end is ready
                if is_program_end_ready:
                    check_and_trigger_ga_cqi(batch, ga, 'CUMULATIVE')

                # Contributing courses: show course_ga_score per course session (only <= current semester)
                cs_qs = CourseSession.objects.filter(batch=batch, is_active=True, assessment_status='ASSESSMENT_DONE', semester__number__lte=batch.current_semester)

                for session in cs_qs.select_related('course', 'semester'):
                    score = CourseGAScore.objects.filter(course_session=session, ga=ga).first()
                    if score:
                        contributing_courses.append({
                            'course_code': session.course.code,
                            'course_name': session.course.name,
                            'course_ga_score': float(score.score),
                            'enrolled_students': score.enrolled_students,
                            'semester': session.semester.number if session.semester else None,
                            'credits': session.course.credit_hours,
                        })

                # GA CQI records: cohort only, and only if program end is ready
                if is_program_end_ready:
                    cqis = GACQIRecord.objects.filter(batch=batch, ga=ga, cqi_level='CUMULATIVE')
                    for cqi in cqis:
                        ga_cqi_records.append(GACQIRecordSerializer(cqi).data)

            else:
                # scope=student
                print("=== Processing student scope for", ga_code)
                ga_attainment = calculate_ga_attainment_cumulative_student(student_obj, ga)

                # Contributing courses: show student's course_ga_score derived from StudentCLOScore (only <= current semester)
                cs_qs = CourseSession.objects.filter(batch=batch, is_active=True, assessment_status='ASSESSMENT_DONE', semester__number__lte=batch.current_semester)
                print("cs_qs count for student scope:", cs_qs.count())

                # For each course, compute one course_ga_score per student's course by using StudentCLOScore weighted sum.
                for session in cs_qs.select_related('course', 'semester'):
                    mappings = CLOGAMapping.objects.filter(clo__course=session.course, ga=ga, is_active=True, clo__is_active=True)
                    print(f"session:", session.course.code, "mappings count:", mappings.count())
                    if not mappings.exists():
                        continue
                    total_att = Decimal('0')
                    total_w = Decimal('0')
                    for m in mappings:
                        # Check if m.clo has a code field first
                        clo_code = None
                        if hasattr(m.clo, 'code'):
                            clo_code = m.clo.code
                        elif hasattr(m.clo, 'order_number'):
                            clo_code = f"CLO-{m.clo.order_number}"
                        clo_score = StudentCLOScore.objects.filter(student=student_obj, clo=m.clo, course_session=session).first()
                        print(f"clo:", clo_code, "clo_score:", clo_score)
                        if clo_score:
                            total_att += clo_score.attainment * m.weight
                            total_w += m.weight
                    if total_w > 0:
                        course_ga_score = round(total_att / total_w, 2)
                        print("course_ga_score for", session.course.code, "=", course_ga_score)
                        contributing_courses.append({
                            'course_code': session.course.code,
                            'course_name': session.course.name,
                            'course_ga_score': float(course_ga_score),
                            'enrolled_students': 1,
                            'semester': session.semester.number if session.semester else None,
                            'credits': session.course.credit_hours,
                        })

            if ga_attainment is None:
                # Not assessed if missing data
                status_str = 'NOT_ASSESSED'
            else:
                status_str = 'ACHIEVED' if float(ga_attainment) >= float(ga.kpi_threshold) else 'BELOW_TARGET'

            response_items.append({
                'ga_id': str(ga.id),
                'ga_code': ga_code,
                'ga_title': ga.title,
                'ga_attainment': float(ga_attainment) if ga_attainment is not None else None,
                'ga_kpi_threshold': float(ga.kpi_threshold),
                'status': status_str,
                'contributing_courses': contributing_courses,
                'ga_cqi_records': ga_cqi_records if (scope == 'cohort' and is_program_end_ready) else [],
            })

        print("=== returning response with response_items count:", len(response_items))
        # Return top-level object with is_program_end_ready and data
        return Response({
            'is_program_end_ready': is_program_end_ready,
            'ga_reports': response_items
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