from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from django.db.models import F

from .models import Instructor
from .serializers import InstructorSerializer

from coordinators.models import TeacherAllocation

from core.responses import api_response

from obe.models import GACQIRecord, CourseSession
from feedback.models import FeedbackCQI


class InstructorViewSet(viewsets.ModelViewSet):
    queryset = Instructor.objects.all()
    serializer_class = InstructorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        from django.contrib.auth import get_user_model
        from core.permissions import _get_user_department
        User = get_user_model()

        user = request.user
        # All active faculty roles
        qs = Instructor.objects.filter(
            is_active=True,
            user__isnull=False,
            user__is_active=True,
            user__role__in=['instructor', 'hod', 'coordinator'],
        ).select_related('user', 'department')

        # Scope HOD to their department
        is_hod = user.role == 'hod' or getattr(user, 'secondary_role', '') == 'hod'
        is_coord = user.role == 'coordinator' or getattr(user, 'secondary_role', '') == 'coordinator'
        if is_hod:
            dept = _get_user_department(user)
            if dept is not None:
                qs = qs.filter(department=dept)
            else:
                qs = qs.none()
        elif is_coord:
            # Coordinator sees instructors from their programs' department
            program = user.programs.select_related('department').first()
            if program and program.department:
                qs = qs.filter(department=program.department)

        data = [
            {
                'id': inst.id,
                'user': str(inst.user.id),
                'name': inst.name,
                'email': inst.email,
                'designation': inst.designation,
                'employment_type': inst.employment_type,
                'department': inst.department_id,
                'department_name': inst.department.name if inst.department else None,
                'role': inst.user.role,
            }
            for inst in qs
        ]
        return api_response(data=data, message='Instructors retrieved successfully')

    @action(detail=False, methods=['get'], url_path='my-courses')
    def my_courses(self, request):
        """Get courses allocated to the currently logged-in instructor."""
        user = request.user
        
        # Log for debugging - Using 'email' instead of 'username' since CustomUser uses email
        print(f"Fetching courses for user: {user.email}, ID: {user.id}, Role: {getattr(user, 'role', 'N/A')}")
        
        allocations = TeacherAllocation.objects.filter(
            teacher=user,
            is_active=True,
            status='active',
            batch__status='active'
        ).exclude(
            allocated_by__role='SAC'
        ).select_related('course', 'batch', 'curriculum_version')
        
        print(f"Found {allocations.count()} active allocations")
        
        data = []
        for alloc in allocations:
            # Get core semester by number and program
            from core.models import Semester as CoreSemester
            core_semester = CoreSemester.objects.filter(
                number=alloc.semester_no,
                program=alloc.course.program
            ).first()
            
            # For same batch, get last completed semester (any semester < current allocation's semester)
            last_completed_semester = None
            # Find max semester number that has courses with assessment_status='ASSESSMENT_DONE'
            from obe.models import CourseSession
            from assessments.workflows import (
                derive_batch_semester_status,
                get_permitted_actions,
                sync_course_session_workflow_from_assessments,
            )
            completed_semesters = CourseSession.objects.filter(
                batch=alloc.batch,
                is_active=True,
                assessment_status='ASSESSMENT_DONE'
            ).values_list('semester__number', flat=True).distinct()
            
            if completed_semesters:
                # Filter to semesters < current allocation's semester
                eligible_semesters = [s for s in completed_semesters if s < alloc.semester_no]
                if eligible_semesters:
                    last_completed_semester = max(eligible_semesters)
            
            previous_cqi = None
            if last_completed_semester:
                previous_cqi = GACQIRecord.objects.filter(
                    batch=alloc.batch,
                    cqi_level='SEMESTER',
                    semester=last_completed_semester,
                    status__in=['SAVED', 'EXPORTED', 'FULLY_APPROVED', 'PENDING', 'SENT_BACK'],
                    is_active=True
                ).order_by('-created_at').first()
            course_session = CourseSession.objects.filter(
                course=alloc.course,
                batch=alloc.batch,
                semester=core_semester,
                is_active=True,
            ).first()
            course_session = sync_course_session_workflow_from_assessments(course_session)
            semester_status = derive_batch_semester_status(alloc.batch, core_semester) if core_semester else 'ONGOING'
            data.append({
                'id': alloc.id,
                'allocation_id': alloc.id,
                'course_id': alloc.course.id,
                'course_name': alloc.course.name,
                'course_code': alloc.course.code,
                'course_type': alloc.course.course_type,
                'course_description': alloc.course.description if hasattr(alloc.course, 'description') else '',
                'credits': alloc.course.credit_hours,
                'credit_hours': alloc.course.credit_hours,
                'batch_id': alloc.batch.id,
                'batch_name': alloc.batch.name,
                'last_completed_semester': last_completed_semester,
                'semester_no': alloc.semester_no,
                'semester_id': core_semester.id if core_semester else None,
                'course_session_id': course_session.id if course_session else None,
                'internals_locked': bool(course_session and course_session.internals_locked),
                'internal_complete_awaiting_final': bool(course_session and course_session.internal_complete_awaiting_final),
                'final_submitted': bool(course_session and course_session.final_submitted),
                'semester_status': semester_status,
                'permitted_actions': get_permitted_actions(semester_status),
                'semester_name': f"Semester {alloc.semester_no}",
                'program_name': alloc.batch.program.name,
                'program_code': alloc.batch.program.code,
                'coordinator_name': alloc.allocated_by.full_name if alloc.allocated_by else 'N/A',
                'curriculum_version': alloc.curriculum_version.version_no,
                'curriculum_version_id': alloc.curriculum_version.id,
                'status': 'active',
                'has_previous_cqi': previous_cqi is not None,
                'previous_cqi': {
                 'id': str(previous_cqi.id),
                 'semester': last_completed_semester,
                 'root_cause': previous_cqi.root_cause,
                  'remedial_plan': previous_cqi.remedial_plan,
                  } if previous_cqi else None,
            })
            
        return Response({'courses': data, 'results': data}) # Wrapped for different component expectations
    # ============================================================
    # HELPER
    # ============================================================
    def _get_current_semester_allocations(self, user):
        """
        Return ONLY allocations belonging to the batch's
        CURRENT semester.

        Example:
            bscs2024 -> current_semester = 2
            bscs2025 -> current_semester = 1

        Old semester allocations remain in DB/history but are
        not shown in My Courses.
        """

        return (
            TeacherAllocation.objects.filter(
                teacher=user,
                is_active=True,
                status="active",
                batch__status="active",
                semester_no=F("batch__current_semester"),
            )
            .select_related(
                "course",
                "course__program",
                "course__semester",
                "batch",
                "batch__program",
                "curriculum_version",
                "allocated_by",
            )
            .order_by(
                "batch__name",
                "semester_no",
                "course__name",
            )
        )

    # ============================================================
    # MY COURSES
    # ============================================================
    @action(detail=False, methods=["get"], url_path="my-courses")
    def my_courses(self, request):
        """
        Get ONLY current-semester courses allocated to the
        currently logged-in instructor.

        Historical allocations are NOT deleted.
        They simply do not appear in My Courses.

        GA CQI logic is preserved.
        Feedback CQI logic is preserved.
        """

        user = request.user

        print(
            f"Fetching current-semester courses for user: "
            f"{getattr(user, 'email', 'N/A')}, "
            f"ID: {getattr(user, 'id', 'N/A')}, "
            f"Role: {getattr(user, 'role', 'N/A')}"
        )

        # ========================================================
        # CURRENT SEMESTER ALLOCATIONS ONLY
        # ========================================================

        allocations = self._get_current_semester_allocations(user)

        print(
            f"Found {allocations.count()} current-semester "
            f"active allocations"
        )

        data = []

        # ========================================================
        # LOOP THROUGH CURRENT ALLOCATIONS
        # ========================================================

        for alloc in allocations:

            course = alloc.course
            batch = alloc.batch

            # ----------------------------------------------------
            # CURRENT SEMESTER
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
            #
            # IMPORTANT:
            # This is NOT changed.
            #
            # It is required for previous semester GA CQI.
            #
            # Example:
            # bscs2024 current semester = 2
            # previous completed semester = 1
            #
            # GA CQI from semester 1 can therefore be shown
            # as warning for semester 2.
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
            # FEEDBACK CQI
            # ====================================================

            feedback_cqi = (
                FeedbackCQI.objects.filter(
                    course=course,
                    implemented_batch=batch,
                    status="IMPLEMENTED",
                )
                .select_related(
                    "course",
                    "clo",
                    "batch",
                    "implemented_batch",
                    "semester",
                    "created_by",
                )
                .order_by("-created_at")
            )

            feedback_cqi_data = []

            for cqi in feedback_cqi:

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
                            getattr(
                                cqi.clo,
                                "code",
                                "",
                            )
                            if cqi.clo
                            else ""
                        ),

                        "clo_title": (
                            getattr(
                                cqi.clo,
                                "title",
                                "",
                            )
                            if cqi.clo
                            else ""
                        ),

                        "source": cqi.source,

                        "root_cause": cqi.root_cause,

                        "remedial_action": (
                            cqi.remedial_action
                        ),

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

            # ====================================================
            # WORKFLOW
            # ====================================================

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
            # FINAL COURSE OBJECT
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
                    getattr(
                        course,
                        "description",
                        "",
                    )
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

                # Current batch semester
                "batch_current_semester": getattr(
                    batch,
                    "current_semester",
                    alloc.semester_no,
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
                # Semester Workflow
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
                # GA CQI
                # =================================================

                "has_previous_cqi": (
                    previous_cqi is not None
                ),

                "previous_cqi": (
                    {
                        "id": str(previous_cqi.id),
                        "semester": last_completed_semester,
                        "root_cause": previous_cqi.root_cause,
                        "remedial_plan": (
                            previous_cqi.remedial_plan
                        ),
                    }
                    if previous_cqi
                    else None
                ),

                # =================================================
                # FEEDBACK CQI
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
            instructor = Instructor.objects.select_related('department').get(user=user)
            serializer = InstructorSerializer(instructor, context={'request': request})
            instructor_data = serializer.data

            # Merge data - skips 'id' and 'user' to avoid conflicts

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

            # Ensure department_name is always present and correct
            if instructor.department:
                data['department_name'] = instructor.department.name
            else:
                data['department_name'] = None

            # Remove raw department ID so frontend always uses department_name
            if 'department' in data:
                del data['department']

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
            allocations = TeacherAllocation.objects.filter(
    teacher=request.user,
    is_active=True,
    status='active',
    batch__status='active'
).exclude(
                allocated_by__role='SAC'
            ).select_related(
                'course',
                'course__semester',
                'allocated_by',
                'batch',
                'curriculum_version')

            allocations = (
                self._get_current_semester_allocations(
                    request.user
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
                # Feedback CQI
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

                        "course_name": getattr(
                            course,
                            "name",
                            "",
                        ),

                        "course_code": getattr(
                            course,
                            "code",
                            "",
                        ),

                        "course_description": getattr(
                            course,
                            "description",
                            "",
                        ),

                        "credits": getattr(
                            course,
                            "credit_hours",
                            0,
                        ),

                        "semester_id": (
                            semester.id
                            if semester
                            else None
                        ),

                        "semester_name": getattr(
                            semester,
                            "name",
                            "",
                        ),

                        "semester_code": getattr(
                            semester,
                            "code",
                            "",
                        ),

                        "semester_no": allocation.semester_no,

                        "batch_current_semester": getattr(
                            allocation.batch,
                            "current_semester",
                            allocation.semester_no,
                        ),

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

                        "has_feedback_cqi": bool(
                            feedback_cqi_data
                        ),

                        "feedback_cqi": feedback_cqi_data,
                    }
                )

            return api_response(
                data=data,
                message="Current semester courses retrieved successfully",
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

        qs = self._get_current_semester_allocations(
            request.user
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

        allocation_id = request.GET.get("course_id")

        try:

            allocation = (
                TeacherAllocation.objects
                .select_related(
                    "course",
                    "course__semester",
                    "allocated_by",
                    "batch",
                    "batch__program",
                    "curriculum_version",
                )
                .get(
                    id=allocation_id,
                    teacher=request.user,
                    is_active=True,
                    status="active",
                    batch__status="active",
                    semester_no=F(
                        "batch__current_semester"
                    ),
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

                        "current_semester": getattr(
                            allocation.batch,
                            "current_semester",
                            allocation.semester_no,
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

                    "has_feedback_cqi": bool(
                        feedback_cqi_data
                    ),

                    "feedback_cqi": feedback_cqi_data,
                },

                message="Course details retrieved successfully",
            )

        except TeacherAllocation.DoesNotExist:

            return api_response(
                message="Current semester course not found",
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