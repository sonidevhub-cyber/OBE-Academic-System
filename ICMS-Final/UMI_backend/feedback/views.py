# feedback/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import Sum, Count

from .models import (
    FeedbackSession,
    FeedbackResponse,
    IndirectCLOAttainment,
    FeedbackCQI,
)

from .serializers import FeedbackResponseSerializer

from obe.models import CLO
from assessments.models import CLOAttainment
from core.models import Batch


# 🟢 1. ENABLE FEEDBACK
from core.models import Course, Batch, Semester
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import FeedbackSession

class EnableFeedbackView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        if user.role != "hod":
            return Response({"error": "Only HOD allowed"}, status=403)

        batch_id = request.data.get("batch")

        if not batch_id:
            return Response({"error": "Batch is required"}, status=400)

        try:
            batch = Batch.objects.get(id=batch_id)
        except Batch.DoesNotExist:
            return Response({"error": "Invalid batch"}, status=404)

        # 🔥 STEP 1: get semester number (int)
        semester_number = batch.current_semester

        if not semester_number:
            return Response({"error": "Semester not set in batch"}, status=400)

        # 🔥 STEP 2: map to Semester object
        semester = Semester.objects.filter(
            number=semester_number   # ⚠️ make sure field name correct hai
        ).first()

        if not semester:
            return Response({"error": "Semester mapping not found"}, status=400)

        print("Batch:", batch)
        print("Semester:", semester)

        # 🔥 STEP 3: get courses
        courses = Course.objects.filter(semester=semester)

        print("Courses found:", courses)

        if not courses.exists():
            return Response({"error": "No courses found for this semester"}, status=400)

        # 🔥 STEP 4: create sessions
        created = 0

        for course in courses:
            FeedbackSession.objects.update_or_create(
                batch=batch,
                semester=semester,
                course_id=course.id,
                defaults={"is_active": True}
            )
            created += 1

        return Response({
            "message": "Feedback enabled",
            "sessions_created": created
        })
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from students.models import Student

class CheckFeedbackStatus(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        batch_id = request.GET.get("batch")

        if not batch_id:
            return Response({
                "enabled": False,
                "submitted": False
            })

        try:
            batch = Batch.objects.get(id=batch_id)

            student = Student.objects.get(
                user=request.user
            )

        except (Batch.DoesNotExist, Student.DoesNotExist):
            return Response({
                "enabled": False,
                "submitted": False
            })

        session = FeedbackSession.objects.filter(
            batch=batch,
            is_active=True
        ).first()

        # Total required CLO questions
        total_questions = 0

        sessions = FeedbackSession.objects.filter(
            batch=batch,
            is_active=True
        )

        for s in sessions:
            total_questions += CLO.objects.filter(
                course=s.course
            ).count()

        # Student submitted responses
        submitted_count = FeedbackResponse.objects.filter(
            student=student,
            batch=batch
        ).count()

        submitted = (
            total_questions > 0 and
            submitted_count >= total_questions
        )

        return Response({
            "enabled": bool(session),
            "submitted": submitted,
            "required": total_questions,
            "completed": submitted_count
        })
# 🟣 3. GET QUESTIONS
from students.models import Student
from core.models import Batch


# 🟣 3. GET QUESTIONS
class GetFeedbackQuestions(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        try:
            student = Student.objects.get(user=request.user)

            batch = Batch.objects.get(
                id=request.user.batch_id
            )

        except Student.DoesNotExist:
            return Response(
                {"error": "Student profile not found"},
                status=404
            )

        except Batch.DoesNotExist:
            return Response(
                {"error": "Batch not assigned"},
                status=404
            )

        sessions = FeedbackSession.objects.filter(
            batch=batch,
            is_active=True
        )

        data = []

        for session in sessions:

            clos = CLO.objects.filter(
                course=session.course
            )

            questions = [
                {
                    "clo_id": str(clo.id),
                    "question": f"How well did this course help you to {clo.description}?"
                }
                for clo in clos
            ]

            data.append({
                "course_id": str(session.course.id),
                "course_name": session.course.name,
                "questions": questions
            })

        return Response(data)
# 🟠 4. SUBMIT FEEDBACK
from students.models import Student
from core.models import Batch


# 🟠 4. SUBMIT FEEDBACK
from students.models import Student
from core.models import Batch, Semester
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

class SubmitFeedbackView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):

        serializer = FeedbackResponseSerializer(
            data=request.data,
            many=True
        )

        serializer.is_valid(raise_exception=True)

        try:
            student = Student.objects.get(
                user=request.user
            )

            batch = Batch.objects.get(
                id=request.user.batch_id
            )

            semester = Semester.objects.filter(
                number=batch.current_semester
            ).first()

            if not semester:
                return Response(
                    {"error": "Semester not found"},
                    status=400
                )

        except Student.DoesNotExist:
            return Response(
                {"error": "Student profile not found"},
                status=404
            )

        except Batch.DoesNotExist:
            return Response(
                {"error": "Batch not assigned"},
                status=404
            )

        for item in serializer.validated_data:

            FeedbackResponse.objects.create(
                student=student,
                course_id=item["course"],
                clo_id=item["clo"],
                rating=item["rating"],
                batch=batch,
                semester=semester
            )

        FeedbackService.calculate(batch)

        return Response({
            "message": "Feedback submitted successfully"
        })
# 🔥 SERVICE CLASS
class FeedbackService:

    @staticmethod
    def calculate(batch):

        semester = Semester.objects.filter(
            number=batch.current_semester
        ).first()

        if not semester:
            return

        responses = FeedbackResponse.objects.filter(
            batch=batch
        )

        grouped = responses.values(
            "course",
            "clo"
        ).annotate(
            total=Sum("rating"),
            count=Count("id")
        )

        for g in grouped:

            percent = (
                g["total"] /
                (g["count"] * 5)
            ) * 100

            IndirectCLOAttainment.objects.update_or_create(
                course_id=g["course"],
                clo_id=g["clo"],
                batch=batch,
                semester=semester,
                defaults={
                    "attained_percentage": percent
                }
            )
# 🚨 5. COMPARE (RED FLAG)
# 🚨 5. COMPARE DIRECT vs INDIRECT
class CompareView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        course = request.GET.get("course")
        batch = request.GET.get("batch")
        semester = request.GET.get("semester")

        direct_records = CLOAttainment.objects.all()
        indirect_records = IndirectCLOAttainment.objects.all()

        if course:
            direct_records = direct_records.filter(course_id=course)
            indirect_records = indirect_records.filter(course_id=course)

        if batch:
            direct_records = direct_records.filter(batch_id=batch)
            indirect_records = indirect_records.filter(batch_id=batch)

        if semester:
            direct_records = direct_records.filter(semester_id=semester)
            indirect_records = indirect_records.filter(semester_id=semester)

        KPI = 60
        GAP_LIMIT = 10

        results = []

        for direct in direct_records:

            indirect = indirect_records.filter(
                clo=direct.clo,
                course=direct.course,
                batch=direct.batch,
                semester=direct.semester
            ).first()

            if not indirect:
                continue

            direct_percent = float(direct.attained_percentage)
            indirect_percent = float(indirect.attained_percentage)

            gap = round(abs(direct_percent - indirect_percent), 2)
            existing_cqi = FeedbackCQI.objects.filter(
    course=direct.course,
    clo=direct.clo,
    batch=direct.batch,
    semester=direct.semester
).first()
            if direct_percent < KPI:
                status = "CQI_REQUIRED"
                message = "Direct attainment is below KPI."

            elif gap > GAP_LIMIT:
                status = "RED_FLAG"
                message = "Large difference between Direct and Indirect attainment."

            else:
                status = "MATCHED"
                message = "Direct and Indirect attainment are aligned."

            results.append({
                "course": direct.course.name,
                "course_code": direct.course.code,
                "course_id": str(direct.course.id),
                "cqi_exists" : existing_cqi is not None,
                 "cqi_id": (
                     str(existing_cqi.id) if existing_cqi else None
                 ),
                "clo": getattr(direct.clo, "code", str(direct.clo)),
                "clo_id": str(direct.clo.id),
                "batch_id": str(direct.batch.id),
                "semester_id": str(direct.semester.id),
                "direct": direct_percent,
                "indirect": indirect_percent,
                "gap": gap,
                "status": status,
                "message": message,
                "trigger_cqi": status == "CQI_REQUIRED" or status == "RED_FLAG"

            })

        return Response({
            "results": results
        })
class CreateFeedbackCQI(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):

        FeedbackCQI.objects.create(

            course_id=request.data["course"],

            clo_id=request.data["clo"],

            batch_id=request.data["batch"],

            semester_id=request.data["semester"],

            source="COORDINATOR",

            root_cause=request.data["root_cause"],

            remedial_action=request.data["remedial_action"],

            created_by=request.user

        )

        return Response({
            "message": "CQI Created Successfully"
        })
class NextBatchCQI(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        batch = request.GET.get("batch")

        data = FeedbackCQI.objects.filter(
            implemented_batch=batch
        )

        return Response([

            {

                "course": x.course.name,

                "course_code": x.course.code,

                "clo": x.clo.title,

                "root_cause": x.root_cause,

                "remedial_action": x.remedial_action

            }

            for x in data

        ])
class ApplyCQIToNextBatch(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):

        cqi = FeedbackCQI.objects.get(
            id=request.data["cqi_id"]
        )

        cqi.status = "IMPLEMENTED"

        cqi.implemented_batch_id = request.data["next_batch"]

        cqi.save()

        return Response({
            "message": "CQI Applied"
        })                
class HODBatchesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        batches = Batch.objects.filter(
            program__in=user.programs.all()
        )

        return Response([
            {
                "id": b.id,
                "name": str(b)
            }
            for b in batches
        ]) 
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from core.models import Batch


class CoordinatorBatchesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        user = request.user

        try:
            batches = Batch.objects.filter(
                program__in=user.programs.all()
            ).distinct()

            return Response([
                {
                    "id": batch.id,
                    "name": str(batch)
                }
                for batch in batches
            ])

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=400
            )    
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import IndirectCLOAttainment


class IndirectCLOReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        batch = request.GET.get("batch")

        attainments = IndirectCLOAttainment.objects.select_related(
            "course",
            "clo",
            "batch",
            "semester"
        )

        # ✅ Batch Filter
        if batch:
            attainments = attainments.filter(
                batch_id=batch
            )

        data = []

        for item in attainments:

            data.append({
                "course": item.course.code if hasattr(item.course, "code") else item.course.name,
                "clo": item.clo.code if hasattr(item.clo, "code") else str(item.clo),
                "batch": str(item.batch),
                "semester": str(item.semester),
                "indirect_percentage": round(
                    item.attained_percentage,
                    2
                )
            })

        return Response(data)      
# views.py
class DisableFeedbackView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):

        user = request.user

        if user.role != "hod":
            return Response(
                {"error": "Only HOD allowed"},
                status=403
            )

        batch_id = request.data.get("batch")

        if not batch_id:
            return Response(
                {"error": "Batch is required"},
                status=400
            )

        try:
            batch = Batch.objects.get(id=batch_id)
        except Batch.DoesNotExist:
            return Response(
                {"error": "Invalid batch"},
                status=404
            )

        FeedbackSession.objects.filter(
            batch=batch,
            is_active=True
        ).update(is_active=False)

        return Response({
            "message": "Feedback disabled"
        })