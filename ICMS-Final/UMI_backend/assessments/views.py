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
from assessments.services.clo_service import CLOService   # 🔥 IMPORT ADD
from obe.views.ga_views import mark_existing_sessions_as_done   # 🔥 NEW
from obe.services import calculate_all_course_ga_scores, check_and_trigger_ga_cqi   # 🔥 NEW
from obe.models import CourseSession   # 🔥 NEW

class EnterMarksView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, assessment_id):

        data = request.data

        try:
            assessment = Assessment.objects.get(
                id=assessment_id,
                instructor=request.user
            )
        except Assessment.DoesNotExist:
            return Response({"error": "Assessment not found"}, status=404)

        # ❌ Already finalized check
        if assessment.is_finalized:
            return Response({
                "error": "Marks already finalized",
                "is_final": assessment.assessment_type == "final"
            }, status=400)

        # ✅ SAVE MARKS
        for entry in data:
            StudentQuestionMark.objects.update_or_create(
                student_id=entry['student_id'],
                question_id=entry['question_id'],
                defaults={'marks_obtained': entry['marks']}
            )

        # ✅ UPDATE TOTAL MARKS
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

        # 🔥 FINALIZE ONLY IF IT'S FINAL, OR ALL ASSESSMENTS ARE DONE
        assessment.is_finalized = True
        assessment.save()

        # Check if all assessments for this course session are now finalized
        all_assessments = Assessment.objects.filter(
            course_id=assessment.course_id,
            batch=assessment.batch,
            semester=assessment.semester
        )
        all_finalized = all(a.is_finalized for a in all_assessments)
        
        is_course_session_finalized = all_finalized
        
        if is_course_session_finalized:
            print(f"[EnterMarksView] All assessments finalized for course {assessment.course_id}, batch {assessment.batch_id}, semester {assessment.semester_id}")
            # Generate CLO report and CLOAttainment
            CLOService.generate_student_report(
                course_id=assessment.course_id,
                batch_id=assessment.batch_id,
                semester_id=assessment.semester_id
            )

            # Update or create CourseSession status
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
            print(f"[EnterMarksView] CourseSession {'created' if created else 'updated'}: {course_session.id} - status set to ASSESSMENT_DONE")
            
            # Calculate Course GA Scores
            calculate_all_course_ga_scores(course_session)
            
            # Check and mark existing sessions in the same semester as done
            mark_existing_sessions_as_done(assessment.batch, assessment.semester)
            
            # Check if all courses in the semester are done → trigger semester-level CQI
            all_sessions_in_semester = CourseSession.objects.filter(
                batch=assessment.batch,
                semester=assessment.semester,
                is_active=True
            )
            done_sessions_in_semester = all_sessions_in_semester.filter(assessment_status='ASSESSMENT_DONE')
            if all_sessions_in_semester.count() == done_sessions_in_semester.count() and all_sessions_in_semester.exists():
                # Calculate semester GA attainment and check for semester-level CQI for all GAs
                gas = GA.objects.filter(program=assessment.batch.program, is_active=True)
                for ga in gas:
                    check_and_trigger_ga_cqi(assessment.batch, ga, 'SEMESTER', assessment.semester.number)
            
            # Check if program end is ready → trigger cumulative-level CQI
            if assessment.batch.is_program_end_ready:
                gas = GA.objects.filter(program=assessment.batch.program, is_active=True)
                for ga in gas:
                    check_and_trigger_ga_cqi(assessment.batch, ga, 'CUMULATIVE')

        return Response({
            "message": "Marks saved and finalized",
            "is_final": is_course_session_finalized
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
            from academic_structure.models import Batch, Semester
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
                cqi.reason = data['reason']
                cqi.action_plan = data['action_plan']
                cqi.status = 'pending'
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
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import CQI
from .serializer import CQISerializer


class HODCQIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        course = request.GET.get("course")
        batch = request.GET.get("batch")
        semester = request.GET.get("semester")

        queryset = CQI.objects.select_related('clo', 'instructor', 'reviewed_by') \
            .filter(status='pending') \
            .order_by('-created_at')

        # 🔍 Filters
        if course:
            queryset = queryset.filter(course_id=course)
        if batch:
            queryset = queryset.filter(batch_id=batch)
        if semester:
            queryset = queryset.filter(semester_id=semester)

        # 🔥 SERIALIZER USE
        serializer = CQISerializer(queryset, many=True)

        return Response(serializer.data)
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

        cqi.status = status
        cqi.reviewed_by = request.user

        # 🔥 ADD THIS
        cqi.hod_comment = request.data.get("hod_comment", "")

        cqi.save()

        return Response({"message": f"CQI {status} successfully"})

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
                "hod_comment": c.hod_comment
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

        cqi.status = "pending"
        cqi.reviewed_by = None
        cqi.hod_comment = None

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