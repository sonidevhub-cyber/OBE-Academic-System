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
                name=f"Semester {batch.current_semester}"
            )
        except Semester.DoesNotExist:
            return Response({"error": "Semester not found"}, status=400)

        # ✅ CHECK IF FINAL IS ALREADY FINALIZED
        if Assessment.objects.filter(
            course_id=data['course'],
            batch=batch,
            semester=semester,
            assessment_type='final',
            is_finalized=True
        ).exists():
            return Response({"error": "Final exam already submitted, no more assessments allowed"}, status=400)

        # ✅ DUPLICATE CHECK
        if data['type'] in ['midterm', 'final']:

             if Assessment.objects.filter(
        course_id=data['course'],
        batch=batch,
        semester=semester,
        assessment_type=data['type']
    ).exists():
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

        # ✅ CREATE ASSESSMENT
        assessment = Assessment.objects.create(
            course_id=data['course'],
            batch=batch,
            semester=semester,
            instructor=request.user,
            title=data['title'],
            assessment_type=data['type'],
            total_marks=data['total_marks'],
            assessment_date=data['date']
        )

        # ✅ CREATE QUESTIONS
        questions_objs = Question.objects.bulk_create([
            Question(
                assessment=assessment,
                clo_id=q['clo'],
                description=q['description'],
                bloom_level=q['level'],
                marks=q['marks']
            )
            for q in questions
        ])

        # ✅ STUDENTS
        students = Student.objects.filter(
            user__batch=batch,
            # status='enrolled'
        )

        if not students.exists():
            return Response({
                "error": "No enrolled students found"
            }, status=400)

        # ✅ STUDENT TOTAL RECORD
        StudentAssessment.objects.bulk_create([
            StudentAssessment(
                student=s,
                assessment=assessment,
                marks_obtained=0
            )
            for s in students
        ])

        # 🔥 CORE OBE (MOST IMPORTANT)
        StudentQuestionMark.objects.bulk_create([
            StudentQuestionMark(
                student=s,
                question=q,
                marks_obtained=0
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
from obe.models import CourseSession
from assessments.models import CLOAttainment

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

        # ✅ Step 4: Marks save karo
        for entry in data:
            StudentQuestionMark.objects.update_or_create(
                student_id=entry['student_id'],
                question_id=entry['question_id'],
                defaults={'marks_obtained': entry['marks']}
            )

        # ✅ Step 5: Total marks update karo
        students = Student.objects.filter(user__batch=assessment.batch)

        for s in students:
            total = StudentQuestionMark.objects.filter(
                student=s,
                question__assessment=assessment
            ).aggregate(total=Sum('marks_obtained'))['total'] or 0

            StudentAssessment.objects.filter(
                student=s,
                assessment=assessment
            ).update(marks_obtained=total)

        # ✅ Step 6: Assessment finalize karo
        assessment.is_finalized = True
        assessment.save()

        # ✅ Step 7: allow_result_editing reset karo agar tha
        if course_session and course_session.allow_result_editing:
            course_session.allow_result_editing = False
            course_session.save()

        # ✅ Step 8: Check karo sab assessments finalize hue ya nahi
        all_assessments = Assessment.objects.filter(
            course_id=assessment.course_id,
            batch=assessment.batch,
            semester=assessment.semester
        )
        all_finalized = all(a.is_finalized for a in all_assessments)

        is_course_session_finalized = all_finalized
        has_weak_clo = False  # default

        if is_course_session_finalized:
            print(f"[EnterMarksView] All assessments finalized for course {assessment.course_id}, "
                  f"batch {assessment.batch_id}, semester {assessment.semester_id}")

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

            # ✅ Step 11: CourseSession update karo
            course_session, created = CourseSession.objects.update_or_create(
                course_id=assessment.course_id,
                batch_id=assessment.batch_id,
                semester_id=assessment.semester_id,
                defaults={
                    'instructor': assessment.instructor,
                    'is_active': True,
                    'assessment_done': True,
                    'assessment_status': "ASSESSMENT_DONE"
                }
            )
            print(f"[EnterMarksView] CourseSession {'created' if created else 'updated'}: "
                  f"{course_session.id} - status set to ASSESSMENT_DONE")

            # ✅ Step 12: GA scores calculate karo
            calculate_all_course_ga_scores(course_session)

            # ✅ Step 13: Existing sessions mark as done
            mark_existing_sessions_as_done(assessment.batch, assessment.semester)

            # ✅ Step 14: Semester-level CQI check
            all_sessions_in_semester = CourseSession.objects.filter(
                batch=assessment.batch,
                semester=assessment.semester,
                is_active=True
            )
            done_sessions_in_semester = all_sessions_in_semester.filter(
                assessment_status='ASSESSMENT_DONE'
            )

            if (
                all_sessions_in_semester.exists() and
                all_sessions_in_semester.count() == done_sessions_in_semester.count()
            ):
                gas = GA.objects.filter(
                    program=assessment.batch.program,
                    is_active=True
                )
                for ga in gas:
                    check_and_trigger_ga_cqi(
                        assessment.batch, ga, 'SEMESTER', assessment.semester.number
                    )

            # ✅ Step 15: Cumulative-level CQI check
            if assessment.batch.is_program_end_ready:
                gas = GA.objects.filter(
                    program=assessment.batch.program,
                    is_active=True
                )
                for ga in gas:
                    check_and_trigger_ga_cqi(assessment.batch, ga, 'CUMULATIVE')

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
                if cqi.status == "approved":
                    return Response({"error": "Approved cqi cannot be edited"}, status=400)
                
                cqi.reason = data['reason']
                cqi.action_plan = data['action_plan']
                cqi.status = 'pending'
                cqi.show_next_offering = False
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
        cqi.coordinator_comment = request.data.get("coordinator_comment", "")

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

        # 🔥 Reset status for re-review
        cqi.status = "pending"
        cqi.reviewed_by = None
        cqi.coordinator_comment = None

        # ✅ Important
        cqi.show_next_offering = False

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
            "total": total
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

        course = request.GET.get("course")
        batch = request.GET.get("batch")
        semester = request.GET.get("semester")

        assessments = Assessment.objects.filter(
            course_id=course,
            batch_id=batch,
            semester_id=semester,
            is_finalized=True
        ).order_by("-created_at")

        data = []

        for ass in assessments:

            data.append({

                "id": ass.id,

                "title": ass.title,

                "type": ass.assessment_type,

                "date": ass.assessment_date,

                "total_marks": ass.total_marks,

            })

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

                mark = StudentQuestionMark.objects.filter(

                    student=student,

                    question=q

                ).first()

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

        gas = GA.objects.filter(
            program=session.course.program,
            is_active=True
        )

        for ga in gas:
            check_and_trigger_ga_cqi(
                batch=session.batch,
                ga=ga,
                cqi_level="SEMESTER",
                semester=session.semester.number
            )

        return Response(
            {
                "message": f"{updated} marks updated successfully.",
                "updated_assessments": list(updated_assessments)
            },
            status=status.HTTP_200_OK
        )