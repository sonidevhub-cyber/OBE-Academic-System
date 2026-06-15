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


from .models import (
    Assessment,
    Question,
    StudentAssessment,
    StudentQuestionMark
)
from core.models import Batch, Semester
from students.models import Student
from obe.models import CLO
from .serializer import AssessmentCreateSerializer
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
    
        # ✅ CLO VALIDATION
        valid_clos = set(
            CLO.objects.filter(course_id=data['course'])
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
            batch=batch,
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
        students = Student.objects.filter(batch=assessment.batch)

        for s in students:
            total = StudentQuestionMark.objects.filter(
                student=s,
                question__assessment=assessment
            ).aggregate(total=Sum('marks_obtained'))['total'] or 0

            StudentAssessment.objects.filter(
                student=s,
                assessment=assessment
            ).update(marks_obtained=total)

        # 🔥 FINALIZE
        assessment.is_finalized = True
        assessment.save()

        # =====================================================
        # 🔥 MOST IMPORTANT (ONLY FINAL)
        # =====================================================
        if assessment.assessment_type == "final":

            CLOService.generate_student_report(
                course_id=assessment.course_id,
                batch_id=assessment.batch_id,
                semester_id=assessment.semester_id
            )

        return Response({
            "message": "Marks saved and finalized",
            "is_final": assessment.assessment_type == "final"
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
            # 🔥 Batch object
            batch_obj = Batch.objects.get(id=batch)

            # 🔥 Semester object (number → actual object)
            semester_obj = Semester.objects.get(
                number=semester_number,
                program=batch_obj.program   # agar ye relation hai
            )

        except Batch.DoesNotExist:
            return Response({"error": "Invalid batch"}, status=400)

        except Semester.DoesNotExist:
            return Response({"error": "Semester not found"}, status=400)

        # 🔥 FINAL FILTER
        data = CQI.objects.filter(
            course_id=course,
            batch_id=batch,
            semester=semester_obj   # ✅ FIXED
        )

        return Response(CQISerializer(data, many=True).data)
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

        # 🔥 3. Convert semester number → object
        from core.models import Batch, Semester

        batch_obj = Batch.objects.get(id=batch_uuid)

        semester_obj = Semester.objects.get(
            number=semester_number,
            program=batch_obj.program
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