from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Instructor
from .serializers import InstructorSerializer

from coordinators.models import TeacherAllocation
from coordinators.serializers import TeacherAllocationSerializer

from core.models import Batch
from core.responses import api_response

from obe.models import GACQIRecord, CourseSession

from feedback.models import FeedbackCQI


class InstructorViewSet(viewsets.ModelViewSet):
    queryset = Instructor.objects.all()
    serializer_class = InstructorSerializer
    permission_classes = [permissions.IsAuthenticated]

    # ============================================================
    # MY COURSES
    # ============================================================
    @action(detail=False, methods=["get"], url_path="my-courses")
    def my_courses(self, request):
        """
        Get all courses allocated to the currently logged-in instructor.

        IMPORTANT:
        - Only active allocations are returned.
        - Active batch courses are returned.
        - Previous GA CQI logic is preserved.
        - Coordinator Feedback CQI implemented for this batch is
          ALSO returned.
        """

        user = request.user

        print(
            f"Fetching courses for user: "
            f"{getattr(user, 'email', 'N/A')}, "
            f"ID: {getattr(user, 'id', 'N/A')}, "
            f"Role: {getattr(user, 'role', 'N/A')}"
        )

        # ========================================================
        # ACTIVE TEACHER ALLOCATIONS
        # ========================================================
        allocations = (
            TeacherAllocation.objects.filter(
                teacher=user,
                is_active=True,
                status="active",
                batch__status="active",
            )
            .select_related(
                "course",
                "course__program",
                "batch",
                "batch__program",
                "curriculum_version",
                "allocated_by",
            )
            .order_by("batch__name", "semester_no", "course__name")
        )

        print(f"Found {allocations.count()} active allocations")

        data = []

        # ========================================================
        # LOOP THROUGH ALLOCATIONS
        # ========================================================
        for alloc in allocations:

            course = alloc.course
            batch = alloc.batch

            # ----------------------------------------------------
            # CORE SEMESTER
            # ----------------------------------------------------
            from core.models import Semester as CoreSemester

            core_semester = (
                CoreSemester.objects.filter(
                    number=alloc.semester_no,
                    program=course.program,
                ).first()
            )

            # ----------------------------------------------------
            # LAST COMPLETED SEMESTER
            # ----------------------------------------------------
            last_completed_semester = None

            completed_semesters = (
                CourseSession.objects.filter(
                    batch=batch,
                    is_active=True,
                    assessment_status="ASSESSMENT_DONE",
                )
                .values_list(
                    "semester__number",
                    flat=True,
                )
                .distinct()
            )

            completed_semesters = list(completed_semesters)

            if completed_semesters:
                eligible_semesters = [
                    semester
                    for semester in completed_semesters
                    if semester < alloc.semester_no
                ]

                if eligible_semesters:
                    last_completed_semester = max(
                        eligible_semesters
                    )

            # ====================================================
            # EXISTING GA CQI
            # ====================================================
            # DO NOT CHANGE THIS LOGIC.
            # This is your existing GA CQI mechanism.
            # ====================================================

            previous_cqi = None

            if last_completed_semester:

                previous_cqi = (
                    GACQIRecord.objects.filter(
                        batch=batch,
                        cqi_level="SEMESTER",
                        semester=last_completed_semester,
                        status__in=[
                            "SAVED",
                            "EXPORTED",
                            "FULLY_APPROVED",
                            "PENDING",
                            "SENT_BACK",
                        ],
                        is_active=True,
                    )
                    .order_by("-created_at")
                    .first()
                )

            # ====================================================
            # NEW: FEEDBACK CQI
            # ====================================================
            #
            # Coordinator creates CQI for OLD batch:
            #
            # bscs2024
            #
            # and selects:
            #
            # implemented_batch = bscs2025
            #
            # Therefore instructor of bscs2025 should see it.
            #
            # IMPORTANT:
            # We DO NOT modify GA CQI.
            # ====================================================

            feedback_cqi_qs = (
                FeedbackCQI.objects.filter(
                    implemented_batch=batch,
                    status="IMPLEMENTED",
                )
                .select_related(
                    "course",
                    "clo",
                    "batch",
                    "semester",
                    "created_by",
                )
                .order_by("-created_at")
            )

            # ----------------------------------------------------
            # Only CQI related to this allocated course
            # ----------------------------------------------------
            course_feedback_cqi = feedback_cqi_qs.filter(
                course=course
            )

            feedback_cqi_data = []

            for cqi in course_feedback_cqi:

                feedback_cqi_data.append(
                    {
                        "id": cqi.id,
                        "course_id": (
                            cqi.course.id
                            if cqi.course
                            else None
                        ),
                        "course_name": (
                            cqi.course.name
                            if cqi.course
                            else ""
                        ),
                        "course_code": (
                            cqi.course.code
                            if cqi.course
                            else ""
                        ),
                        "clo_id": (
                            cqi.clo.id
                            if cqi.clo
                            else None
                        ),
                        "clo_code": (
                            getattr(cqi.clo, "code", "")
                            if cqi.clo
                            else ""
                        ),
                        "clo_title": (
                            getattr(cqi.clo, "title", "")
                            if cqi.clo
                            else ""
                        ),
                        "source": cqi.source,
                        "root_cause": cqi.root_cause,
                        "remedial_action": cqi.remedial_action,
                        "status": cqi.status,
                        "original_batch_id": (
                            cqi.batch.id
                            if cqi.batch
                            else None
                        ),
                        "original_batch_name": (
                            cqi.batch.name
                            if cqi.batch
                            else ""
                        ),
                        "implemented_batch_id": (
                            cqi.implemented_batch.id
                            if cqi.implemented_batch
                            else None
                        ),
                        "implemented_batch_name": (
                            cqi.implemented_batch.name
                            if cqi.implemented_batch
                            else ""
                        ),
                        "semester_id": (
                            cqi.semester.id
                            if cqi.semester
                            else None
                        ),
                        "created_by_id": (
                            cqi.created_by.id
                            if cqi.created_by
                            else None
                        ),
                        "created_at": cqi.created_at,
                    }
                )

            # ====================================================
            # COURSE SESSION
            # ====================================================

            course_session = (
                CourseSession.objects.filter(
                    course=course,
                    batch=batch,
                    semester=core_semester,
                    is_active=True,
                ).first()
            )

            # ----------------------------------------------------
            # Sync workflow safely
            # ----------------------------------------------------
            try:
                from assessments.workflows import (
                    sync_course_session_workflow_from_assessments,
                    derive_batch_semester_status,
                    get_permitted_actions,
                )

                course_session = (
                    sync_course_session_workflow_from_assessments(
                        course_session
                    )
                )

                semester_status = (
                    derive_batch_semester_status(
                        batch,
                        core_semester,
                    )
                    if core_semester
                    else "ONGOING"
                )

                permitted_actions = get_permitted_actions(
                    semester_status
                )

            except Exception as workflow_error:

                print(
                    "⚠️ Workflow error:",
                    str(workflow_error),
                )

                semester_status = "ONGOING"
                permitted_actions = []

            # ====================================================
            # FINAL RESPONSE OBJECT
            # ====================================================

            course_data = {
                # ------------------------------------------------
                # Allocation
                # ------------------------------------------------
                "id": alloc.id,
                "allocation_id": alloc.id,

                # ------------------------------------------------
                # Course
                # ------------------------------------------------
                "course_id": course.id,
                "course_name": course.name,
                "course_code": course.code,
                "course_type": course.course_type,
                "course_description": (
                    getattr(course, "description", "")
                ),

                "credits": getattr(
                    course,
                    "credit_hours",
                    0,
                ),

                "credit_hours": getattr(
                    course,
                    "credit_hours",
                    0,
                ),

                # ------------------------------------------------
                # Batch
                # ------------------------------------------------
                "batch_id": batch.id,
                "batch_name": batch.name,

                # ------------------------------------------------
                # Semester
                # ------------------------------------------------
                "semester_no": alloc.semester_no,

                "semester_id": (
                    core_semester.id
                    if core_semester
                    else None
                ),

                "semester_name": (
                    getattr(
                        core_semester,
                        "name",
                        None,
                    )
                    or f"Semester {alloc.semester_no}"
                ),

                # ------------------------------------------------
                # Previous semester
                # ------------------------------------------------
                "last_completed_semester": (
                    last_completed_semester
                ),

                # ------------------------------------------------
                # Course Session
                # ------------------------------------------------
                "course_session_id": (
                    course_session.id
                    if course_session
                    else None
                ),

                "internals_locked": bool(
                    course_session
                    and course_session.internals_locked
                ),

                "internal_complete_awaiting_final": bool(
                    course_session
                    and course_session.internal_complete_awaiting_final
                ),

                "final_submitted": bool(
                    course_session
                    and course_session.final_submitted
                ),

                # ------------------------------------------------
                # Semester workflow
                # ------------------------------------------------
                "semester_status": semester_status,

                "permitted_actions": permitted_actions,

                # ------------------------------------------------
                # Program
                # ------------------------------------------------
                "program_name": (
                    batch.program.name
                    if batch.program
                    else ""
                ),

                "program_code": (
                    batch.program.code
                    if batch.program
                    else ""
                ),

                # ------------------------------------------------
                # Coordinator
                # ------------------------------------------------
                "coordinator_name": (
                    getattr(
                        alloc.allocated_by,
                        "full_name",
                        None,
                    )
                    or getattr(
                        alloc.allocated_by,
                        "name",
                        None,
                    )
                    or getattr(
                        alloc.allocated_by,
                        "email",
                        None,
                    )
                    or "N/A"
                ),

                # ------------------------------------------------
                # Curriculum
                # ------------------------------------------------
                "curriculum_version": (
                    alloc.curriculum_version.version_no
                    if alloc.curriculum_version
                    else None
                ),

                "curriculum_version_id": (
                    alloc.curriculum_version.id
                    if alloc.curriculum_version
                    else None
                ),

                "status": alloc.status,

                # =================================================
                # EXISTING GA CQI
                # =================================================
                "has_previous_cqi": (
                    previous_cqi is not None
                ),

                "previous_cqi": (
                    {
                        "id": str(previous_cqi.id),
                        "semester": last_completed_semester,
                        "root_cause": previous_cqi.root_cause,
                        "remedial_plan": previous_cqi.remedial_plan,
                    }
                    if previous_cqi
                    else None
                ),

                # =================================================
                # NEW FEEDBACK CQI
                # =================================================
                #
                # Instructor's current batch ke course ka
                # coordinator-applied CQI.
                # =================================================

                "has_feedback_cqi": bool(
                    feedback_cqi_data
                ),

                "feedback_cqi": feedback_cqi_data,
            }

            data.append(course_data)

        # ========================================================
        # RESPONSE
        # ========================================================

        return Response(
            {
                "courses": data,
                "results": data,
                "count": len(data),
            }
        )

    # ============================================================
    # PROFILE
    # ============================================================
    @action(detail=False, methods=["get"])
    def profile(self, request):

        from core.serializers.user import UserListSerializer

        user = request.user

        data = UserListSerializer(
            user,
            context={"request": request},
        ).data

        try:

            instructor = Instructor.objects.get(
                user=user
            )

            serializer = InstructorSerializer(
                instructor,
                context={"request": request},
            )

            instructor_data = serializer.data

            for key, value in instructor_data.items():

                if key not in ["id", "user"]:
                    data[key] = value

        except Instructor.DoesNotExist:
            pass

        return api_response(
            data=data,
            message="Instructor profile retrieved successfully",
        )

    # ============================================================
    # COURSES
    # ============================================================
    @action(detail=False, methods=["get"])
    def courses(self, request):

        try:

            allocations = (
                TeacherAllocation.objects.filter(
                    teacher=request.user,
                    is_active=True,
                    status="active",
                    batch__status="active",
                )
                .select_related(
                    "course",
                    "course__semester",
                    "allocated_by",
                    "batch",
                    "batch__program",
                    "curriculum_version",
                )
                .order_by(
                    "batch__name",
                    "semester_no",
                    "course__name",
                )
            )

            data = []

            for allocation in allocations:

                course = allocation.course
                semester = getattr(
                    course,
                    "semester",
                    None,
                )

                # ----------------------------------------------
                # Feedback CQI for this course + batch
                # ----------------------------------------------

                feedback_cqi = (
                    FeedbackCQI.objects.filter(
                        course=course,
                        implemented_batch=allocation.batch,
                        status="IMPLEMENTED",
                    )
                    .select_related(
                        "clo",
                        "batch",
                        "implemented_batch",
                        "semester",
                    )
                    .order_by("-created_at")
                )

                feedback_cqi_data = [
                    {
                        "id": cqi.id,
                        "clo_id": (
                            cqi.clo.id
                            if cqi.clo
                            else None
                        ),
                        "clo_code": (
                            getattr(
                                cqi.clo,
                                "code",
                                "",
                            )
                            if cqi.clo
                            else ""
                        ),
                        "root_cause": cqi.root_cause,
                        "remedial_action": (
                            cqi.remedial_action
                        ),
                        "status": cqi.status,
                        "source": cqi.source,
                        "original_batch_id": (
                            cqi.batch.id
                            if cqi.batch
                            else None
                        ),
                        "original_batch_name": (
                            cqi.batch.name
                            if cqi.batch
                            else ""
                        ),
                        "implemented_batch_id": (
                            cqi.implemented_batch.id
                            if cqi.implemented_batch
                            else None
                        ),
                        "implemented_batch_name": (
                            cqi.implemented_batch.name
                            if cqi.implemented_batch
                            else ""
                        ),
                        "semester_id": (
                            cqi.semester.id
                            if cqi.semester
                            else None
                        ),
                        "created_at": cqi.created_at,
                    }
                    for cqi in feedback_cqi
                ]

                data.append(
                    {
                        "allocation_id": allocation.id,

                        "course_id": (
                            course.id
                            if course
                            else None
                        ),

                        "batch_id": (
                            allocation.batch.id
                            if allocation.batch
                            else None
                        ),

                        "batch_name": (
                            allocation.batch.name
                            if allocation.batch
                            else ""
                        ),

                        "course_name": (
                            getattr(
                                course,
                                "name",
                                "",
                            )
                        ),

                        "course_code": (
                            getattr(
                                course,
                                "code",
                                "",
                            )
                        ),

                        "course_description": (
                            getattr(
                                course,
                                "description",
                                "",
                            )
                        ),

                        "credits": (
                            getattr(
                                course,
                                "credit_hours",
                                0,
                            )
                        ),

                        "semester_id": (
                            semester.id
                            if semester
                            else None
                        ),

                        "semester_name": (
                            getattr(
                                semester,
                                "name",
                                "",
                            )
                        ),

                        "semester_code": (
                            getattr(
                                semester,
                                "code",
                                "",
                            )
                        ),

                        "semester_no": allocation.semester_no,

                        "program_name": (
                            allocation.batch.program.name
                            if (
                                allocation.batch
                                and allocation.batch.program
                            )
                            else ""
                        ),

                        "program_code": (
                            allocation.batch.program.code
                            if (
                                allocation.batch
                                and allocation.batch.program
                            )
                            else ""
                        ),

                        "coordinator_name": (
                            getattr(
                                allocation.allocated_by,
                                "full_name",
                                None,
                            )
                            or getattr(
                                allocation.allocated_by,
                                "name",
                                None,
                            )
                            or getattr(
                                allocation.allocated_by,
                                "email",
                                "",
                            )
                        ),

                        "approved_at": (
                            allocation.allocated_at
                        ),

                        "hod_comments": getattr(
                            allocation,
                            "hod_comments",
                            "",
                        ),

                        "status": allocation.status,

                        # NEW
                        "has_feedback_cqi": bool(
                            feedback_cqi_data
                        ),

                        "feedback_cqi": feedback_cqi_data,
                    }
                )

            return api_response(
                data=data,
                message="Courses retrieved successfully",
            )

        except Exception as e:

            print(
                "🔥 ERROR courses:",
                str(e),
            )

            return api_response(
                message="Error fetching courses",
                status_code=500,
            )

    # ============================================================
    # COURSES SUMMARY
    # ============================================================
    @action(detail=False, methods=["get"])
    def courses_summary(self, request):

        qs = TeacherAllocation.objects.filter(
            teacher=request.user,
            is_active=True,
        )

        return api_response(
            data={
                "total_allocated": qs.count(),

                "active_courses": qs.filter(
                    status="active"
                ).count(),

                "pending_approval": qs.filter(
                    status="pending"
                ).count(),

                "approved_courses": qs.filter(
                    status="approved"
                ).count(),

                "rejected_courses": qs.filter(
                    status="rejected"
                ).count(),
            }
        )

    # ============================================================
    # COURSE DETAILS
    # ============================================================
    @action(detail=False, methods=["get"])
    def course_details(self, request):

        course_id = request.GET.get("course_id")

        try:

            allocation = (
                TeacherAllocation.objects
                .select_related(
                    "course",
                    "course__semester",
                    "allocated_by",
                    "batch",
                    "batch__program",
                )
                .get(
                    id=course_id,
                    teacher=request.user,
                )
            )

            course = allocation.course

            semester = getattr(
                course,
                "semester",
                None,
            )

            # ====================================================
            # FEEDBACK CQI
            # ====================================================

            feedback_cqi = (
                FeedbackCQI.objects.filter(
                    course=course,
                    implemented_batch=allocation.batch,
                    status="IMPLEMENTED",
                )
                .select_related(
                    "clo",
                    "batch",
                    "implemented_batch",
                    "semester",
                )
                .order_by("-created_at")
            )

            feedback_cqi_data = [
                {
                    "id": cqi.id,

                    "course_id": (
                        cqi.course.id
                        if cqi.course
                        else None
                    ),

                    "clo_id": (
                        cqi.clo.id
                        if cqi.clo
                        else None
                    ),

                    "clo_code": (
                        getattr(
                            cqi.clo,
                            "code",
                            "",
                        )
                        if cqi.clo
                        else ""
                    ),

                    "root_cause": cqi.root_cause,

                    "remedial_action": (
                        cqi.remedial_action
                    ),

                    "status": cqi.status,

                    "source": cqi.source,

                    "original_batch_id": (
                        cqi.batch.id
                        if cqi.batch
                        else None
                    ),

                    "original_batch_name": (
                        cqi.batch.name
                        if cqi.batch
                        else ""
                    ),

                    "implemented_batch_id": (
                        cqi.implemented_batch.id
                        if cqi.implemented_batch
                        else None
                    ),

                    "implemented_batch_name": (
                        cqi.implemented_batch.name
                        if cqi.implemented_batch
                        else ""
                    ),

                    "semester_id": (
                        cqi.semester.id
                        if cqi.semester
                        else None
                    ),

                    "created_at": cqi.created_at,
                }
                for cqi in feedback_cqi
            ]

            return api_response(
                data={
                    "allocation_id": allocation.id,

                    "course": {
                        "course_id": course.id,
                        "name": getattr(
                            course,
                            "name",
                            "",
                        ),
                        "code": getattr(
                            course,
                            "code",
                            "",
                        ),
                        "description": getattr(
                            course,
                            "description",
                            "",
                        ),
                        "credits": getattr(
                            course,
                            "credit_hours",
                            0,
                        ),
                    },

                    "batch": {
                        "batch_id": (
                            allocation.batch.id
                            if allocation.batch
                            else None
                        ),
                        "batch_name": (
                            allocation.batch.name
                            if allocation.batch
                            else ""
                        ),
                    },

                    "semester": {
                        "semester_id": (
                            semester.id
                            if semester
                            else None
                        ),
                        "name": getattr(
                            semester,
                            "name",
                            "",
                        ),
                        "code": getattr(
                            semester,
                            "code",
                            "",
                        ),
                    },

                    "coordinator": {
                        "name": (
                            getattr(
                                allocation.allocated_by,
                                "full_name",
                                None,
                            )
                            or getattr(
                                allocation.allocated_by,
                                "name",
                                None,
                            )
                            or getattr(
                                allocation.allocated_by,
                                "username",
                                None,
                            )
                            or getattr(
                                allocation.allocated_by,
                                "email",
                                "",
                            )
                        ),

                        "email": getattr(
                            allocation.allocated_by,
                            "email",
                            "",
                        ),
                    },

                    "students": [],

                    "total_students": 0,

                    "approved_at": (
                        allocation.allocated_at
                    ),

                    "hod_comments": getattr(
                        allocation,
                        "hod_comments",
                        "",
                    ),

                    # NEW
                    "has_feedback_cqi": bool(
                        feedback_cqi_data
                    ),

                    "feedback_cqi": feedback_cqi_data,
                },

                message="Course details retrieved successfully",
            )

        except TeacherAllocation.DoesNotExist:

            return api_response(
                message="Course not found",
                status_code=404,
            )

        except Exception as e:

            print(
                "🔥 ERROR course_details:",
                str(e),
            )

            return api_response(
                message="Error fetching course details",
                status_code=500,
            )