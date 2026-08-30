from decimal import Decimal, ROUND_HALF_UP
from collections import defaultdict

from django.db.models import Q

from assessments.models import (
    Assessment,
    Question,
    StudentQuestionMark,
    CLOAttainment,
)
from students.models import Student
from obe.models import CLO, CourseSession
from academic_structure.models import (
    Course as AcademicCourse,
    Semester as AcademicSemester,
)
from obe.services import get_students_for_batch

class CLOService:

    # ============================================================
    # OFFICIAL COURSE ASSESSMENT WEIGHTS
    # ============================================================
    #
    # NORMAL / LECTURE COURSE
    #
    # 3 Quizzes          = 5%
    # 3 Assignments      = 5%
    # Presentation       = 5%
    # Class Performance  = 5%
    # Midterm            = 30%
    # Final              = 50%
    #
    # TOTAL = 100%
    #
    # LAB COURSE
    #
    # Project            = 50%
    # Midterm            = 20%
    # Final              = 30%
    #
    # TOTAL = 100%
    # ============================================================

    ASSESSMENT_WEIGHTS = {
        # Normal / Lecture course
        "quiz": Decimal("5"),
        "assignment": Decimal("5"),
        "presentation": Decimal("5"),
        "sessional": Decimal("5"),
        "midterm": Decimal("30"),
        "final": Decimal("50"),

        # Lab course
        "project": Decimal("50"),
    }

    ASSESSMENT_LABELS = {
        "quiz": "Quiz",
        "assignment": "Assignment",
        "presentation": "Presentation",
        "sessional": "Class Performance",
        "project": "Project",
        "midterm": "Midterm",
        "final": "Final",
    }

    # ============================================================
    # IMPORTANT:
    #
    # Project is included here so LAB assessments are displayed
    # in the OBE report.
    # ============================================================

    ASSESSMENT_ORDER = [
        "quiz",
        "assignment",
        "presentation",
        "sessional",
        "project",
        "midterm",
        "final",
    ]

    # ============================================================
    # DECIMAL HELPERS
    # ============================================================

    @staticmethod
    def _decimal(value):
        if value is None:
            return Decimal("0")

        if isinstance(value, Decimal):
            return value

        return Decimal(str(value))

    @staticmethod
    def _round(value, places=2):
        value = CLOService._decimal(value)

        quantizer = Decimal(
            "1." + ("0" * places)
        )

        return value.quantize(
            quantizer,
            rounding=ROUND_HALF_UP
        )

    # ============================================================
    # GET CATEGORY WEIGHT
    # ============================================================

    @staticmethod
    def _get_assessment_weight(assessment):
        """
        Get the weight of an assessment category.

        NORMAL / LECTURE COURSE:
            Quiz = 5%
            Assignment = 5%
            Presentation = 5%
            Class Performance = 5%
            Midterm = 30%
            Final = 50%

        LAB COURSE:
            Project = 50%
            Midterm = 20%
            Final = 30%
        """

        assessment_type = assessment.assessment_type

        course = getattr(
            assessment,
            "course",
            None
        )

        is_lab = (
            course is not None
            and str(
                getattr(
                    course,
                    "course_type",
                    ""
                )
            ).upper() == "LAB"
        )

        # ========================================================
        # LAB COURSE
        # ========================================================

        if is_lab:

            lab_weights = {
                "project": Decimal("50"),
                "midterm": Decimal("20"),
                "final": Decimal("30"),
            }

            return lab_weights.get(
                assessment_type,
                Decimal("0")
            )

        # ========================================================
        # NORMAL / LECTURE COURSE
        # ========================================================

        return CLOService.ASSESSMENT_WEIGHTS.get(
            assessment_type,
            Decimal("0")
        )

    # ============================================================
    # GET CLO CODE
    # ============================================================

    @staticmethod
    def _clo_code(clo):
        if not clo:
            return None

        return f"CLO-{clo.order_number}"

    # ============================================================
    # BUILD TYPE GROUPS
    # ============================================================

    @staticmethod
    def _build_type_groups(
        source_assessments,
        source_questions
    ):
        formatted = []

        questions_by_assessment = defaultdict(list)

        for question in source_questions:
            questions_by_assessment[
                question.assessment_id
            ].append(question)

        # ========================================================
        # PROCESS ASSESSMENT TYPES
        # ========================================================

        for type_name in CLOService.ASSESSMENT_ORDER:

            type_assessments = [
                assessment
                for assessment in source_assessments
                if assessment.assessment_type == type_name
            ]

            if not type_assessments:
                continue

            formatted_assessments = []

            # ====================================================
            # EACH ASSESSMENT
            # ====================================================

            for assessment in type_assessments:

                ass_questions = questions_by_assessment[
                    assessment.id
                ]

                ass_clos = defaultdict(Decimal)

                # ================================================
                # QUESTIONS / CLO MARKS
                # ================================================

                for question in ass_questions:

                    clo_code = CLOService._clo_code(
                        question.clo
                    )

                    if not clo_code:
                        continue

                    ass_clos[clo_code] += (
                        CLOService._decimal(
                            question.marks
                        )
                    )

                # ================================================
                # CLO LIST
                # ================================================

                clo_list = []

                for clo_code, total in sorted(
                    ass_clos.items()
                ):
                    clo_list.append({
                        "clo": clo_code,
                        "total": float(
                            CLOService._round(total)
                        )
                    })

                # ================================================
                # TOTAL MARKS
                # ================================================

                total_marks = sum(
                    (
                        CLOService._decimal(
                            question.marks
                        )
                        for question in ass_questions
                    ),
                    Decimal("0")
                )

                # ================================================
                # ASSESSMENT DATA
                # ================================================

                formatted_assessments.append({
                    "id": str(assessment.id),
                    "title": assessment.title,
                    "assessment_type": (
                        assessment.assessment_type
                    ),
                    "clos": clo_list,
                    "total_marks": float(
                        CLOService._round(
                            total_marks
                        )
                    ),
                })

            # ====================================================
            # ALL CLOs IN THIS TYPE
            # ====================================================

            type_clos = sorted({
                clo_item["clo"]
                for assessment_row
                in formatted_assessments
                for clo_item
                in assessment_row["clos"]
            })

            # ====================================================
            # CATEGORY WEIGHT
            # ====================================================

            weightage = (
                CLOService._get_assessment_weight(
                    type_assessments[0]
                )
            )

            # ====================================================
            # FINAL TYPE GROUP
            # ====================================================

            formatted.append({
                "type": type_name,

                "label": CLOService.ASSESSMENT_LABELS.get(
                    type_name,
                    type_name.title()
                ),

                "weightage": float(
                    weightage
                ),

                "assessment_count": len(
                    type_assessments
                ),

                "assessments": (
                    formatted_assessments
                ),

                "clos": type_clos,
            })

        return formatted
    # ============================================================
    # BUILD CATEGORY CLO DATA FOR ONE STUDENT
    # ============================================================

    @staticmethod
    def _build_student_type_clo_data(
        assessments,
        questions_by_assessment,
        marks_map
    ):
        """
        Creates:

        {
            quiz: {
                CLO-1: {
                    obtained: ...,
                    total: ...
                },
                CLO-2: {
                    ...
                }
            },

            assignment: {
                ...
            }
        }

        IMPORTANT:

        All quizzes of the same category are combined first.

        So:

            Quiz 1 CLO-1
            Quiz 2 CLO-2
            Quiz 3 CLO-1

        becomes:

            Quiz category
                CLO-1 = Q1 + Q3
                CLO-2 = Q2
        """

        type_clo_data = defaultdict(
            lambda: defaultdict(
                lambda: {
                    "obtained": Decimal("0"),
                    "total": Decimal("0"),
                }
            )
        )

        for assessment in assessments:

            ass_type = assessment.assessment_type

            for question in questions_by_assessment[
                assessment.id
            ]:

                clo_code = CLOService._clo_code(
                    question.clo
                )

                if not clo_code:
                    continue

                obtained = CLOService._decimal(
                    marks_map.get(
                        (
                            getattr(
                                marks_map,
                                "_student_pk",
                                None
                            ),
                            question.id
                        ),
                        Decimal("0")
                    )
                )

                # The above student-key mechanism is not used
                # in the actual report loop. This method expects
                # a marks map already keyed by question_id when
                # passed from there.
                if question.id in marks_map:
                    obtained = CLOService._decimal(
                        marks_map.get(
                            question.id,
                            Decimal("0")
                        )
                    )

                total = CLOService._decimal(
                    question.marks
                )

                type_clo_data[
                    ass_type
                ][clo_code]["obtained"] += obtained

                type_clo_data[
                    ass_type
                ][clo_code]["total"] += total

        return type_clo_data

    # ============================================================
    # MAIN REPORT
    # ============================================================

    @staticmethod
    def generate_student_report(
        course_id,
        batch_id,
        semester_id,
        course_retake=None,
        assessment_types=None,
        report_status="FINAL",
        lock_attainment=False,
    ):

        # ========================================================
        # COURSE SESSION
        # ========================================================

        session = CourseSession.objects.filter(
            course_id=course_id,
            batch_id=batch_id,
            semester_id=semester_id,
            is_active=True
        ).first()

        students = (
            list(
                get_students_for_batch(
                    session.batch
                )
            )
            if session
            else list(
                Student.objects.filter(
                    Q(user__batch_id=batch_id)
                    |
                    Q(batch_id=batch_id)
                ).distinct()
            )
        )

        # ========================================================
        # ORIGINAL ASSESSMENTS
        # ========================================================

        assessments_query = Assessment.objects.filter(
            course_id=course_id,
            batch_id=batch_id,
            semester_id=semester_id,
            is_finalized=True,
            course_retake__isnull=True
        )

        if assessment_types is not None:
            assessments_query = assessments_query.filter(
                assessment_type__in=assessment_types
            )

        assessments = list(
            assessments_query.order_by(
                "assessment_type",
                "id"
            )
        )

        if not assessments:
            return {
                "error": "No finalized assessments found"
            }

        # ========================================================
        # COURSE / SEMESTER
        # ========================================================

        course = None
        semester = None

        try:
            course = AcademicCourse.objects.get(
                id=course_id
            )
        except AcademicCourse.DoesNotExist:
            pass

        try:
            semester = AcademicSemester.objects.get(
                id=semester_id
            )
        except AcademicSemester.DoesNotExist:
            pass

        # ========================================================
        # CLOs
        # ========================================================

        clos = list(
            CLO.objects.filter(
                course_id=course_id
            )
        )

        all_clos_queryset = CLO.objects.filter(
            course_id=course_id,
            is_active=True
        )

        clos_by_order = defaultdict(list)

        for clo in all_clos_queryset:
            clos_by_order[
                clo.order_number
            ].append(clo)

        # ========================================================
        # QUESTIONS
        # ========================================================

        questions = list(
            Question.objects.filter(
                assessment__in=assessments
            ).select_related(
                "assessment",
                "clo"
            )
        )

        questions_by_assessment = defaultdict(list)

        for question in questions:
            questions_by_assessment[
                question.assessment_id
            ].append(question)

        # ========================================================
        # ORIGINAL MARKS
        # ========================================================

        original_sqms = list(
            StudentQuestionMark.objects.filter(
                student__in=students,
                question__in=questions,
                course_retake__isnull=True
            ).select_related(
                "student",
                "question",
                "question__clo"
            )
        )

        original_marks_map = {}

        for sqm in original_sqms:
            original_marks_map[
                (
                    sqm.student_id,
                    sqm.question_id
                )
            ] = sqm.marks_obtained

        # ========================================================
        # RETAKES
        # ========================================================

        from retake.models import CourseRetake

        retake_by_student_id = {}

        active_retakes = (
            CourseRetake.objects.filter(
                failed_course_id=course_id,
                is_active=True
            )
            .filter(
                Q(failed_batch_id=batch_id)
                |
                Q(current_batch_id=batch_id)
            )
            .select_related("student")
        )

        students_by_id = {
            student.student_id: student
            for student in students
        }

        for retake in active_retakes.order_by(
            "student_id",
            "attempt_number"
        ):
            retake_by_student_id[
                retake.student_id
            ] = retake

            if retake.student_id not in students_by_id:
                students.append(
                    retake.student
                )

                students_by_id[
                    retake.student_id
                ] = retake.student

        if course_retake is not None:
            retake_by_student_id[
                course_retake.student_id
            ] = course_retake

        # ========================================================
        # REPORT
        # ========================================================

        report = []
        retake_report = []

        original_type_names = {
            assessment.assessment_type
            for assessment in assessments
        }

        regular_count = 0

        # ========================================================
        # STUDENT LOOP
        # ========================================================

        for student in students:

            row = {
                "count": 0,
                "student_id": str(
                    student.student_id
                ),
                "name": student.name,
                "registration_number": getattr(student, 'registration_number', None) or getattr(student.user, 'custom_id', None),
                "custom_id": getattr(student.user, 'custom_id', None),
                "assessments": {},
                "type_totals": {},
                "clo_attainment": {},
                "is_retake": False,
                "percentage": 0,
                "weighted_total": 0,
                "gpa": 0,
                "status": "FAIL",
            }

            # ====================================================
            # STUDENT TYPE/CLO DATA
            # ====================================================

            student_type_clo_data = defaultdict(
                lambda: defaultdict(
                    lambda: {
                        "obtained": Decimal("0"),
                        "total": Decimal("0"),
                    }
                )
            )

            # ====================================================
            # INDIVIDUAL ASSESSMENTS
            # ====================================================

            for assessment in assessments:

                assessment_questions = (
                    questions_by_assessment[
                        assessment.id
                    ]
                )

                assessment_total = sum(
                    (
                        CLOService._decimal(
                            q.marks
                        )
                        for q in assessment_questions
                    ),
                    Decimal("0")
                )

                student_total = Decimal("0")

                assessment_clo_data = {}

                for question in assessment_questions:

                    clo_code = CLOService._clo_code(
                        question.clo
                    )

                    if not clo_code:
                        continue

                    obtained = CLOService._decimal(
                        original_marks_map.get(
                            (
                                student.student_id,
                                question.id
                            ),
                            Decimal("0")
                        )
                    )

                    total = CLOService._decimal(
                        question.marks
                    )

                    student_total += obtained

                    if clo_code not in assessment_clo_data:
                        assessment_clo_data[
                            clo_code
                        ] = {
                            "obtained": Decimal("0"),
                            "total": Decimal("0")
                        }

                    assessment_clo_data[
                        clo_code
                    ]["obtained"] += obtained

                    assessment_clo_data[
                        clo_code
                    ]["total"] += total

                    # --------------------------------------------
                    # COMBINE SAME CATEGORY
                    # --------------------------------------------

                    ass_type = assessment.assessment_type

                    student_type_clo_data[
                        ass_type
                    ][clo_code]["obtained"] += obtained

                    student_type_clo_data[
                        ass_type
                    ][clo_code]["total"] += total

                # =================================================
                # INDIVIDUAL ASSESSMENT ROW
                # =================================================

                row["assessments"][
                    str(assessment.id)
                ] = {
                    "title": assessment.title,
                    "assessment_type": assessment.assessment_type,
                    "clo_data": {
                        clo: {
                            "obtained": float(
                                CLOService._round(
                                    data["obtained"]
                                )
                            ),
                            "total": float(
                                CLOService._round(
                                    data["total"]
                                )
                            )
                        }
                        for clo, data
                        in assessment_clo_data.items()
                    },
                    "total_obtained": float(
                        CLOService._round(
                            student_total
                        )
                    ),
                    "total_marks": float(
                        CLOService._round(
                            assessment_total
                        )
                    )
                }

            # ====================================================
            # RETAKE
            # ====================================================

            latest_retake = (
                retake_by_student_id.get(
                    student.student_id
                )
            )

            if latest_retake is None:

                latest_retake = (
                    CourseRetake.objects.filter(
                        student=student,
                        failed_course_id=course_id,
                        is_active=True
                    )
                    .filter(
                        Q(failed_batch_id=batch_id)
                        |
                        Q(current_batch_id=batch_id)
                    )
                    .order_by(
                        "-attempt_number"
                    )
                    .first()
                )

            retake_display_data = None

            if latest_retake:

                # =================================================
                # RETAKE ASSESSMENTS
                # =================================================

                retake_assessments = list(
                    Assessment.objects.filter(
                        course_retake=latest_retake,
                        is_finalized=True
                    ).order_by(
                        "assessment_type",
                        "id"
                    )
                )

                retake_questions = list(
                    Question.objects.filter(
                        assessment__in=retake_assessments
                    ).select_related(
                        "assessment",
                        "clo"
                    )
                )

                retake_questions_by_assessment = defaultdict(list)

                for question in retake_questions:
                    retake_questions_by_assessment[
                        question.assessment_id
                    ].append(question)

                retake_sqms = list(
                    StudentQuestionMark.objects.filter(
                        student=student,
                        question__in=retake_questions
                    ).select_related(
                        "question",
                        "question__clo"
                    )
                )

                retake_marks_map = {}

                for sqm in retake_sqms:
                    retake_marks_map[
                        sqm.question_id
                    ] = sqm.marks_obtained

                retake_type_names = {
                    assessment.assessment_type
                    for assessment
                    in retake_assessments
                }

                # =================================================
                # RETAKE DISPLAY
                # =================================================

                retake_assessment_rows = {}
                retake_type_totals = {}

                for assessment in retake_assessments:

                    ass_questions = (
                        retake_questions_by_assessment[
                            assessment.id
                        ]
                    )

                    assessment_total = sum(
                        (
                            CLOService._decimal(
                                q.marks
                            )
                            for q in ass_questions
                        ),
                        Decimal("0")
                    )

                    student_total = sum(
                        (
                            CLOService._decimal(
                                retake_marks_map.get(
                                    q.id,
                                    Decimal("0")
                                )
                            )
                            for q in ass_questions
                        ),
                        Decimal("0")
                    )

                    assessment_clo_data = {}

                    for question in ass_questions:

                        clo_code = CLOService._clo_code(
                            question.clo
                        )

                        if not clo_code:
                            continue

                        if clo_code not in assessment_clo_data:
                            assessment_clo_data[
                                clo_code
                            ] = {
                                "obtained": Decimal("0"),
                                "total": Decimal("0")
                            }

                        assessment_clo_data[
                            clo_code
                        ]["obtained"] += (
                            CLOService._decimal(
                                retake_marks_map.get(
                                    question.id,
                                    Decimal("0")
                                )
                            )
                        )

                        assessment_clo_data[
                            clo_code
                        ]["total"] += (
                            CLOService._decimal(
                                question.marks
                            )
                        )

                    ass_type = assessment.assessment_type

                    if ass_type not in retake_type_totals:
                        retake_type_totals[
                            ass_type
                        ] = {
                            "obtained": Decimal("0"),
                            "total": Decimal("0")
                        }

                    retake_type_totals[
                        ass_type
                    ]["obtained"] += student_total

                    retake_type_totals[
                        ass_type
                    ]["total"] += assessment_total

                    retake_assessment_rows[
                        str(assessment.id)
                    ] = {
                        "title": assessment.title,
                        "assessment_type": ass_type,
                        "clo_data": {
                            clo: {
                                "obtained": float(
                                    CLOService._round(
                                        data["obtained"]
                                    )
                                ),
                                "total": float(
                                    CLOService._round(
                                        data["total"]
                                    )
                                )
                            }
                            for clo, data
                            in assessment_clo_data.items()
                        },
                        "total_obtained": float(
                            CLOService._round(
                                student_total
                            )
                        ),
                        "total_marks": float(
                            CLOService._round(
                                assessment_total
                            )
                        )
                    }

                # =================================================
                # RETAKE EFFECTIVE DISPLAY
                # =================================================

                retake_rows_by_type = defaultdict(list)

                for assessment in retake_assessments:
                    retake_rows_by_type[
                        assessment.assessment_type
                    ].append(
                        retake_assessment_rows[
                            str(assessment.id)
                        ]
                    )

                effective_assessment_rows = {}
                effective_type_totals = {}
                retake_display_cells = {}

                for assessment in assessments:

                    ass_type = assessment.assessment_type

                    original_questions = (
                        questions_by_assessment[
                            assessment.id
                        ]
                    )

                    assessment_clo_data = {}

                    for question in original_questions:

                        clo_code = CLOService._clo_code(
                            question.clo
                        )

                        if not clo_code:
                            continue

                        if clo_code not in assessment_clo_data:
                            assessment_clo_data[
                                clo_code
                            ] = {
                                "obtained": Decimal("0"),
                                "total": Decimal("0")
                            }

                        assessment_clo_data[
                            clo_code
                        ]["total"] += (
                            CLOService._decimal(
                                question.marks
                            )
                        )

                    if ass_type in retake_type_names:

                        retake_clo_totals = defaultdict(
                            lambda: {
                                "obtained": Decimal("0"),
                                "total": Decimal("0")
                            }
                        )

                        for retake_row in (
                            retake_rows_by_type.get(
                                ass_type,
                                []
                            )
                        ):

                            for (
                                clo_code,
                                retake_data
                            ) in retake_row.get(
                                "clo_data",
                                {}
                            ).items():

                                retake_clo_totals[
                                    clo_code
                                ]["obtained"] += (
                                    CLOService._decimal(
                                        retake_data.get(
                                            "obtained",
                                            0
                                        )
                                    )
                                )

                                retake_clo_totals[
                                    clo_code
                                ]["total"] += (
                                    CLOService._decimal(
                                        retake_data.get(
                                            "total",
                                            0
                                        )
                                    )
                                )

                                retake_display_cells[
                                    f"{ass_type}:{clo_code}"
                                ] = {
                                    "title": retake_row.get(
                                        "title",
                                        ""
                                    ),
                                    "obtained": float(
                                        CLOService._round(
                                            retake_data.get(
                                                "obtained",
                                                0
                                            )
                                        )
                                    ),
                                    "total": float(
                                        CLOService._round(
                                            retake_data.get(
                                                "total",
                                                0
                                            )
                                        )
                                    )
                                }

                        # -----------------------------------------
                        # SCALE RETAKE TO ORIGINAL CATEGORY/CLO
                        # -----------------------------------------

                        for (
                            clo_code,
                            original_data
                        ) in assessment_clo_data.items():

                            retake_data = (
                                retake_clo_totals.get(
                                    clo_code
                                )
                            )

                            if (
                                not retake_data
                                or retake_data["total"] <= 0
                            ):
                                continue

                            original_total = (
                                original_data["total"]
                            )

                            scaled_obtained = (
                                retake_data["obtained"]
                                /
                                retake_data["total"]
                            ) * original_total

                            assessment_clo_data[
                                clo_code
                            ]["obtained"] = (
                                CLOService._round(
                                    scaled_obtained
                                )
                            )

                    else:

                        for clo_code in assessment_clo_data:
                            assessment_clo_data[
                                clo_code
                            ]["is_exempt"] = True

                    total_obtained = sum(
                        (
                            data["obtained"]
                            for data
                            in assessment_clo_data.values()
                        ),
                        Decimal("0")
                    )

                    total_available = sum(
                        (
                            data["total"]
                            for data
                            in assessment_clo_data.values()
                        ),
                        Decimal("0")
                    )

                    effective_assessment_rows[
                        str(assessment.id)
                    ] = {
                        "clo_data": {
                            clo: {
                                "obtained": float(
                                    CLOService._round(
                                        data["obtained"]
                                    )
                                ),
                                "total": float(
                                    CLOService._round(
                                        data["total"]
                                    )
                                ),
                                **(
                                    {
                                        "is_exempt": True
                                    }
                                    if data.get(
                                        "is_exempt",
                                        False
                                    )
                                    else {}
                                )
                            }
                            for clo, data
                            in assessment_clo_data.items()
                        },
                        "total_obtained": float(
                            CLOService._round(
                                total_obtained
                            )
                        ),
                        "total_marks": float(
                            CLOService._round(
                                total_available
                            )
                        ),
                        "is_exempt": (
                            ass_type
                            not in retake_type_names
                        )
                    }

                    if ass_type not in effective_type_totals:
                        effective_type_totals[
                            ass_type
                        ] = {
                            "obtained": Decimal("0"),
                            "total": Decimal("0"),
                            "is_exempt": (
                                ass_type
                                not in retake_type_names
                            )
                        }

                    effective_type_totals[
                        ass_type
                    ]["obtained"] += total_obtained

                    effective_type_totals[
                        ass_type
                    ]["total"] += total_available

                # =================================================
                # REPLACE ORIGINAL CATEGORY WITH RETAKE CATEGORY
                # =================================================

                for ass_type in retake_type_names:

                    student_type_clo_data[
                        ass_type
                    ] = defaultdict(
                        lambda: {
                            "obtained": Decimal("0"),
                            "total": Decimal("0")
                        }
                    )

                    for assessment in retake_assessments:

                        if (
                            assessment.assessment_type
                            != ass_type
                        ):
                            continue

                        for question in (
                            retake_questions_by_assessment[
                                assessment.id
                            ]
                        ):

                            clo_code = CLOService._clo_code(
                                question.clo
                            )

                            if not clo_code:
                                continue

                            obtained = CLOService._decimal(
                                retake_marks_map.get(
                                    question.id,
                                    Decimal("0")
                                )
                            )

                            total = CLOService._decimal(
                                question.marks
                            )

                            student_type_clo_data[
                                ass_type
                            ][clo_code][
                                "obtained"
                            ] += obtained

                            student_type_clo_data[
                                ass_type
                            ][clo_code][
                                "total"
                            ] += total

                retake_display_data = {
                    "attempt_number": (
                        latest_retake.attempt_number
                    ),
                    "retake_id": str(
                        latest_retake.id
                    ),
                    "retake_type_groups": (
                        CLOService._build_type_groups(
                            retake_assessments,
                            retake_questions
                        )
                    ),
                    "retake_assessments": (
                        retake_assessment_rows
                    ),
                    "retake_type_totals": {
                        key: {
                            "obtained": float(
                                CLOService._round(
                                    value["obtained"]
                                )
                            ),
                            "total": float(
                                CLOService._round(
                                    value["total"]
                                )
                            )
                        }
                        for key, value
                        in retake_type_totals.items()
                    },
                    "retake_display_cells": (
                        retake_display_cells
                    ),
                    "assessments": (
                        effective_assessment_rows
                    ),
                    "type_totals": {
                        key: {
                            "obtained": float(
                                CLOService._round(
                                    value["obtained"]
                                )
                            ),
                            "total": float(
                                CLOService._round(
                                    value["total"]
                                )
                            ),
                            "is_exempt": value.get(
                                "is_exempt",
                                False
                            )
                        }
                        for key, value
                        in effective_type_totals.items()
                    },
                    "exempt_types": sorted(
                        original_type_names
                        -
                        retake_type_names
                    )
                }

                row["is_retake"] = True
                row.update(
                    retake_display_data
                )

                retake_report.append(
                    row.copy()
                )

            # ====================================================
            # WEIGHTED COURSE CALCULATION
            # ====================================================
            #
            # VERY IMPORTANT:
            #
            # CATEGORY FIRST
            #
            # Example:
            #
            # Quiz 1 = 8/10
            # Quiz 2 = 6/10
            # Quiz 3 = 9/10
            #
            # Combined:
            #
            # 23/30 = 76.67%
            #
            # Quiz weight = 5
            #
            # 76.67% × 5 = 3.8335
            #
            # Quiz contribution = 3.83 / 5
            #
            # ====================================================

            weighted_total = Decimal("0")

            # This will store the weighted contribution
            # for every CLO.
            student_clo_weighted = {
                f"CLO-{order_num}": Decimal("0")
                for order_num in clos_by_order
            }

            # This stores the maximum applicable weighted
            # contribution for each CLO.
            student_clo_applicable_weight = {
                f"CLO-{order_num}": Decimal("0")
                for order_num in clos_by_order
            }

            # ====================================================
            # EACH ASSESSMENT CATEGORY
            # ====================================================

            for ass_type in CLOService.ASSESSMENT_ORDER:

                type_data = (
                    student_type_clo_data.get(
                        ass_type
                    )
                )

                if not type_data:
                    continue

                type_assessments = [
                    assessment
                    for assessment in assessments
                    if assessment.assessment_type
                    == ass_type
                ]

                if not type_assessments:
                    continue

                # -----------------------------------------------
                # CATEGORY WEIGHT APPLIED ONLY ONCE
                # -----------------------------------------------

                weightage = (
                    CLOService._get_assessment_weight(
                        type_assessments[0]
                    )
                )

                category_obtained = Decimal("0")
                category_total = Decimal("0")

                for clo_code, data in type_data.items():

                    category_obtained += data[
                        "obtained"
                    ]

                    category_total += data[
                        "total"
                    ]

                if category_total <= 0:
                    continue

                # =================================================
                # CATEGORY PERCENTAGE
                # =================================================

                category_percentage = (
                    category_obtained
                    /
                    category_total
                ) * Decimal("100")

                # =================================================
                # CATEGORY WEIGHTED SCORE
                # =================================================
                #
                # Quiz:
                #
                # 76.67 / 100 × 5
                # = 3.83
                #
                # =================================================

                category_weighted_score = (
                    category_percentage
                    /
                    Decimal("100")
                ) * weightage

                category_weighted_score = (
                    CLOService._round(
                        category_weighted_score
                    )
                )

                weighted_total += (
                    category_weighted_score
                )

                # =================================================
                # CLO-WISE DATA
                # =================================================

                type_clo_results = {}

                for clo_code, data in type_data.items():

                    clo_obtained = data[
                        "obtained"
                    ]

                    clo_total = data[
                        "total"
                    ]

                    if clo_total <= 0:
                        continue

                    clo_percentage = (
                        clo_obtained
                        /
                        clo_total
                    ) * Decimal("100")

                    # =================================================
                    # IMPORTANT:
                    #
                    # Category weight is DISTRIBUTED according
                    # to this CLO's share of category marks.
                    #
                    # Example:
                    #
                    # Quiz category total = 30
                    # CLO-1 quiz marks = 20
                    # CLO-2 quiz marks = 10
                    #
                    # Quiz weight = 5
                    #
                    # CLO-1 gets:
                    # 20/30 × 5 = 3.33 applicable weight
                    #
                    # CLO-2 gets:
                    # 10/30 × 5 = 1.67 applicable weight
                    #
                    # Total = 5
                    #
                    # =================================================

                    clo_weight_share = (
                        clo_total
                        /
                        category_total
                    )

                    clo_applicable_weight = (
                        weightage
                        *
                        clo_weight_share
                    )

                    clo_weighted_score = (
                        clo_percentage
                        /
                        Decimal("100")
                    ) * clo_applicable_weight

                    clo_applicable_weight = (
                        CLOService._round(
                            clo_applicable_weight
                        )
                    )

                    clo_weighted_score = (
                        CLOService._round(
                            clo_weighted_score
                        )
                    )

                    if clo_code not in student_clo_weighted:
                        student_clo_weighted[
                            clo_code
                        ] = Decimal("0")

                    if clo_code not in student_clo_applicable_weight:
                        student_clo_applicable_weight[
                            clo_code
                        ] = Decimal("0")

                    student_clo_weighted[
                        clo_code
                    ] += clo_weighted_score

                    student_clo_applicable_weight[
                        clo_code
                    ] += clo_applicable_weight

                    type_clo_results[
                        clo_code
                    ] = {
                        "obtained": float(
                            CLOService._round(
                                clo_obtained
                            )
                        ),
                        "total": float(
                            CLOService._round(
                                clo_total
                            )
                        ),
                        "percentage": float(
                            CLOService._round(
                                clo_percentage
                            )
                        ),
                        "weightage": float(
                            weightage
                        ),
                        "applicable_weight": float(
                            clo_applicable_weight
                        ),
                        "weighted_score": float(
                            clo_weighted_score
                        ),
                    }

                # =================================================
                # TYPE TOTAL FOR FRONTEND
                # =================================================

                row["type_totals"][
                    ass_type
                ] = {
                    "obtained": float(
                        CLOService._round(
                            category_obtained
                        )
                    ),
                    "total": float(
                        CLOService._round(
                            category_total
                        )
                    ),
                    "percentage": float(
                        CLOService._round(
                            category_percentage
                        )
                    ),
                    "weightage": float(
                        weightage
                    ),
                    "weighted_score": float(
                        category_weighted_score
                    ),
                    "label": (
                        CLOService.ASSESSMENT_LABELS.get(
                            ass_type,
                            ass_type.title()
                        )
                    ),
                    "assessment_count": len(
                        type_assessments
                    ),
                    "clo_data": type_clo_results,
                }

            # ====================================================
            # CLO ATTAINMENT
            # ====================================================
            #
            # Example:
            #
            # CLO-1:
            #
            # Quiz contribution     = 3.20
            # Assignment            = 2.10
            # Presentation          = 4.00
            # Midterm               = 22.00
            # Final                 = 40.00
            #
            # Total weighted        = 71.30
            #
            # Applicable weight     = 95
            #
            # CLO attainment:
            #
            # 71.30 / 95 × 100
            #
            # ====================================================

            for order_num in clos_by_order:

                clo_code = f"CLO-{order_num}"

                weighted_obtained = (
                    student_clo_weighted.get(
                        clo_code,
                        Decimal("0")
                    )
                )

                applicable_weight = (
                    student_clo_applicable_weight.get(
                        clo_code,
                        Decimal("0")
                    )
                )

                if applicable_weight > 0:

                    clo_percentage = (
                        weighted_obtained
                        /
                        applicable_weight
                    ) * Decimal("100")

                else:
                    clo_percentage = Decimal("0")

                # -----------------------------------------------
                # KPI / BLOOM
                # -----------------------------------------------

                kpi = 60
                level = "1"

                for clo in clos_by_order[
                    order_num
                ]:

                    kpi = getattr(
                        clo,
                        "kpi_target",
                        60
                    )

                    level = str(
                        getattr(
                            clo,
                            "bloom_level",
                            "K1"
                        )
                    ).replace(
                        "K",
                        ""
                    )

                    break

                clo_percentage = (
                    CLOService._round(
                        clo_percentage
                    )
                )

                row["clo_attainment"][
                    clo_code
                ] = {
                    "percentage": float(
                        clo_percentage
                    ),
                    "weighted_score": float(
                        CLOService._round(
                            weighted_obtained
                        )
                    ),
                    "applicable_weight": float(
                        CLOService._round(
                            applicable_weight
                        )
                    ),
                    "kpi": kpi,
                    "level": level,
                    "status": (
                        "Achieved"
                        if clo_percentage
                        >= CLOService._decimal(kpi)
                        else
                        "Not Achieved"
                    )
                }

            # ====================================================
            # FINAL COURSE PERCENTAGE
            # ====================================================

            percentage = (
                CLOService._round(
                    weighted_total
                )
            )

            # ====================================================
            # GPA
            # ====================================================

            if percentage >= 85:
                gpa = Decimal("4.0")

            elif percentage >= 75:
                gpa = Decimal("3.5")

            elif percentage >= 65:
                gpa = Decimal("3.0")

            elif percentage >= 50:
                gpa = Decimal("2.0")

            else:
                gpa = Decimal("0.0")

            row["percentage"] = float(
                percentage
            )

            row["weighted_total"] = float(
                percentage
            )

            row["gpa"] = float(
                gpa
            )

            row["status"] = (
                "PASS"
                if percentage >= Decimal("50")
                else "FAIL"
            )

            # ====================================================
            # COUNT
            # ====================================================

            regular_count += 1

            row["count"] = regular_count

            report.append(row)

        # ========================================================
        # CLASS CLO ATTAINMENT
        # ========================================================

        total_students = len(report)

        class_clo_pass_count = {
            f"CLO-{order_num}": 0
            for order_num in clos_by_order
        }

        # ========================================================
        # COUNT STUDENTS WITH CLO >= 50%
        # ========================================================

        for row in report:

            for clo_code in class_clo_pass_count:

                clo_percentage = (
                    row.get(
                        "clo_attainment",
                        {}
                    )
                    .get(
                        clo_code,
                        {}
                    )
                    .get(
                        "percentage",
                        0
                    )
                )

                if (
                    CLOService._decimal(
                        clo_percentage
                    )
                    >= Decimal("50")
                ):
                    class_clo_pass_count[
                        clo_code
                    ] += 1

        # ========================================================
        # CLASS CLO RESULT
        # ========================================================

        class_clo_attainment = {}

        for order_num in clos_by_order:

            clo_code = f"CLO-{order_num}"

            if total_students > 0:

                class_percent = (
                    Decimal(
                        class_clo_pass_count[
                            clo_code
                        ]
                    )
                    /
                    Decimal(
                        total_students
                    )
                ) * Decimal("100")

            else:
                class_percent = Decimal("0")

            # ====================================================
            # FIND TARGET CLO
            # ====================================================

            target_clo = None
            kpi = 60
            level = "1"

            for clo in clos_by_order[
                order_num
            ]:

                has_original = Question.objects.filter(
                    clo=clo,
                    assessment__course_id=course_id,
                    assessment__batch_id=batch_id,
                    assessment__semester_id=semester_id,
                    assessment__in=assessments,
                    assessment__course_retake__isnull=True
                ).exists()

                if has_original:

                    target_clo = clo

                    kpi = getattr(
                        clo,
                        "kpi_target",
                        60
                    )

                    level = str(
                        getattr(
                            clo,
                            "bloom_level",
                            "K1"
                        )
                    ).replace(
                        "K",
                        ""
                    )

                    break

            if not target_clo:

                target_clo = (
                    clos_by_order[
                        order_num
                    ][0]
                )

                kpi = getattr(
                    target_clo,
                    "kpi_target",
                    60
                )

                level = str(
                    getattr(
                        target_clo,
                        "bloom_level",
                        "K1"
                    )
                ).replace(
                    "K",
                    ""
                )

            class_percent = (
                CLOService._round(
                    class_percent
                )
            )

            is_achieved = (
                class_percent
                >=
                CLOService._decimal(kpi)
            )

            # ====================================================
            # SAVE CLO ATTAINMENT
            # ====================================================

            CLOAttainment.objects.update_or_create(
                clo=target_clo,
                course_id=course_id,
                batch_id=batch_id,
                semester_id=semester_id,
                defaults={
                    "attained_percentage": float(
                        class_percent
                    ),
                    "kpi_target": kpi,
                    "is_achieved": is_achieved,
                    "report_status": report_status,
                    "is_locked": lock_attainment,
                }
            )

            class_clo_attainment[
                clo_code
            ] = {
                "percentage": float(
                    class_percent
                ),
                "kpi": kpi,
                "level": level,
                "status": (
                    "Achieved"
                    if is_achieved
                    else
                    "Not Achieved"
                )
            }

        # ========================================================
        # FORMATTED ASSESSMENTS
        # ========================================================

        formatted_assessments = (
            CLOService._build_type_groups(
                assessments,
                questions
            )
        )

        # ========================================================
        # UNIQUE CLO LIST
        # ========================================================

        all_clos = []

        seen_clos = set()

        for clo in clos:

            clo_code = (
                f"CLO-{clo.order_number}"
            )

            if clo_code not in seen_clos:

                seen_clos.add(
                    clo_code
                )

                all_clos.append(
                    clo_code
                )

        all_clos.sort()

        # ========================================================
        # RETURN
        # ========================================================

        return {
            "students": report,

            "retake_students": [],

            "retake_students_legacy": retake_report,

            "type_groups": formatted_assessments,

            "class_clo_attainment": (
                class_clo_attainment
            ),

            "all_clos": all_clos,

            "allow_result_editing": (
                session.allow_result_editing
                if session
                else False
            ),

            "report_status": report_status,

            # -----------------------------------------------
            # SEND WEIGHTS TO FRONTEND
            # -----------------------------------------------

            "assessment_weights": {
                key: float(value)
                for key, value
                in CLOService.ASSESSMENT_WEIGHTS.items()
            },

            "course": {
                "code": (
                    course.code
                    if course
                    else ""
                ),
                "name": (
                    course.name
                    if course
                    else ""
                )
            },

            "semester": {
                "number": (
                    semester.number
                    if semester
                    else ""
                )
            }
        }