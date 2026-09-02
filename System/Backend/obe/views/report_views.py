from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from decimal import Decimal
from django.db.models import Q
from core.models import Batch
from curriculum.models import CurriculumVersion
from students.models import Student
from assessments.models import Assessment, Question, StudentQuestionMark, CQI
from assessments.services.clo_service import CLOService
from ..models import CourseSession, CLO, GACQIRecord, PEOCQIRecord, VisionMissionCQI, VisionMissionCQIRecord
from ..services import get_teacher_ga_context, get_students_for_batch


class TeacherGAContextView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        batch_id = request.query_params.get('batch_id')
        context = get_teacher_ga_context(course_id, batch_id=batch_id)
        if 'error' in context:
            return Response(context, status=status.HTTP_404_NOT_FOUND)
        return Response(context)


class AlumniDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get current user
        user = request.user
        # Get student profile
        try:
            student = Student.objects.get(user=user)
        except Student.DoesNotExist:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Prefer the student profile batch, but fall back to the auth user's batch/original_batch
        # for alumni records that were moved or partially migrated.
        batch = student.batch or getattr(user, 'batch', None) or getattr(user, 'original_batch', None)
        program = batch.program if batch else None
        
        # Get all course sessions for the student's batch (current and past semesters)
        course_sessions = CourseSession.objects.filter(
            batch=batch,
            is_active=True
        ).select_related('course', 'semester', 'batch')
        
        # Calculate transcript data and CGPA
        transcript_data = []
        total_grade_points = Decimal('0')
        total_credits = Decimal('0')
        completed_courses = 0
        
        for session in course_sessions:
            # Get assessments for this session
            assessments = Assessment.objects.filter(
                course=session.course,
                batch=session.batch,
                semester=session.semester,
                is_finalized=True
            )
            if not assessments:
                continue
            
            # Get questions and marks for this session and student
            questions = Question.objects.filter(assessment__in=assessments)
            student_marks = StudentQuestionMark.objects.filter(
                student=student,
                question__in=questions
            )
            marks_map = {(m.question_id): m.marks_obtained for m in student_marks}
            
            # Calculate total obtained and total possible
            total_obtained = Decimal('0')
            total_possible = Decimal('0')
            for q in questions:
                total_possible += q.marks
                total_obtained += marks_map.get(q.id, Decimal('0'))
            
            # Calculate percentage
            percentage = 0.0
            gpa = 0.0
            if total_possible > 0:
                percentage = float((total_obtained / total_possible) * 100)
                if percentage >= 85:
                    gpa = 4.0
                elif percentage >= 75:
                    gpa = 3.5
                elif percentage >= 65:
                    gpa = 3.0
                elif percentage >= 50:
                    gpa = 2.0
                else:
                    gpa = 0.0
            
            # Add to transcript
            transcript_data.append({
                "semester": f"Semester {session.semester.number}" if session.semester else "N/A",
                "course_code": session.course.code,
                "course_name": session.course.name,
                "credits": session.course.credit_hours,
                "percentage": round(percentage, 2),
                "gpa": gpa
            })
            
            # Update totals for CGPA
            if total_possible > 0:
                total_grade_points += Decimal(str(gpa)) * Decimal(str(session.course.credit_hours))
                total_credits += Decimal(str(session.course.credit_hours))
                completed_courses += 1
        
        # Calculate CGPA
        cgpa = 0.0
        if total_credits > 0:
            cgpa = float(total_grade_points / total_credits)
            cgpa = round(cgpa, 2)
        
        # Group transcript by semester
        semester_transcripts = {}
        for entry in transcript_data:
            sem = entry['semester']
            if sem not in semester_transcripts:
                semester_transcripts[sem] = {
                    "semester": sem,
                    "courses": [],
                    "courses_count": 0
                }
            semester_transcripts[sem]["courses"].append(entry)
            semester_transcripts[sem]["courses_count"] += 1
        
        # Sort by semester number
        sorted_semesters = sorted(semester_transcripts.values(), key=lambda x: int(x['semester'].split(' ')[1]) if x['semester'] != "N/A" else 0)
        
        return Response({
            "name": student.name,
            "roll_no": student.registration_number,
            "batch_id": str(batch.id) if batch else None,
            "batch": batch.name if batch else "N/A",
            "program_id": str(program.id) if program else None,
            "program": program.name if program else "N/A",
            "graduation_year": "",  # To be added when available
            "cgpa": cgpa,
            "completed_courses": completed_courses,
            "current_employer": "",  # To be added when available
            "designation": "",  # To be added when available
            "transcripts": sorted_semesters
        })


class CourseCLOReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        try:
            session = CourseSession.objects.select_related('course', 'batch', 'semester', 'instructor').get(id=session_id, is_active=True)
        except CourseSession.DoesNotExist:
            return Response({'error': 'Course session not found'}, status=status.HTTP_404_NOT_FOUND)
        
        course = session.course
        
        # Get CLOs for this course
        version = None
        try:
            # Always prefer the batch's curriculum version
            if session.batch and session.batch.curriculum_version:
                version = session.batch.curriculum_version
            else:
                version = CurriculumVersion.objects.filter(program=course.program, is_active=True).first()
        except Exception:
            pass
        
        assessments = Assessment.objects.filter(
            course=course,
            batch=session.batch,
            semester=session.semester,
            is_finalized=True
        )

        # Get CLOs that are:
        # - From the batch's curriculum version, or (if no version) from questions
        clos_query = Q()
        if version:
            # Only take CLOs from this curriculum version
            clos_query = Q(is_active=True, course=course, curriculum_version=version)
        else:
            # Fallback: take CLOs linked to questions and those associated with any active version
            question_clos = Question.objects.filter(assessment__in=assessments).values_list('clo_id', flat=True)
            clos_query |= Q(id__in=question_clos)
            clos_query |= Q(is_active=True, course=course, curriculum_version__isnull=True)
        
        clos = CLO.objects.filter(clos_query).distinct()
        
        order_number_to_clo = {clo.order_number: clo for clo in clos}

        # Pre-fetch question and mark data for assessment mapping / effectiveness
        from ..services import get_students_enrolled_in_course
        students = list(get_students_enrolled_in_course(session))
        questions = list(
            Question.objects.filter(assessment__in=assessments)
            .select_related('assessment', 'clo')
        )
        
        # Remap any question's CLO to our current version's CLO if order number matches
        for q in questions:
            if q.clo and q.clo.order_number in order_number_to_clo:
                remapped_clo = order_number_to_clo[q.clo.order_number]
                q.clo = remapped_clo
                q.clo_id = remapped_clo.id  # Critical: also update the ID field!
        all_marks = list(
            StudentQuestionMark.objects.filter(
                student__in=students,
                question__in=questions
            ).select_related('student', 'question')
        )
        # Create a marks map for quick lookup
        marks_map = {
            (m.student_id, m.question_id): m.marks_obtained
            for m in all_marks
        }
        
        clo_service_result = CLOService.generate_student_report(
            course_id=course.id,
            batch_id=session.batch.id,
            semester_id=session.semester.id if session.semester else None,
        )

        service_students = (
            clo_service_result.get("students", [])
            if isinstance(clo_service_result, dict) and not clo_service_result.get("error")
            else []
        )
        class_clo = (
            clo_service_result.get("class_clo_attainment", {})
            if isinstance(clo_service_result, dict) and not clo_service_result.get("error")
            else {}
        )
        total_enrolled = len(service_students)

        clo_summary = []
        assessment_effectiveness = []

        for clo in clos:
            clo_code = clo.code if (hasattr(clo, 'code') and clo.code) else f'CLO-{clo.order_number}'
            clo_questions = [q for q in questions if q.clo_id == clo.id]

            service_entry = class_clo.get(clo_code, {})
            target_kpi = float(service_entry.get('kpi', clo.kpi_target))

            pass_count = 0
            for s in service_students:
                s_clo = (s.get('clo_attainment') or {}).get(clo_code)
                if s_clo and Decimal(str(s_clo.get('percentage', 0) or 0)) >= Decimal(str(s_clo.get('kpi', target_kpi) or target_kpi)):
                    pass_count += 1

            if isinstance(clo_service_result, dict) and clo_service_result.get("error"):
                overall_attainment = None
                status_str = 'NOT_ASSESSED'
            elif total_enrolled > 0:
                overall_attainment = round((Decimal(pass_count) / Decimal(total_enrolled)) * Decimal('100'), 2)
                overall_attainment = float(overall_attainment)
                status_str = 'ACHIEVED' if overall_attainment >= target_kpi else 'BELOW_TARGET'
            else:
                overall_attainment = None
                status_str = 'NOT_ASSESSED'

            mapped_assessments = []
            unmapped_assessments = []
            for assessment in assessments:
                has_mapped_question = any(q.assessment_id == assessment.id for q in clo_questions)
                assessment_data = {
                    'id': str(assessment.id),
                    'title': assessment.title,
                    'weightage': assessment.total_marks
                }
                if has_mapped_question:
                    mapped_assessments.append(assessment_data)
                else:
                    unmapped_assessments.append(assessment_data)

            clo_summary.append({
                'clo_code': clo_code,
                'description': clo.description,
                'target_kpi': target_kpi,
                'overall_attainment': overall_attainment,
                'status': status_str,
                'mapped_assessments': mapped_assessments,
                'unmapped_assessments': unmapped_assessments,
                'total_students': total_enrolled,
                'pass_count': pass_count,
                'fail_count': total_enrolled - pass_count if total_enrolled > 0 else 0,
            })

        for assessment in assessments:
            assessment_questions = [q for q in questions if q.assessment_id == assessment.id]
            total_assessment_marks = sum(q.marks for q in assessment_questions)
            avg_attainment = None

            if total_assessment_marks > 0 and len(service_students) > 0:
                total_obtained_all = Decimal('0')
                total_possible_all = Decimal('0')
                for student in service_students:
                    sid = student.get('student_id')
                    student_total = Decimal('0')
                    for q in assessment_questions:
                        key = (sid, q.id)
                        mark_val = marks_map.get(key, Decimal('0'))
                        try:
                            student_total += Decimal(str(mark_val))
                        except Exception:
                            pass
                    total_obtained_all += student_total
                    total_possible_all += Decimal(str(total_assessment_marks))
                if total_possible_all > 0:
                    avg_attainment = round(float((total_obtained_all / total_possible_all) * Decimal('100')), 2)

            mapped_clos = set()
            for q in assessment_questions:
                if q.clo:
                    remapped_clo = order_number_to_clo.get(q.clo.order_number)
                    if remapped_clo:
                        c = remapped_clo.code if (hasattr(remapped_clo, 'code') and remapped_clo.code) else f'CLO-{remapped_clo.order_number}'
                        mapped_clos.add(c)
                    else:
                        c = q.clo.code if (hasattr(q.clo, 'code') and q.clo.code) else f'CLO-{q.clo.order_number}'
                        mapped_clos.add(c)

            effectiveness = {
                'assessment': {
                    'id': str(assessment.id),
                    'title': assessment.title,
                    'weightage': assessment.total_marks
                },
                'mapped_clos': list(mapped_clos),
                'avg_attainment': avg_attainment,
                'effectiveness': 'EFFECTIVE' if avg_attainment and avg_attainment >= 70 else 'INEFFECTIVE'
            }
            assessment_effectiveness.append(effectiveness)
        
        cqi_list = []
        approved_cqis = (
            CQI.objects.filter(
                course=course,
                batch=session.batch,
                semester=session.semester,
                status='approved',
            )
            .select_related('clo', 'instructor', 'reviewed_by')
            .order_by('clo__order_number', '-updated_at')
        )

        for cqi in approved_cqis:
            clo_code = cqi.clo.code if hasattr(cqi.clo, 'code') and cqi.clo.code else f'CLO-{cqi.clo.order_number}'
            instructor_name = (
                getattr(cqi.instructor, 'full_name', None)
                or getattr(cqi.instructor, 'username', None)
                or ''
            )
            approved_by = ''
            if cqi.reviewed_by:
                approved_by = (
                    getattr(cqi.reviewed_by, 'full_name', None)
                    or getattr(cqi.reviewed_by, 'username', None)
                    or ''
                )

            cqi_list.append({
                'clo_code': clo_code,
                'clo_description': cqi.clo.description,
                'course_code': course.code,
                'reason': cqi.reason,
                'action_plan': cqi.action_plan,
                'instructor': instructor_name,
                'approved_by': approved_by,
                'status': cqi.status,
            })

        return Response({
            'course': {
                'code': course.code,
                'title': course.name,
                'semester': session.semester.number if session.semester else None,
                'batch': session.batch.name if session.batch else None,
                'session': str(session.id)
            },
            'clo_summary': clo_summary,
            'assessment_effectiveness': assessment_effectiveness,
            'cqi_list': cqi_list
        })


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


class CQIClosingSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _is_hod(request.user) and not getattr(request.user, 'is_superuser', False):
            return Response(
                {'error': 'Only HODs or superusers can view the CQI closing summary.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        dept_ids = _get_user_department_ids(request.user)
        by_department = bool(request.query_params.get('by_department', False))

        def _scope_for_dept(qs, dept_lookup):
            if by_department and dept_ids and not request.user.is_superuser:
                return qs.filter(**{f'{dept_lookup}__in': dept_ids})
            return qs

        ga_closures_qs = GACQIRecord.objects.filter(
            status='CLOSED_IMPLEMENTED',
            implemented_in_batch__isnull=False,
        ).select_related(
            'ga', 'batch', 'implemented_in_batch', 'closed_by',
        ).order_by('-closed_at', '-updated_at')
        ga_closures_qs = _scope_for_dept(
            ga_closures_qs, 'batch__program__department_id'
        )

        ga_cqi_closures = []
        for cqi in ga_closures_qs:
            flagged_info = None
            try:
                flagged_info = {
                    'ga_id': str(cqi.ga_id),
                    'ga_code': f'GA-{cqi.ga.order_number}' if cqi.ga else None,
                    'ga_title': cqi.ga.title if cqi.ga else None,
                    'triggered_batch_id': str(cqi.batch_id),
                    'triggered_batch_name': cqi.batch.name if cqi.batch else None,
                    'triggered_attainment': float(cqi.attainment_value) if cqi.attainment_value is not None else None,
                    'kpi_threshold_at_trigger': float(cqi.kpi_threshold_at_trigger) if cqi.kpi_threshold_at_trigger is not None else None,
                    'department': {
                        'id': str(cqi.batch.program.department_id),
                        'code': cqi.batch.program.department.code,
                        'name': cqi.batch.program.department.name,
                    } if (cqi.batch and cqi.batch.program and cqi.batch.program.department) else None,
                }
            except Exception:
                pass
            ga_cqi_closures.append({
                'id': str(cqi.id),
                'flagged': flagged_info or {
                    'ga_id': str(cqi.ga_id),
                    'batch_id': str(cqi.batch_id),
                },
                'closed_in_batch': {
                    'id': str(cqi.implemented_in_batch_id),
                    'name': cqi.implemented_in_batch.name if cqi.implemented_in_batch else None,
                } if cqi.implemented_in_batch_id else None,
                'action_taken': cqi.action_taken_description,
                'resulting_attainment': float(cqi.resulting_attainment) if cqi.resulting_attainment is not None else None,
                'closed_by': {
                    'id': str(cqi.closed_by_id),
                    'name': cqi.closed_by.full_name if cqi.closed_by else None,
                } if cqi.closed_by_id else None,
                'closed_date': cqi.closed_at.isoformat() if cqi.closed_at else None,
                'status': cqi.status,
            })

        peo_closures_qs = PEOCQIRecord.objects.filter(
            status='CLOSED_IMPLEMENTED',
            implemented_in_batch__isnull=False,
        ).select_related(
            'peo', 'batch', 'implemented_in_batch', 'closed_by',
        ).order_by('-closed_at', '-updated_at')
        peo_closures_qs = _scope_for_dept(
            peo_closures_qs, 'batch__program__department_id'
        )

        peo_cqi_closures = []
        for cqi in peo_closures_qs:
            flagged_info = None
            try:
                flagged_info = {
                    'peo_id': str(cqi.peo_id),
                    'peo_code': f'PO-{cqi.peo.order_number}' if cqi.peo else None,
                    'peo_title': cqi.peo.title if cqi.peo else None,
                    'triggered_batch_id': str(cqi.batch_id),
                    'triggered_batch_name': cqi.batch.name if cqi.batch else None,
                    'triggered_attainment': float(cqi.attainment_value) if cqi.attainment_value is not None else None,
                    'kpi_threshold_at_trigger': float(cqi.kpi_threshold_at_trigger) if cqi.kpi_threshold_at_trigger is not None else None,
                    'department': {
                        'id': str(cqi.batch.program.department_id),
                        'code': cqi.batch.program.department.code,
                        'name': cqi.batch.program.department.name,
                    } if (cqi.batch and cqi.batch.program and cqi.batch.program.department) else None,
                }
            except Exception:
                pass
            peo_cqi_closures.append({
                'id': str(cqi.id),
                'flagged': flagged_info or {
                    'peo_id': str(cqi.peo_id),
                    'batch_id': str(cqi.batch_id),
                },
                'closed_in_batch': {
                    'id': str(cqi.implemented_in_batch_id),
                    'name': cqi.implemented_in_batch.name if cqi.implemented_in_batch else None,
                } if cqi.implemented_in_batch_id else None,
                'action_taken': cqi.action_taken_description,
                'resulting_attainment': float(cqi.resulting_attainment) if cqi.resulting_attainment is not None else None,
                'closed_by': {
                    'id': str(cqi.closed_by_id),
                    'name': cqi.closed_by.full_name if cqi.closed_by else None,
                } if cqi.closed_by_id else None,
                'closed_date': cqi.closed_at.isoformat() if cqi.closed_at else None,
                'status': cqi.status,
            })

        vm_cqi_closures_qs = VisionMissionCQI.objects.filter(
            status='CLOSED_IMPLEMENTED',
            implemented_in_batch__isnull=False,
            is_active=True,
        ).select_related(
            'batch', 'batch__program', 'batch__program__department',
            'implemented_in_batch', 'closed_by',
            'mission_keyword', 'vision_keyword',
        ).order_by('-closed_at', '-updated_at')
        vm_cqi_closures_qs = _scope_for_dept(
            vm_cqi_closures_qs, 'batch__program__department_id'
        )

        vision_mission_cqi_closures = []
        for cqi in vm_cqi_closures_qs:
            keyword = cqi.mission_keyword or cqi.vision_keyword
            department = cqi.batch.program.department if cqi.batch and cqi.batch.program else None
            vision_mission_cqi_closures.append({
                'id': str(cqi.id),
                'flagged': {
                    'statement_type': cqi.keyword_type,
                    'keyword': keyword.text if keyword else None,
                    'triggered_batch_id': str(cqi.batch_id),
                    'triggered_batch_name': cqi.batch.name if cqi.batch else None,
                    'triggered_attainment': float(cqi.attainment_value) if cqi.attainment_value is not None else None,
                    'kpi_threshold_at_trigger': float(cqi.kpi_threshold_at_trigger) if cqi.kpi_threshold_at_trigger is not None else None,
                    'department': {
                        'id': str(department.id),
                        'code': department.code,
                        'name': department.name,
                    } if department else None,
                },
                'closed_in_batch': {
                    'id': str(cqi.implemented_in_batch_id),
                    'name': cqi.implemented_in_batch.name if cqi.implemented_in_batch else None,
                } if cqi.implemented_in_batch_id else None,
                'action_taken': cqi.action_taken_description,
                'resulting_attainment': float(cqi.resulting_attainment) if cqi.resulting_attainment is not None else None,
                'closed_by': {
                    'id': str(cqi.closed_by_id),
                    'name': cqi.closed_by.full_name if cqi.closed_by else None,
                } if cqi.closed_by_id else None,
                'closed_date': cqi.closed_at.isoformat() if cqi.closed_at else None,
                'status': cqi.status,
            })

        vm_qs = VisionMissionCQIRecord.objects.filter(
            status='REVIEWED',
            is_active=True,
        ).select_related(
            'department', 'reviewed_by',
        ).order_by('-review_date', '-created_at')
        vm_qs = _scope_for_dept(vm_qs, 'department_id')

        vision_mission_reviews = []
        for vm in vm_qs:
            vision_mission_reviews.append({
                'id': str(vm.id),
                'flagged': {
                    'statement_type': vm.statement_type,
                    'trigger_type': vm.trigger_type,
                    'department': {
                        'id': str(vm.department_id),
                        'code': vm.department.code if vm.department else None,
                        'name': vm.department.name if vm.department else None,
                    },
                    'previous_statement_snapshot': vm.previous_statement_snapshot,
                },
                'closed_in_batch': None,
                'action_taken': {
                    'decision': vm.decision,
                    'justification': vm.justification,
                    'new_statement': vm.new_statement,
                },
                'resulting_outcome': vm.decision,
                'reviewed_by': {
                    'id': str(vm.reviewed_by_id),
                    'name': vm.reviewed_by.full_name if vm.reviewed_by else None,
                } if vm.reviewed_by_id else None,
                'review_date': vm.review_date.isoformat() if vm.review_date else None,
                'status': vm.status,
            })

        return Response({
            'ga_cqi_closures': ga_cqi_closures,
            'peo_cqi_closures': peo_cqi_closures,
            'vision_mission_cqi_closures': vision_mission_cqi_closures,
            'vision_mission_reviews': vision_mission_reviews,
        }, status=status.HTTP_200_OK)

