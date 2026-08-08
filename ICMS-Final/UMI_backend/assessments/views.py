from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import Sum
from decimal import Decimal
from rest_framework.decorators import api_view
from rest_framework.response import Response
from students.models import Student
from .models import Assessment, StudentAssessment

import uuid


from .models import (
    Assessment,
    Question,
    StudentAssessment,
    StudentQuestionMark
)
from core.models import Batch, Semester

from students.models import Student
from obe.models import CLO, GA
from .serializer import AssessmentCreateSerializer, AssessmentDetailSerializer


QUESTION_BLOOM_LEVEL_MAP = {
    "K1": "K1",
    "K2": "K2",
    "K3": "K3",
    "K4": "K4",
    "K5": "K5",
    "K6": "K6",
    "C1": "K1",
    "C2": "K2",
    "C3": "K3",
    "C4": "K4",
    "C5": "K5",
    "C6": "K6",
    "REMEMBER": "K1",
    "REMEMBERING": "K1",
    "UNDERSTAND": "K2",
    "UNDERSTANDING": "K2",
    "APPLY": "K3",
    "APPLYING": "K3",
    "ANALYZE": "K4",
    "ANALYZING": "K4",
    "EVALUATE": "K5",
    "EVALUATING": "K5",
    "CREATE": "K6",
    "CREATING": "K6",
}


def normalize_question_bloom_level(level):
    if level is None:
        return None
    normalized = str(level).strip().upper()
    if normalized in QUESTION_BLOOM_LEVEL_MAP:
        return QUESTION_BLOOM_LEVEL_MAP[normalized]

    first_token = normalized.split()[0] if normalized else ""
    if first_token in QUESTION_BLOOM_LEVEL_MAP:
        return QUESTION_BLOOM_LEVEL_MAP[first_token]

    if "-" in normalized:
        label = normalized.split("-", 1)[1].strip()
        return QUESTION_BLOOM_LEVEL_MAP.get(label)

    return None


class AssessmentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        course_id = request.GET.get('course')
        batch_id = request.GET.get('batch')
        semester_id = request.GET.get('semester')

        queryset = Assessment.objects.filter(instructor=request.user)

        if course_id:
            queryset = queryset.filter(course_id=course_id)
        if batch_id:
            queryset = queryset.filter(batch_id=batch_id)
        if semester_id:
            queryset = queryset.filter(semester_id=semester_id)

        serializer = AssessmentDetailSerializer(queryset, many=True)
        return Response(serializer.data)


class CLOCoverageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        course_id = request.data.get("course")
        curriculum_version_id = request.data.get("curriculum_version")
        current_clos = set(str(clo) for clo in request.data.get("current_clos", []) if clo)

        if not course_id:
            return Response({"error": "course is required"}, status=400)

        from django.db.models import Q

        clos_query = Q(course_id=course_id, is_active=True)
        if curriculum_version_id:
            clos_query &= Q(curriculum_version_id=curriculum_version_id)

        required_clos = list(
            CLO.objects.filter(clos_query)
            .order_by("order_number")
            .values("id", "order_number", "description")
        )

        missing_clos = [
            {
                "id": str(clo["id"]),
                "order": clo["order_number"],
                "description": clo["description"],
            }
            for clo in required_clos
            if str(clo["id"]) not in current_clos
        ]

        return Response({
            "all_clos_covered": len(missing_clos) == 0,
            "missing_clos": missing_clos,
        })


class CreateAssessmentView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):

        # ✅ SERIALIZER VALIDATION
        serializer = AssessmentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        questions = data.get('questions', [])
        
        # ✅ RETAKE ID (optional)
        retake_id = request.data.get('retake_id')
        course_retake = None
        if retake_id:
            from retake.models import CourseRetake
            course_retake = CourseRetake.objects.get(id=retake_id)

        # ✅ EMPTY CHECK
        if not questions:
            return Response({"error": "At least one question required"}, status=400)

        # ✅ MARKS VALIDATION
        total_q_marks = sum(Decimal(str(q['marks'])) for q in questions)

        if total_q_marks != Decimal(str(data['total_marks'])):
            return Response({
                "error": "Question marks must equal total marks"
            }, status=400)

        # ✅ BATCH
        try:
            batch = Batch.objects.get(id=data['batch'])
        except Batch.DoesNotExist:
            return Response({"error": "Invalid batch"}, status=400)

        # ✅ SEMESTER AUTO
        try:
            semester = Semester.objects.get(
                program=batch.program,
                number=batch.current_semester
            )
        except Semester.DoesNotExist:
            return Response({"error": "Semester not found"}, status=400)

        # ✅ CHECK IF FINAL IS ALREADY FINALIZED (for retake and non-retake)
        final_check_query = Assessment.objects.filter(
            course_id=data['course'],
            assessment_type='final',
            is_finalized=True
        )
        if course_retake:
            final_check_query = final_check_query.filter(course_retake=course_retake)
        else:
            final_check_query = final_check_query.filter(
                batch=batch,
                semester=semester
            )
            
        if final_check_query.exists():
            return Response({"error": "Final exam already submitted, no more assessments allowed"}, status=400)

        # ✅ DUPLICATE CHECK (for retake and non-retake)
        if data['type'] in ['midterm', 'final']:
            duplicate_check_query = Assessment.objects.filter(
                course_id=data['course'],
                assessment_type=data['type']
            )
            if course_retake:
                duplicate_check_query = duplicate_check_query.filter(course_retake=course_retake)
            else:
                duplicate_check_query = duplicate_check_query.filter(
                    batch=batch,
                    semester=semester
                )
                
            if duplicate_check_query.exists():
                return Response({
                    "error": f"{data['type']} already exists"
                }, status=400)
    
        # ✅ CLO VALIDATION: get CLOs for the course and the batch's curriculum version (if any)
        from django.db.models import Q
        clos_query = Q(course_id=data['course'], is_active=True)
        if batch.curriculum_version:
            clos_query |= Q(curriculum_version=batch.curriculum_version)
        valid_clos = set(
            CLO.objects.filter(clos_query)
            .values_list('id', flat=True)
        )

        for q in questions:
            if q['clo'] not in valid_clos:
                return Response({
                    "error": f"CLO {q['clo']} invalid"
                }, status=400)
            normalized_level = normalize_question_bloom_level(q.get("level"))
            if not normalized_level:
                return Response({
                    "error": f"Invalid Bloom level {q.get('level')}"
                }, status=400)
            q["level"] = normalized_level

        # ✅ CREATE ASSESSMENT
        assessment = Assessment.objects.create(
            course_id=data['course'],
            batch=batch,
            semester=semester,
            instructor=request.user,
            title=data['title'],
            assessment_type=data['type'],
            total_marks=data['total_marks'],
            assessment_date=data['date'],
            course_retake=course_retake
        )

        # ✅ CREATE QUESTIONS
        questions_objs = Question.objects.bulk_create([
            Question(
                assessment=assessment,
                clo_id=q['clo'],
                description=q['description'],
                bloom_level=q["level"],
                marks=q['marks']
            )
            for q in questions
        ])

        # ✅ STUDENTS (only retake student if course_retake exists)
        if course_retake:
            students = [course_retake.student]
        else:
            students = Student.objects.filter(
                user__batch=batch,
                # status='enrolled'
            )

        if not students:
            return Response({
                "error": "No students found"
            }, status=400)

        # ✅ STUDENT TOTAL RECORD
        StudentAssessment.objects.bulk_create([
            StudentAssessment(
                student=s,
                assessment=assessment,
                marks_obtained=0,
                course_retake=course_retake
            )
            for s in students
        ])

        # 🔥 CORE OBE (MOST IMPORTANT)
        StudentQuestionMark.objects.bulk_create([
            StudentQuestionMark(
                student=s,
                question=q,
                marks_obtained=0,
                course_retake=course_retake
            )
            for s in students
            for q in questions_objs
        ])

        return Response({
    "message": "Assessment created successfully",
    "assessment_id": str(assessment.id),
    "questions": [
        {
            "id": str(q.id),
            "clo": str(q.clo.id)
        }
        for q in questions_objs
    ]
}, status=201)
from assessments.services.clo_service import CLOService
from obe.views.ga_views import mark_existing_sessions_as_done
from obe.services import calculate_all_course_ga_scores, check_and_trigger_ga_cqi
from obe.models import CourseSession, GA
from assessments.models import CLOAttainment
from retake.invalidation_service import sync_retake_reports_from_assessment

class EnterMarksView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, assessment_id):

        data = request.data

        # ✅ Step 1: Assessment fetch karo
        try:
            assessment = Assessment.objects.get(
                id=assessment_id,
                instructor=request.user
            )
        except Assessment.DoesNotExist:
            return Response({"error": "Assessment not found"}, status=404)

        # ✅ Step 2: Course session fetch karo (assessment mile ke baad)
        course_session = CourseSession.objects.filter(
            course=assessment.course,
            batch=assessment.batch,
            semester=assessment.semester
        ).first()
        

        # ✅ Step 3: Finalized check
        if assessment.is_finalized:
            if not course_session or not course_session.allow_result_editing:
                return Response({
                    "error": "Marks already finalized. Admin must enable editing."
                }, status=400)

        # ✅ Step 3: Marks save karo
        for entry in data:
            StudentQuestionMark.objects.update_or_create(
                student_id=entry['student_id'],
                question_id=entry['question_id'],
                course_retake=assessment.course_retake,
                defaults={'marks_obtained': entry['marks']}
            )

        # ✅ Step 5: Total marks update karo
        if assessment.course_retake:
            students = [assessment.course_retake.student]
        else:
            students = Student.objects.filter(user__batch=assessment.batch)

        for s in students:
            query = StudentQuestionMark.objects.filter(
                student=s,
                question__assessment=assessment
            )
            if assessment.course_retake:
                query = query.filter(course_retake=assessment.course_retake)
                
            total = query.aggregate(total=Sum('marks_obtained'))['total'] or 0

            student_assessment_query = StudentAssessment.objects.filter(
                student=s,
                assessment=assessment
            )
            if assessment.course_retake:
                student_assessment_query = student_assessment_query.filter(course_retake=assessment.course_retake)
            
            student_assessment = student_assessment_query.first()
            if student_assessment:
                student_assessment.marks_obtained = total
                student_assessment.save(update_fields=["marks_obtained", "percentage"])

        # ✅ Step 6: Assessment finalize karo
        assessment.is_finalized = True
        assessment.save()

        # ✅ Step 7: allow_result_editing reset karo agar tha
        if course_session and course_session.allow_result_editing:
            course_session.allow_result_editing = False
            course_session.save()

        # ✅ Step 8: Check if this is a retake assessment OR it's a normal final assessment (case-insensitive)
        is_retake_assessment = assessment.course_retake is not None
        is_normal_final_assessment = assessment.assessment_type.strip().lower() == "final" and assessment.course_retake is None

        is_course_session_finalized = is_normal_final_assessment
        has_weak_clo = False  # default

        # If it's a retake assessment OR it's a normal final assessment, recalculate everything
        if is_course_session_finalized or is_retake_assessment:
            print(f"[EnterMarksView] Recalculating because {'it\'s a retake' if is_retake_assessment else 'all normal assessments are finalized'} for course {assessment.course_id}, "
                  f"batch {assessment.batch_id}, semester {assessment.semester_id}")

            if is_retake_assessment:
                # ✅ For retake: Use the existing sync function that handles CourseRetake update
                print(f"[EnterMarksView] Using sync_retake_reports_from_assessment for retake")
                processed_retake = sync_retake_reports_from_assessment(assessment)
                print(f"[EnterMarksView] Processed retake: {processed_retake.id if processed_retake else None}")

                # Weak CLOs check
                weak_clos = CLOAttainment.objects.filter(
                    course=assessment.course,
                    batch=assessment.batch,
                    semester=assessment.semester,
                    is_achieved=False
                )
                has_weak_clo = weak_clos.exists()
            else:
                # ✅ Step 9: CLO report generate karo
                CLOService.generate_student_report(
                    course_id=assessment.course_id,
                    batch_id=assessment.batch_id,
                    semester_id=assessment.semester_id
                )

                # ✅ Step 10: Weak CLOs check karo
                weak_clos = CLOAttainment.objects.filter(
                    course=assessment.course,
                    batch=assessment.batch,
                    semester=assessment.semester,
                    is_achieved=False
                )
                has_weak_clo = weak_clos.exists()

                # ✅ Step 11: Get or create CourseSession first (without finalizing yet)
                course_session, created = CourseSession.objects.update_or_create(
                    course_id=assessment.course_id,
                    batch_id=assessment.batch_id,
                    semester_id=assessment.semester_id,
                    defaults={
                        'instructor': assessment.instructor,
                        'is_active': True
                    }
                )
                
                # ✅ Step 12: Calculate GA scores (which creates StudentCLOScore records) FIRST!
                calculate_all_course_ga_scores(course_session)
                
                print(f"[EnterMarksView] Calculated GA scores for CourseSession: {course_session.id}")
                
                # ✅ Step 13: Now set CourseSession to ASSESSMENT_DONE and save to trigger signals!
                course_session.assessment_done = True
                course_session.assessment_status = "ASSESSMENT_DONE"
                course_session.save()
                
                print(f"[EnterMarksView] CourseSession {'created' if created else 'updated'}: "
                      f"{course_session.id} - status set to ASSESSMENT_DONE")

                # ✅ Step 13: Existing sessions mark as done
                mark_existing_sessions_as_done(assessment.batch, assessment.semester)

                # ✅ Step 14: Semester-level CQI check
                # ✅ Step 15: Cumulative-level CQI check
                if assessment.batch.is_program_end_ready:
                    gas = GA.objects.filter(
                        program=assessment.batch.program,
                        is_active=True
                    )
                    for ga in gas:
                        check_and_trigger_ga_cqi(assessment.batch, ga)

        return Response({
            "message": "Marks saved and finalized",
            "is_final": is_course_session_finalized,
            "has_weak_clo": has_weak_clo,
            "trigger_cqi": has_weak_clo,
            "next_step": (
                "CQI_REQUIRED"
                if has_weak_clo
                else "REPORT_TO_COORDINATOR"
            )
        }, status=200)    
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import CQI
from .serializer import CQISerializer
from obe.models import CLO   # 🔥 IMPORTANT

from core.models import Batch, Semester

class CQIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        course = request.GET.get("course")
        batch = request.GET.get("batch")
        semester_number = request.GET.get("semester")

        if not course or not batch or not semester_number:
            return Response({"error": "Missing parameters"}, status=400)

        try:
            # Validate UUIDs
            course_uuid = uuid.UUID(course)
            batch_uuid = uuid.UUID(batch)
        except ValueError:
            return Response({"error": "Invalid UUID format"}, status=400)

        try:
            # Validate semester number
            semester_number = int(semester_number)
        except (ValueError, TypeError):
            return Response({"error": "Invalid semester number format"}, status=400)

        try:
            from core.models import Batch, Semester
            # 🔥 Batch object
            batch_obj = Batch.objects.get(id=batch_uuid)

            # 🔥 Semester object (number → actual object)
            semester_obj = Semester.objects.get(
                number=semester_number,
                program=batch_obj.program
            )

        except Batch.DoesNotExist:
            return Response({"error": "Invalid batch"}, status=400)

        except Semester.DoesNotExist:
            return Response({"error": "Semester not found"}, status=400)

        # 🔥 FINAL FILTER
        data = CQI.objects.filter(
            course_id=course_uuid,
            batch_id=batch_uuid,
            semester=semester_obj
        )

        return Response(CQISerializer(data, many=True).data)

    def post(self, request):
        data = request.data
        try:
            course_uuid = uuid.UUID(data['course'])
            batch_uuid = uuid.UUID(data['batch'])
            semester_uuid = uuid.UUID(data['semester'])
            clo_uuid = uuid.UUID(data['clo'])
        except ValueError:
            return Response({"error": "Invalid UUID format"}, status=400)
        
        try:
            from core.models import Course, Batch, Semester
            from obe.models import CLO
            course = Course.objects.get(id=course_uuid)
            batch = Batch.objects.get(id=batch_uuid)
            semester = Semester.objects.get(id=semester_uuid)
            clo = CLO.objects.get(id=clo_uuid)
        except (Course.DoesNotExist, Batch.DoesNotExist, Semester.DoesNotExist, CLO.DoesNotExist):
            return Response({"error": "Invalid course, batch, semester, or clo"}, status=400)
        
        try:
            # Get or create CQI
            cqi, created = CQI.objects.get_or_create(
                course=course,
                batch=batch,
                semester=semester,
                clo=clo,
                instructor=request.user,
                defaults={
                    'reason': data['reason'],
                    'action_plan': data['action_plan']
                }
            )
            if not created:
                # No HOD approval needed, auto-approve
                cqi.reason = data['reason']
                cqi.action_plan = data['action_plan']
                cqi.status = 'approved'
                cqi.show_next_offering = True
                cqi.save()
            else:
                # Auto-approve new CQI
                cqi.status = 'approved'
                cqi.show_next_offering = True
                cqi.save()
        except Exception as e:
            return Response({"error": str(e)}, status=400)
        
        return Response({"message": "CQI saved successfully"}, status=201)
from assessments.models import CLOAttainment

class CheckCQIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, assessment_id):

        try:
            assessment = Assessment.objects.get(id=assessment_id)
        except Assessment.DoesNotExist:
            return Response({"error": "Not found"}, status=404)

        # ❌ Only final allowed
        if assessment.assessment_type != "final" or not assessment.is_finalized:
            return Response({"show_cqi": False})

        # 🔥 STEP 1: Weak CLO check
        weak_clos = CLOAttainment.objects.filter(
            course=assessment.course,
            batch=assessment.batch,
            semester=assessment.semester,
            is_achieved=False
        )

        # ✅ No weak CLO → No CQI
        if not weak_clos.exists():
            return Response({
                "show_cqi": False,
                "message": "All CLOs achieved ✅"
            })

        # 🔥 STEP 2: Already submitted check
        submitted_clos = CQI.objects.filter(
            course_id=assessment.course_id,
            batch_id=assessment.batch_id,
            semester_id=assessment.semester_id,
            instructor=request.user,
            status__in=['pending', 'approved']
        ).values_list('clo' , flat=True)

        remaining_clos = [
            c for c in weak_clos if str(c.clo.id) not in submitted_clos
        ]
        if not remaining_clos:
            return Response({
                "show_cqi": False,
                "message": "CQI already submitted for all weak CLOs"
            })

        # ✅ Show CQI with weak CLO list
        return Response({
            "show_cqi": True,
            "weak_clos": [
                {
                    "clo": str(c.clo.id),
                    "attainment": float(c.attained_percentage),
                    "kpi": float(c.kpi_target)
                }
                for c in remaining_clos
            ]
        })

class UpdateCQIStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, cqi_id):

        try:
            cqi = CQI.objects.get(id=cqi_id)
        except CQI.DoesNotExist:
            return Response({"error": "CQI not found"}, status=404)

        status = request.data.get("status")

        if status not in ["approved", "rejected"]:
            return Response({"error": "Invalid status"}, status=400)

        # Update status
        cqi.status = status
        cqi.reviewed_by = request.user
        
        # Accept both coordinator_comment and hod_comment for backwards compatibility
        if "coordinator_comment" in request.data:
            cqi.coordinator_comment = request.data.get("coordinator_comment", "")
        if "hod_comment" in request.data:
            cqi.hod_comment = request.data.get("hod_comment", "")

        # ✅ If Coordinator approves
        if status == "approved":
            cqi.show_next_offering = True

        # ✅ If Coordinator rejects
        elif status == "rejected":
            cqi.show_next_offering = False

        cqi.save()

        return Response({
            "message": f"CQI {status} successfully"
        })


class HODCQIListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get all CQI records
        cqis = CQI.objects.select_related(
            'course', 'batch', 'semester', 'clo', 'instructor'
        ).order_by('-created_at')

        data = []
        for cqi in cqis:
            clo_display = f"CLO-{cqi.clo.order_number}: {cqi.clo.description}" if cqi.clo else "Unknown CLO"
            instructor_name = cqi.instructor.full_name if hasattr(cqi.instructor, 'full_name') else cqi.instructor.username
            data.append({
                "id": cqi.id,
                "clo_display": clo_display,
                "status": cqi.status,
                "instructor_name": instructor_name,
                "reason": cqi.reason,
                "action_plan": cqi.action_plan,
                "hod_comment": cqi.hod_comment,
                "coordinator_comment": cqi.coordinator_comment,
                "created_at": cqi.created_at,
                "updated_at": cqi.updated_at
            })

        return Response(data)
import uuid
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import CQI


import uuid
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Count, Q

from .models import CQI


class CheckCQIStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        course = request.GET.get("course")
        batch = request.GET.get("batch")
        semester_number = request.GET.get("semester")  # 👈 number

        # ✅ 1. Check missing params
        if not course or not batch or not semester_number:
            return Response(
                {"error": "Missing required parameters"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ✅ 2. Validate ONLY course & batch UUID
        try:
            course_uuid = uuid.UUID(course)
            batch_uuid = uuid.UUID(batch)
        except ValueError:
            return Response(
                {"error": "Invalid UUID format"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ✅ 3. Validate semester number is integer
        try:
            semester_number = int(semester_number)
        except (ValueError, TypeError):
            return Response(
                {"error": "Invalid semester number format"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 🔥 4. Convert semester number → object
        from academic_structure.models import Batch, Semester

        try:
            batch_obj = Batch.objects.get(id=batch_uuid)
        except Batch.DoesNotExist:
            return Response(
                {"error": "Batch not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            semester_obj = Semester.objects.get(
                number=semester_number,
                program=batch_obj.program
            )
        except Semester.DoesNotExist:
            return Response(
                {"error": "Semester not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # ✅ 4. Query
        cqis = CQI.objects.filter(
            course_id=course_uuid,
            batch_id=batch_uuid,
            semester=semester_obj,   # ✅ FIX
            
        )

        # ✅ 5. No data
        if not cqis.exists():
            return Response({
                "status": "none",
                "items": []
            })

        # ✅ 6. Items
        items = [
            {
                "id": c.id,
                "clo": c.clo.id,
                "status": c.status,
                "coordinator_comment": c.coordinator_comment
            }
            for c in cqis
        ]

        # ✅ 7. Overall status
        stats = cqis.aggregate(
            total=Count("id"),
            approved_count=Count("id", filter=Q(status="approved"))
        )

        overall_status = (
            "approved"
            if stats["total"] == stats["approved_count"]
            else "pending"
        )

        return Response({
            "status": overall_status,
            "items": items
        }, status=status.HTTP_200_OK)
class ResubmitCQIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, cqi_id):

        try:
            cqi = CQI.objects.get(
                id=cqi_id,
                instructor=request.user,
                status='rejected'
            )
        except CQI.DoesNotExist:
            return Response({"error": "CQI not found"}, status=404)

        cqi.reason = request.data.get("reason", cqi.reason)
        cqi.action_plan = request.data.get("action_plan", cqi.action_plan)

        # 🔥 Auto-approve on resubmit
        cqi.status = "approved"
        cqi.show_next_offering = True

        cqi.save()

        return Response({"message": "CQI resubmitted"})
from django.db.models import Sum

@api_view(['GET'])
def student_result(request):

    try:
        student = Student.objects.get(user=request.user)
    except Student.DoesNotExist:
        return Response({"error": "Student not found"}, status=404)

    # 🔥 GROUP BY ASSESSMENT
    assessments = (
        StudentAssessment.objects
        .filter(student=student)
        .values('assessment')
        .annotate(total_obtained=Sum('marks_obtained'))
    )

    result = []
    total_obtained_all = 0
    total_marks_all = 0

    for a in assessments:
        assessment = Assessment.objects.get(id=a['assessment'])

        obtained = a['total_obtained']
        total = assessment.total_marks

        result.append({
            "title": assessment.title,
            "type": assessment.assessment_type,
            "obtained": obtained,
            "total": total,
            "course": {
                "id": str(assessment.course.id) if assessment.course else None,
                "name": assessment.course.name if assessment.course else "Unknown Course"
            },
            "semester": {
                "id": str(assessment.semester.id) if assessment.semester else None,
                "name": assessment.semester.name if assessment.semester else "Unknown Semester"
            }
        })

        total_obtained_all += obtained
        total_marks_all += total

    percentage = (total_obtained_all / total_marks_all) * 100 if total_marks_all else 0

    # GPA
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

    return Response({
        "student": student.name,
        "assessments": result,
        "total": total_obtained_all,
        "percentage": round(percentage, 2),
        "gpa": gpa,
        "status": "PASS" if percentage >= 50 else "FAIL"
    })    
class CoordinatorCQIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        course = request.GET.get("course")
        batch = request.GET.get("batch")
        semester_number = request.GET.get("semester")  # 👈 number aa raha

        queryset = CQI.objects.filter(status='approved')

        # ✅ FILTER: COURSE
        if course:
            queryset = queryset.filter(course_id=course)

        # ✅ FILTER: BATCH
        if batch:
            queryset = queryset.filter(batch_id=batch)

        # 🔥 FIXED SEMESTER FILTER
        if semester_number and batch:
            from core.models import Batch, Semester

            batch_obj = Batch.objects.get(id=batch)

            semester_obj = Semester.objects.get(
                number=semester_number,
                program=batch_obj.program
            )

            queryset = queryset.filter(semester=semester_obj)  # ✅ correct

        queryset = queryset.order_by('-created_at')

        data = []

        for obj in queryset:
            data.append({
                "id": obj.id,
                "clo": str(obj.clo.id),
                "reason": obj.reason,
                "action_plan": obj.action_plan,
                "instructor": obj.instructor.full_name if obj.instructor else None,
                "approved_by": obj.reviewed_by.full_name if obj.reviewed_by else None,
            })

        return Response(data)
import uuid

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from .models import CQI


class PreviousCQIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        course = request.GET.get("course")
        clo = request.GET.get("clo")

        # Required parameters
        if not course or not clo:
            return Response(
                {"error": "course and clo are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate UUID
        try:
            course_uuid = uuid.UUID(course)
            clo_uuid = uuid.UUID(clo)
        except ValueError:
            return Response(
                {"error": "Invalid UUID"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get latest approved CQI
        cqi = (
            CQI.objects.filter(
                course_id=course_uuid,
                clo_id=clo_uuid,
                status="approved",
                show_next_offering=True
            )
            .order_by("-created_at")
            .first()
        )

        if not cqi:
            return Response({
                "show_previous_cqi": False
            })

        return Response({
            "show_previous_cqi": True,
            "clo": str(cqi.clo.id),
            "reason": cqi.reason,
            "action_plan": cqi.action_plan,
            "approved_at": cqi.created_at
        }) 
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from assessments.models import Assessment


class AssessmentHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        import logging
        logger = logging.getLogger(__name__)
        
        from core.models import Course, Semester
        from retake.models import CourseRetake

        course_id = request.GET.get("course")
        batch_id = request.GET.get("batch")
        semester_number = request.GET.get("semester")
        retake_id = request.GET.get("retake_id")
        
        logger.info(f"[AssessmentHistoryView] Called with course_id: {course_id}, batch_id: {batch_id}, semester_number: {semester_number}, retake_id: {retake_id}")

        assessments_query = Assessment.objects.all()

        if retake_id:
            # If retake_id is provided, filter for that specific retake
            logger.info(f"[AssessmentHistoryView] Filtering by retake_id: {retake_id}")
            try:
                retake = CourseRetake.objects.get(id=retake_id)
                logger.info(f"[AssessmentHistoryView] Found retake: {retake.id}")
                assessments_query = Assessment.objects.filter(
                    course_retake=retake
                ).order_by("-created_at")
                logger.info(f"[AssessmentHistoryView] Found {assessments_query.count()} assessments for retake")
            except CourseRetake.DoesNotExist:
                logger.warning(f"[AssessmentHistoryView] Retake {retake_id} not found, returning none")
                assessments_query = Assessment.objects.none()
        else:
            # Normal case: filter by course, batch, semester, no retake
            # Get course to get program
            logger.info(f"[AssessmentHistoryView] Normal case, no retake")
            course = Course.objects.get(id=course_id)
            
            # Get semester by program and number
            semester = Semester.objects.get(program=course.program, number=semester_number)

            assessments_query = Assessment.objects.filter(
                course_id=course_id,
                batch_id=batch_id,
                semester=semester,
                course_retake__isnull=True
            ).order_by("-created_at")

        data = []

        for ass in assessments_query:
            data.append({
                "id": ass.id,
                "title": ass.title,
                "type": ass.assessment_type,
                "date": ass.assessment_date,
                "total_marks": ass.total_marks,
                "is_finalized": ass.is_finalized,
            })
        
        logger.info(f"[AssessmentHistoryView] Returning {len(data)} assessments")
        return Response(data)
from decimal import Decimal

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from assessments.models import (
    Assessment,
    Question,
    StudentQuestionMark
)

from students.models import Student
from obe.models import CourseSession


class AssessmentMarksView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, assessment_id):

        assessment = Assessment.objects.get(id=assessment_id)

        session = CourseSession.objects.filter(

            course=assessment.course,

            batch=assessment.batch,

            semester=assessment.semester,

            is_active=True

        ).first()

        if assessment.course_retake:
            students = [assessment.course_retake.student]
        else:
            students = Student.objects.filter(
                user__batch=assessment.batch
            )

        questions = Question.objects.filter(
            assessment=assessment
        ).select_related("clo")

        result = []

        for student in students:

            row = {

                "student_id": student.student_id,

                "name": student.name,

                "questions": []

            }

            total = Decimal("0")

            for q in questions:
                mark_query = StudentQuestionMark.objects.filter(
                    student=student,
                    question=q
                )
                if assessment.course_retake:
                    mark_query = mark_query.filter(course_retake=assessment.course_retake)
                mark = mark_query.first()

                obtained = mark.marks_obtained if mark else 0

                total += Decimal(obtained)

                row["questions"].append({
                    "mark_id": mark.id if mark else None,

                    "question_id": q.id,
                    "question": f"Q{len(row['questions']) + 1}",
                    "clo": f"CLO-{q.clo.order_number}",

                    "marks_obtained": float(obtained),

                    "total": float(q.marks)

                })

            row["total"] = float(total)

            result.append(row)

        return Response({

            "assessment": {

                "id": str(assessment.id),

                "title": assessment.title,

                "type": assessment.assessment_type,

                "total_marks": float(assessment.total_marks),

            },

            "allow_editing": session.allow_result_editing if session else False,

            "students": result

        })        
from django.db import transaction
from django.db.models import Sum

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from assessments.models import StudentQuestionMark, StudentAssessment
from obe.models import CourseSession, GA
from obe.services import (
    calculate_all_course_ga_scores,
    check_and_trigger_ga_cqi,
)


class UpdateStudentMarksView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def put(self, request):

        marks = request.data.get("marks", [])

        if not marks:
            return Response(
                {"error": "No marks received."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get first assessment/session only once
        try:
            first_mark = StudentQuestionMark.objects.select_related(
                "question__assessment"
            ).get(id=marks[0]["mark_id"])

            assessment = first_mark.question.assessment

            session = CourseSession.objects.get(
                course=assessment.course,
                batch=assessment.batch,
                semester=assessment.semester,
                is_active=True
            )

        except StudentQuestionMark.DoesNotExist:
            return Response(
                {"error": "Invalid mark id."},
                status=status.HTTP_404_NOT_FOUND
            )

        except CourseSession.DoesNotExist:
            return Response(
                {"error": "Course Session not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        # HOD Permission
        if not session.allow_result_editing:
            return Response(
                {"error": "Result editing is disabled."},
                status=status.HTTP_403_FORBIDDEN
            )

        updated = 0
        updated_assessments = set()

        for item in marks:

            mark_id = item.get("mark_id")
            obtained = item.get("marks_obtained")

            try:
                mark = StudentQuestionMark.objects.select_related(
                    "student",
                    "question",
                    "question__assessment"
                ).get(id=mark_id)

            except StudentQuestionMark.DoesNotExist:
                continue

            question = mark.question
            assessment = question.assessment

            updated_assessments.add(assessment.id)

            # Validation
            if float(obtained) > float(question.marks):
                return Response(
                    {
                        "error": f"Marks cannot exceed {question.marks}"
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Update Marks
            mark.marks_obtained = obtained
            mark.save()

            # Recalculate Student Assessment
            total_marks = StudentQuestionMark.objects.filter(
                student=mark.student,
                question__assessment=assessment
            ).aggregate(
                total=Sum("marks_obtained")
            )["total"] or 0

            student_assessment, created = StudentAssessment.objects.get_or_create(
                student=mark.student,
                assessment=assessment
            )

            student_assessment.marks_obtained = total_marks
            student_assessment.save()

            updated += 1

        # Recalculate OBE once
        calculate_all_course_ga_scores(session)

        if session.batch and session.batch.is_program_end_ready:
            gas = GA.objects.filter(
                program=session.course.program,
                is_active=True
            )

            for ga in gas:
                check_and_trigger_ga_cqi(
                    batch=session.batch,
                    ga=ga,
                )

        return Response(
            {
                "message": f"{updated} marks updated successfully.",
                "updated_assessments": list(updated_assessments)
            },
            status=status.HTTP_200_OK
        )
