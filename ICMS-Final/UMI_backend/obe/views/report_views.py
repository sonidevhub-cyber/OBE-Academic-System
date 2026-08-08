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
from ..models import CourseSession, CLO
from ..services import get_teacher_ga_context


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
        
        print(f"DEBUG: CourseSession - {session.id}, course: {session.course}, batch: {session.batch}, semester: {session.semester}")
        
        # Get Course info
        course = session.course
        
        # Get CLOs for this course
        version = None
        try:
            if session.batch.curriculum_version:
                version = session.batch.curriculum_version
            else:
                version = CurriculumVersion.objects.filter(program=course.program, is_active=True).first()
        except Exception:
            pass
        
        # First get all finalized assessments for this session
        assessments = Assessment.objects.filter(
            course=course,
            batch=session.batch,
            semester=session.semester,
            is_finalized=True
        )
        print(f"\nDEBUG: CourseSession: {session.id}, course={course.id}, batch={session.batch.id}, semester={session.semester.id if session.semester else None}")
        print(f"DEBUG: Number of assessments found: {len(assessments)}")
        for a in assessments:
            print(f"DEBUG: Assessment {a.id} ({a.title}): course={a.course.id if a.course else None}, batch={a.batch.id if a.batch else None}, semester={a.semester.id if a.semester else None}")
        
        # Get CLOs that are:
        # - From the batch's curriculum version, or (if no version) from questions
        clos_query = Q()
        if version:
            # Only take CLOs from this curriculum version
            clos_query |= Q(is_active=True, course=course, curriculum_version=version)
        else:
            # Fallback: take CLOs linked to questions and those associated with any active version
            question_clos = Question.objects.filter(assessment__in=assessments).values_list('clo_id', flat=True)
            clos_query |= Q(id__in=question_clos)
            clos_query |= Q(is_active=True, course=course, curriculum_version__isnull=True)
        
        clos = CLO.objects.filter(clos_query).distinct()
        
        # Map order number to our current CLO for remapping
        order_number_to_clo = {clo.order_number: clo for clo in clos}
        
        print(f"DEBUG: Found {len(assessments)} assessments")
        for a in assessments:
            print(f"DEBUG: Assessment - {a.id}, {a.title}")
        
        # Pre-fetch all relevant data FIRST (like CLOService does)
        students = list(Student.objects.filter(user__batch=session.batch))
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
        
        clo_summary = []
        assessment_effectiveness = []
        
        for clo in clos:
            print(f"DEBUG: Processing CLO - {clo.id}, {clo.order_number}")
            # Get questions mapped to this CLO
            clo_questions = [q for q in questions if q.clo_id == clo.id]
            
            print(f"DEBUG: Found {len(clo_questions)} questions for CLO")
            
            # Calculate overall CLO attainment
            total_clo_marks = sum(q.marks for q in clo_questions)
            overall_attainment = None
            if total_clo_marks > 0:
                total_obtained_all = Decimal('0')
                total_possible_all = Decimal('0')
                
                for student in students:
                    student_total = sum(
                        marks_map.get((student.student_id, q.id), Decimal('0'))
                        for q in clo_questions
                    )
                    total_obtained_all += student_total
                    total_possible_all += total_clo_marks
                
                if total_possible_all > 0:
                    overall_attainment = round(float((total_obtained_all / total_possible_all) * 100), 2)
                    print(f"DEBUG: total_obtained_all={total_obtained_all}, total_possible_all={total_possible_all}, overall_attainment={overall_attainment}")
            
            # Determine status
            if overall_attainment is not None:
                if overall_attainment >= clo.kpi_target:
                    status_str = 'ACHIEVED'
                else:
                    status_str = 'BELOW_TARGET'
            else:
                status_str = 'NOT_ASSESSED'
            
            # Get mapped and unmapped assessments
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
                'clo_code': clo.code if hasattr(clo, 'code') else f'CLO-{clo.order_number}',
                'description': clo.description,
                'target_kpi': float(clo.kpi_target),
                'overall_attainment': overall_attainment,
                'status': status_str,
                'mapped_assessments': mapped_assessments,
                'unmapped_assessments': unmapped_assessments
            })

        # Calculate assessment effectiveness
        for assessment in assessments:
            print(f"\nDEBUG: Calculating effectiveness for assessment: {assessment.title} (id: {assessment.id})")
            assessment_questions = [q for q in questions if q.assessment_id == assessment.id]
            print(f"DEBUG: Found {len(assessment_questions)} questions for this assessment")
            total_assessment_marks = sum(q.marks for q in assessment_questions)
            print(f"DEBUG: total_assessment_marks: {total_assessment_marks}")
            avg_attainment = None
            
            if total_assessment_marks > 0:
                # Calculate per student, then average (like CLOService)
                total_obtained_all = Decimal('0')
                total_possible_all = Decimal('0')
                
                for student in students:
                    student_total = sum(
                        marks_map.get((student.student_id, q.id), Decimal('0'))
                        for q in assessment_questions
                    )
                    total_obtained_all += student_total
                    total_possible_all += total_assessment_marks
                
                if total_possible_all > 0:
                    avg_attainment = round(float((total_obtained_all / total_possible_all) * 100), 2)
                    print(f"DEBUG: total_obtained_all: {total_obtained_all}, total_possible_all: {total_possible_all}, avg_attainment: {avg_attainment}")
            
            # Get mapped CLOs (remapped to current curriculum version if possible)
            mapped_clos = set()
            for q in assessment_questions:
                if q.clo:
                    remapped_clo = order_number_to_clo.get(q.clo.order_number)
                    if remapped_clo:
                        clo_code = remapped_clo.code if hasattr(remapped_clo, 'code') else f'CLO-{remapped_clo.order_number}'
                        mapped_clos.add(clo_code)
                    else:
                        # Fallback to original if no matching order number
                        clo_code = q.clo.code if hasattr(q.clo, 'code') else f'CLO-{q.clo.order_number}'
                        mapped_clos.add(clo_code)
            
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

        print(f"DEBUG: clo_summary: {clo_summary}")
        print(f"DEBUG: assessment_effectiveness: {assessment_effectiveness}")
        
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

