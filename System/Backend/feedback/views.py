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


def get_batch_version_courses(batch, semester_number=None):
    """
    Returns the curriculum-version courses for a batch.
    Falls back to semester courses only when the batch is not linked to a version.
    """
    semester = Semester.objects.filter(number=semester_number).first() if semester_number else None

    curriculum_version = getattr(batch, "curriculum_version", None)
    if curriculum_version:
        courses = curriculum_version.version_courses.filter(is_active=True)
        if semester_number:
            courses = courses.filter(semester_no=semester_number)
        return courses.select_related("course"), semester

    if semester:
        return Course.objects.filter(semester=semester), semester

    return Course.objects.none(), semester

class EnableFeedbackView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        # ==============================
        # 1. USER / ROLE CHECK
        # ==============================
        print("USER:", user)
        print("ROLE:", user.role)

        if user.role not in ["hod", "instructor"]:
            return Response(
                {"error": "Only HOD or Instructor allowed"},
                status=403
            )

        # ==============================
        # 2. GET BATCH
        # ==============================
        batch_id = request.data.get("batch")

        print("Received batch_id:", batch_id)

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

        print("Batch:", batch)
        print("Batch ID:", batch.id)
        print("Current Semester:", batch.current_semester)
        print("Curriculum Version:", batch.curriculum_version)

        # ==============================
        # 3. GET CURRENT SEMESTER NUMBER
        # ==============================
        semester_number = batch.current_semester

        if not semester_number:
            return Response(
                {"error": "Semester not set in batch"},
                status=400
            )

        print("Semester Number:", semester_number)

        # ==============================
        # 4. GET SEMESTER OBJECT
        # ==============================
        semester = Semester.objects.filter(
            number=semester_number
        ).first()

        if not semester:
            return Response(
                {"error": "Semester mapping not found"},
                status=400
            )

        print("Semester:", semester)
        print("Semester ID:", semester.id)

        # ==============================
        # 5. GET CURRICULUM VERSION COURSES
        # ==============================
        courses, _ = get_batch_version_courses(
            batch,
            semester_number
        )

        print("Courses QuerySet:", courses)
        print("Courses Count:", courses.count())

        if not courses.exists():
            if batch.curriculum_version:
                return Response(
                    {
                        "error": (
                            "No courses found for this batch "
                            "curriculum version in the current semester"
                        )
                    },
                    status=400
                )

            return Response(
                {"error": "No courses found for this semester"},
                status=400
            )

        # ==============================
        # 6. GET ALLOWED COURSE IDS
        # ==============================
        if batch.curriculum_version:
            allowed_course_ids = list(
                courses.values_list(
                    "course_id",
                    flat=True
                )
            )
        else:
            allowed_course_ids = list(
                courses.values_list(
                    "id",
                    flat=True
                )
            )

        print("Allowed Course IDs:", allowed_course_ids)

        # ==============================
        # 7. DEACTIVATE OLD / STALE SESSIONS
        # ==============================
        stale_sessions = FeedbackSession.objects.filter(
            batch=batch,
            semester=semester
        ).exclude(
            course_id__in=allowed_course_ids
        )

        print(
            "Stale sessions found:",
            stale_sessions.count()
        )

        stale_sessions.update(
            is_active=False
        )

        # ==============================
        # 8. CREATE / ACTIVATE SESSIONS
        # ==============================
        created = 0

        for course_entry in courses:

            if batch.curriculum_version:
                course = course_entry.course
            else:
                course = course_entry

            print(
                "Processing Course:",
                course.id,
                course.name
            )

            session, created_flag = (
                FeedbackSession.objects.update_or_create(
                    batch=batch,
                    semester=semester,
                    course_id=course.id,
                    defaults={
                        "is_active": True
                    }
                )
            )

            print(
                "SESSION:",
                session.id,
                "| COURSE:",
                course.name,
                "| CREATED:",
                created_flag,
                "| ACTIVE:",
                session.is_active
            )

            created += 1

        # ==============================
        # 9. VERIFY ACTIVE SESSIONS
        # ==============================
        active_sessions = FeedbackSession.objects.filter(
            batch=batch,
            semester=semester,
            is_active=True
        )

        print(
            "ACTIVE SESSIONS COUNT:",
            active_sessions.count()
        )

        print(
            "ACTIVE SESSIONS:",
            list(
                active_sessions.values(
                    "id",
                    "batch_id",
                    "semester_id",
                    "course_id",
                    "is_active"
                )
            )
        )

        # ==============================
        # 10. FINAL RESPONSE
        # ==============================
        return Response(
            {
                "message": "Feedback enabled",
                "sessions_created": created,
                "active_sessions": active_sessions.count()
            },
            status=200
        )
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
                "submitted": False,
                "required": 0,
                "completed": 0
            })

        # ==========================================
        # GET BATCH
        # ==========================================
        try:
            batch = Batch.objects.get(id=batch_id)
        except Batch.DoesNotExist:
            return Response({
                "enabled": False,
                "submitted": False,
                "required": 0,
                "completed": 0
            })

        print("STATUS BATCH:", batch)
        print("STATUS BATCH ID:", batch.id)
        print("STATUS CURRENT SEMESTER:", batch.current_semester)

        # ==========================================
        # GET SEMESTER
        # ==========================================
        semester = Semester.objects.filter(
            number=batch.current_semester
        ).first()

        if not semester:
            print("STATUS: Semester not found")

            return Response({
                "enabled": False,
                "submitted": False,
                "required": 0,
                "completed": 0
            })

        print("STATUS SEMESTER:", semester)
        print("STATUS SEMESTER ID:", semester.id)

        # ==========================================
        # GET ACTIVE SESSIONS
        # ==========================================
        sessions = FeedbackSession.objects.filter(
            batch=batch,
            semester=semester,
            is_active=True
        )

        print(
            "STATUS ACTIVE SESSION COUNT:",
            sessions.count()
        )

        print(
            "STATUS ACTIVE SESSIONS:",
            list(
                sessions.values(
                    "id",
                    "batch_id",
                    "semester_id",
                    "course_id",
                    "is_active"
                )
            )
        )

        # ==========================================
        # ENABLED
        # ==========================================
        enabled = sessions.exists()

        print("STATUS ENABLED:", enabled)

        # ==========================================
        # GET STUDENT IF AVAILABLE
        # ==========================================
        student = None

        try:
            student = Student.objects.get(user=request.user)
        except Student.DoesNotExist:
            print("STATUS: Current user is not a student")

        # ==========================================
        # REQUIRED / COMPLETED
        # ==========================================
        required = 0
        completed = 0

        # Only calculate student submission data
        # if current user is actually a student.
        if student and sessions.exists():

            for session in sessions:

                try:
                    course = session.course
                except Exception:
                    continue

                # Count CLOs/questions for this course
                course_questions = CLO.objects.filter(
                    course=course
                ).count()

                required += course_questions

            print(
                "STATUS REQUIRED QUESTIONS:",
                required
            )

            # Count student's submitted feedback
            completed = FeedbackResponse.objects.filter(
                student=student,
                batch=batch,
                semester=semester,
                course_id__in=sessions.values_list(
                    "course_id",
                    flat=True
                )
            ).count()

            print(
                "STATUS COMPLETED RESPONSES:",
                completed
            )

        # ==========================================
        # SUBMITTED
        # ==========================================
        submitted = (
            required > 0
            and completed >= required
        )

        print("STATUS SUBMITTED:", submitted)

        # ==========================================
        # FINAL RESPONSE
        # ==========================================
        response_data = {
            "enabled": enabled,
            "submitted": submitted,
            "required": required,
            "completed": completed
        }

        print("FINAL STATUS RESPONSE:", response_data)

        return Response(response_data)
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
            semester__number=batch.current_semester,
            is_active=True
        )

        allowed_courses, _ = get_batch_version_courses(batch, batch.current_semester)
        if allowed_courses.exists():
            sessions = sessions.filter(
                course_id__in=allowed_courses.values_list("course_id" if batch.curriculum_version else "id", flat=True)
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

        allowed_courses, _ = get_batch_version_courses(batch, batch.current_semester)
        allowed_course_ids = set()
        if allowed_courses.exists():
            allowed_course_ids = {
                str(course_id)
                for course_id in allowed_courses.values_list(
                    "course_id" if batch.curriculum_version else "id",
                    flat=True
                )
            }

        for item in serializer.validated_data:
            if allowed_course_ids and str(item["course"]) not in allowed_course_ids:
                continue

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
        from decimal import Decimal
        from obe.models import CLOGAMapping, CourseFeedbackGAScore
        from students.models import Student

        semester = Semester.objects.filter(
            number=batch.current_semester
        ).first()

        if not semester:
            return

        # Step 1: Calculate IndirectCLOAttainment
        responses = FeedbackResponse.objects.filter(
            batch=batch,
            semester=semester
        )

        allowed_courses, _ = get_batch_version_courses(batch, batch.current_semester)
        if allowed_courses.exists():
            responses = responses.filter(
                course_id__in=allowed_courses.values_list(
                    "course_id" if batch.curriculum_version else "id",
                    flat=True
                )
            )

        grouped = responses.values(
            "course",
            "clo"
        ).annotate(
            total=Sum("rating"),
            count=Count("id")
        )

        for g in grouped:
            # Normalize 1-5 scale to 0-100: ((avg -1)/4)*100 = ((total/count -1)/4)*100 = (total - count)/(4*count)*100
            percent = ((Decimal(str(g["total"])) - Decimal(str(g["count"]))) / (Decimal(str(g["count"])) * Decimal("4"))) * Decimal("100")
            IndirectCLOAttainment.objects.update_or_create(
                course_id=g["course"],
                clo_id=g["clo"],
                batch=batch,
                semester=semester,
                defaults={
                    "attained_percentage": percent
                }
            )

        # Step 2: Calculate CourseFeedbackGAScore (per course, per GA, per batch)
        # Get all IndirectCLOAttainment for this batch
        indirect_clo_attainments = IndirectCLOAttainment.objects.filter(
            batch=batch
        )

        # Group by course
        courses = indirect_clo_attainments.values_list('course', flat=True).distinct()

        for course_id in courses:
            course_attainments = indirect_clo_attainments.filter(course_id=course_id)
            
            # Get all GAs mapped to any CLO in this course
            clo_ids = course_attainments.values_list('clo', flat=True)
            clo_ga_mappings = CLOGAMapping.objects.filter(
                clo_id__in=clo_ids,
                is_active=True
            ).select_related('ga', 'clo')

            # Group mappings by GA
            ga_mappings = {}
            for mapping in clo_ga_mappings:
                ga_id = str(mapping.ga.id)
                if ga_id not in ga_mappings:
                    ga_mappings[ga_id] = {
                        'ga': mapping.ga,
                        'mappings': []
                    }
                ga_mappings[ga_id]['mappings'].append(mapping)

            # Calculate score for each GA
            for ga_id, data in ga_mappings.items():
                ga = data['ga']
                mappings = data['mappings']

                total_weighted_score = Decimal('0')
                total_weight = Decimal('0')

                for mapping in mappings:
                    # Find the IndirectCLOAttainment for this CLO
                    attainment = course_attainments.filter(clo_id=mapping.clo.id).first()
                    if attainment:
                        weight = mapping.weight
                        total_weighted_score += Decimal(str(attainment.attained_percentage)) * weight
                        total_weight += weight

                if total_weight > 0:
                    final_score = round(total_weighted_score / total_weight, 2)
                    
                    # Calculate coverage: how many students submitted feedback for this course
                    # Get all unique students who submitted feedback for this course
                    respondent_count = FeedbackResponse.objects.filter(
                        course_id=course_id,
                        batch=batch
                    ).values_list('student', flat=True).distinct().count()
                    
                    # Get total eligible students (students in this batch)
                    total_eligible = Student.objects.filter(batch=batch).count()
                    
                    coverage_percent = round((Decimal(str(respondent_count)) / Decimal(str(total_eligible))) * 100, 2) if total_eligible > 0 else Decimal('0')

                    # Create/update CourseFeedbackGAScore
                    CourseFeedbackGAScore.objects.update_or_create(
                        course_id=course_id,
                        ga=ga,
                        batch=batch,
                        defaults={
                            'score': final_score,
                            'coverage_percent': coverage_percent,
                            'respondent_count': respondent_count,
                            'total_eligible': total_eligible,
                            'is_active': True
                        }
                    )
# 🚨 5. COMPARE DIRECT vs INDIRECT
class CompareView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        course = request.GET.get("course")
        batch = request.GET.get("batch")
        semester = request.GET.get("semester")

        direct_records = CLOAttainment.objects.all()
        indirect_records = IndirectCLOAttainment.objects.all()

        batch_obj = None
        allowed_course_ids = None

        # ==========================================
        # BATCH
        # ==========================================
        if batch:
            batch_obj = (
                Batch.objects
                .select_related("curriculum_version")
                .filter(id=batch)
                .first()
            )

            if batch_obj and batch_obj.curriculum_version:
                allowed_course_ids = list(
                    batch_obj.curriculum_version.version_courses
                    .filter(is_active=True)
                    .values_list("course_id", flat=True)
                )

        # ==========================================
        # CURRICULUM COURSE FILTER
        # ==========================================
        if allowed_course_ids:
            direct_records = direct_records.filter(
                course_id__in=allowed_course_ids
            )

            indirect_records = indirect_records.filter(
                course_id__in=allowed_course_ids
            )

        # ==========================================
        # COURSE FILTER
        # ==========================================
        if course:
            direct_records = direct_records.filter(
                course_id=course
            )

            indirect_records = indirect_records.filter(
                course_id=course
            )

        # ==========================================
        # BATCH FILTER
        # ==========================================
        if batch:
            direct_records = direct_records.filter(
                batch_id=batch
            )

            indirect_records = indirect_records.filter(
                batch_id=batch
            )

        # ==========================================
        # SEMESTER FILTER
        # ==========================================
        if semester:
            direct_records = direct_records.filter(
                semester_id=semester
            )

            indirect_records = indirect_records.filter(
                semester_id=semester
            )

        KPI = 60
        GAP_LIMIT = 10

        results = []

        # ==========================================
        # COMPARE DIRECT + INDIRECT
        # ==========================================
        for direct in direct_records:

            indirect = indirect_records.filter(
                clo=direct.clo,
                course=direct.course,
                batch=direct.batch,
                semester=direct.semester
            ).first()

            if not indirect:
                continue

            direct_percent = float(
                direct.attained_percentage
            )

            indirect_percent = float(
                indirect.attained_percentage
            )

            gap = round(
                abs(direct_percent - indirect_percent),
                2
            )

            # ==========================================
            # CURRENT BATCH CQI
            # ==========================================
            existing_cqi = FeedbackCQI.objects.filter(
                course=direct.course,
                clo=direct.clo,
                batch=direct.batch,
                semester=direct.semester
            ).first()

            # ==========================================
            # PREVIOUS BATCH CQI APPLIED TO THIS BATCH
            # ==========================================
            implemented_cqi = None

            if batch_obj:

                implemented_cqi = (
                    FeedbackCQI.objects
                    .filter(
                        implemented_batch=batch_obj,
                        course=direct.course,
                        clo=direct.clo
                    )
                    .order_by("-created_at")
                    .first()
                )

            # ==========================================
            # STATUS
            # ==========================================
            if direct_percent < KPI:

                status = "CQI_REQUIRED"
                message = "Direct attainment is below KPI."

            elif gap > GAP_LIMIT:

                status = "RED_FLAG"
                message = (
                    "Large difference between Direct "
                    "and Indirect attainment."
                )

            else:

                status = "MATCHED"
                message = (
                    "Direct and Indirect attainment "
                    "are aligned."
                )

            # ==========================================
            # RESULT
            # ==========================================
            results.append({

                # --------------------------------------
                # COURSE
                # --------------------------------------
                "course": direct.course.name,
                "course_code": direct.course.code,
                "course_id": str(direct.course.id),

                # --------------------------------------
                # CLO
                # --------------------------------------
                "clo": getattr(
                    direct.clo,
                    "code",
                    str(direct.clo)
                ),

                "clo_id": str(direct.clo.id),

                # --------------------------------------
                # BATCH
                # --------------------------------------
                "batch_id": str(direct.batch.id),

                "batch": str(direct.batch),

                # --------------------------------------
                # SEMESTER
                # --------------------------------------
                "semester_id": str(
                    direct.semester.id
                ),

                "semester": str(
                    direct.semester
                ),

                # --------------------------------------
                # ASSESSMENT
                # --------------------------------------
                "direct": direct_percent,
                "indirect": indirect_percent,
                "gap": gap,

                # --------------------------------------
                # STATUS
                # --------------------------------------
                "status": status,
                "message": message,

                "trigger_cqi": (
                    status == "CQI_REQUIRED"
                    or status == "RED_FLAG"
                ),

                # --------------------------------------
                # CURRENT CQI
                # --------------------------------------
                "cqi_exists": (
                    existing_cqi is not None
                ),

                "cqi_id": (
                    str(existing_cqi.id)
                    if existing_cqi
                    else None
                ),

                # --------------------------------------
                # NEXT BATCH / INHERITED CQI
                # --------------------------------------
                "implemented_cqi_exists": (
                    implemented_cqi is not None
                ),

                "implemented_cqi_id": (
                    str(implemented_cqi.id)
                    if implemented_cqi
                    else None
                ),

                "implemented_cqi_status": (
                    implemented_cqi.status
                    if implemented_cqi
                    else None
                ),

                "implemented_cqi_root_cause": (
                    implemented_cqi.root_cause
                    if implemented_cqi
                    else None
                ),

                "implemented_cqi_remedial_action": (
                    implemented_cqi.remedial_action
                    if implemented_cqi
                    else None
                ),

                "implemented_from_batch": (
                    str(implemented_cqi.batch)
                    if implemented_cqi
                    else None
                ),

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

        batch_id = request.GET.get("batch")

        if not batch_id:
            return Response(
                {"error": "Batch is required"},
                status=400
            )

        cqi_records = (
            FeedbackCQI.objects
            .filter(
                implemented_batch_id=batch_id,
                status="IMPLEMENTED"
            )
            .select_related(
                "course",
                "clo",
                "batch",
                "semester"
            )
            .order_by("-created_at")
        )

        data = []

        for cqi in cqi_records:

            data.append({

                "id": str(cqi.id),

                "course_id": str(
                    cqi.course.id
                ),

                "course": cqi.course.name,

                "course_code": cqi.course.code,

                "clo_id": str(
                    cqi.clo.id
                ),

                "clo": getattr(
                    cqi.clo,
                    "code",
                    str(cqi.clo)
                ),

                "root_cause": cqi.root_cause,

                "remedial_action":
                    cqi.remedial_action,

                "status": cqi.status,

                "source_batch": str(
                    cqi.batch
                ),

                "implemented_batch": str(
                    cqi.implemented_batch
                ),

                "semester_id": str(
                    cqi.semester.id
                ),

            })

        return Response({
            "results": data
        })
class ApplyCQIToNextBatch(APIView):

    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):

        cqi_id = request.data.get("cqi_id")
        next_batch_id = request.data.get("next_batch")

        if not cqi_id:
            return Response(
                {"error": "CQI ID is required"},
                status=400
            )

        if not next_batch_id:
            return Response(
                {"error": "Next batch is required"},
                status=400
            )

        try:
            cqi = FeedbackCQI.objects.get(
                id=cqi_id
            )
        except FeedbackCQI.DoesNotExist:
            return Response(
                {"error": "CQI not found"},
                status=404
            )

        try:
            next_batch = Batch.objects.get(
                id=next_batch_id
            )
        except Batch.DoesNotExist:
            return Response(
                {"error": "Next batch not found"},
                status=404
            )

        # ==========================================
        # PREVENT APPLYING TO SAME BATCH
        # ==========================================
        if cqi.batch_id == next_batch.id:
            return Response(
                {
                    "error":
                    "CQI cannot be applied to the same batch."
                },
                status=400
            )

        # ==========================================
        # APPLY CQI
        # ==========================================
        cqi.status = "IMPLEMENTED"
        cqi.implemented_batch = next_batch
        cqi.save(
            update_fields=[
                "status",
                "implemented_batch"
            ]
        )

        return Response({

            "message": "CQI Applied Successfully",

            "cqi_id": str(cqi.id),

            "source_batch": str(cqi.batch),

            "implemented_batch": str(
                next_batch
            ),

            "course_id": str(
                cqi.course.id
            ),

            "course": cqi.course.name,

            "clo_id": str(
                cqi.clo.id
            ),

            "status": cqi.status

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

        allowed_course_ids = None
        if batch:
            batch_obj = Batch.objects.select_related("curriculum_version").filter(id=batch).first()
            if batch_obj and batch_obj.curriculum_version:
                allowed_course_ids = list(
                    batch_obj.curriculum_version.version_courses.filter(
                        is_active=True
                    ).values_list("course_id", flat=True)
                )

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

        if allowed_course_ids:
            attainments = attainments.filter(course_id__in=allowed_course_ids)

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
