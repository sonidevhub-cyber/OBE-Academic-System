
from decimal import Decimal
from django.db.models import Q
from assessments.models import Assessment, Question, StudentQuestionMark, CLOAttainment
from students.models import Student
from obe.models import CLO
from academic_structure.models import Course as AcademicCourse, Semester as AcademicSemester
from obe.models import CourseSession
from obe.services import get_students_for_batch

class CLOService:

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
        session = CourseSession.objects.filter(
            course_id=course_id,
            batch_id=batch_id,
            semester_id=semester_id,
            is_active=True
        ).first()
        students = list(get_students_for_batch(session.batch)) if session else list(
            Student.objects.filter(
                Q(user__batch_id=batch_id) | Q(batch_id=batch_id)
            ).distinct()
        )
        assessments_query = Assessment.objects.filter(
            course_id=course_id,
            batch_id=batch_id,
            semester_id=semester_id,
            is_finalized=True,
            course_retake__isnull=True  # Only original assessments
        )
        if assessment_types is not None:
            assessments_query = assessments_query.filter(assessment_type__in=assessment_types)
        assessments = list(assessments_query.order_by('assessment_type', 'id'))

        if not assessments:
            return {"error": "No finalized assessments found"}

        # Get course and semester info
        course = None
        semester = None
        try:
            course = AcademicCourse.objects.get(id=course_id)
        except AcademicCourse.DoesNotExist:
            pass
        try:
            semester = AcademicSemester.objects.get(id=semester_id)
        except AcademicSemester.DoesNotExist:
            pass

        clos = list(CLO.objects.filter(course_id=course_id))
        questions = list(
            Question.objects.filter(assessment__in=assessments)
            .select_related('assessment', 'clo')
        )
        
        # Pre-fetch original student question marks for all students
        original_sqms = list(StudentQuestionMark.objects.filter(
            student__in=students,
            question__in=questions,
            course_retake__isnull=True
        ).select_related('student', 'question', 'question__clo'))
        
        # Build original marks map
        original_marks_map = {}
        for sqm in original_sqms:
            key = (sqm.student_id, sqm.question_id)
            original_marks_map[key] = sqm.marks_obtained

        retake_by_student_id = {}
        from retake.models import CourseRetake
        active_retakes = CourseRetake.objects.filter(
            failed_course_id=course_id,
            is_active=True,
        ).filter(
            Q(failed_batch_id=batch_id) | Q(current_batch_id=batch_id)
        ).select_related('student')
        students_by_id = {student.student_id: student for student in students}
        for retake in active_retakes.order_by('student_id', 'attempt_number'):
            retake_by_student_id[retake.student_id] = retake
            if retake.student_id not in students_by_id:
                students.append(retake.student)
                students_by_id[retake.student_id] = retake.student
        if course_retake is not None:
            retake_by_student_id[course_retake.student_id] = course_retake

        report = []
        retake_report = []

        # Group all active clos (any curriculum) by order number!
        from collections import defaultdict
        all_clos = CLO.objects.filter(course_id=course_id, is_active=True)
        clos_by_order = defaultdict(list)
        for clo in all_clos:
            clos_by_order[clo.order_number].append(clo)
            
        # Initialize class headcount totals for CLO attainment (>=50% criteria)
        class_clo_pass_count = {f"CLO-{order_num}": 0 for order_num in clos_by_order}
        total_students = len(students)

        def build_type_groups(source_assessments, source_questions):
            formatted = []
            assessment_types = ["quiz", "assignment", "presentation", "sessional", "midterm", "final"]
            for type_name in assessment_types:
                type_assessments = []
                for assessment in source_assessments:
                    if assessment.assessment_type != type_name:
                        continue
                    ass_questions = [q for q in source_questions if q.assessment_id == assessment.id]
                    ass_clos = {}
                    for q in ass_questions:
                        clo_code = f"CLO-{q.clo.order_number}"
                        if clo_code not in ass_clos:
                            ass_clos[clo_code] = 0
                        ass_clos[clo_code] += q.marks
                    clo_list = []
                    for clo_code, total in ass_clos.items():
                        clo_list.append({"clo": clo_code, "total": float(total)})
                    type_assessments.append({
                        "id": str(assessment.id),
                        "title": assessment.title,
                        "clos": clo_list,
                        "total_marks": float(assessment.total_marks),
                    })
                if type_assessments:
                    type_clos = []
                    seen = set()
                    for ass in type_assessments:
                        for c in ass["clos"]:
                            if c["clo"] not in seen:
                                seen.add(c["clo"])
                                type_clos.append(c["clo"])
                    type_clos.sort()
                    formatted.append({
                        "type": type_name,
                        "assessments": type_assessments,
                        "clos": type_clos
                    })
            return formatted

        original_type_names = {assessment.assessment_type for assessment in assessments}

        regular_count = 0
        for student in students:
            row = {
                "count": 0,
                "student_id": str(student.student_id),
                "name": student.name,
                "assessments": {},
                "type_totals": {},
                "clo_attainment": {},
                "is_retake": False,
            }

            # Initialize per-student CLO totals, using order numbers as keys!
            student_clo_obtained = {f"CLO-{order_num}": Decimal('0') for order_num in clos_by_order}
            student_clo_total = {f"CLO-{order_num}": Decimal('0') for order_num in clos_by_order}

            # First fill student's clo totals from original
            for assessment in assessments:
                assessment_questions = [q for q in questions if q.assessment_id == assessment.id]
                assessment_total = sum(q.marks for q in assessment_questions)
                student_total = sum(
                    original_marks_map.get((student.pk, q.id), 0)
                    for q in assessment_questions
                )

                assessment_clo_data = {}
                # For each question in this assessment, get its clo order number!
                for q in assessment_questions:
                    clo_code = f"CLO-{q.clo.order_number}"
                    if clo_code not in assessment_clo_data:
                        assessment_clo_data[clo_code] = {
                            "obtained": 0,
                            "total": 0
                        }
                    assessment_clo_data[clo_code]["obtained"] += original_marks_map.get((student.pk, q.id), 0)
                    assessment_clo_data[clo_code]["total"] += q.marks
                
                # Update student and class totals
                for clo_code, data in assessment_clo_data.items():
                    student_clo_obtained[clo_code] += Decimal(data["obtained"])
                    student_clo_total[clo_code] += Decimal(data["total"])

                # Update type totals
                ass_type = assessment.assessment_type
                if ass_type not in row["type_totals"]:
                    row["type_totals"][ass_type] = {
                        "obtained": 0,
                        "total": 0
                    }
                row["type_totals"][ass_type]["obtained"] += float(student_total)
                row["type_totals"][ass_type]["total"] += float(assessment_total)

                row["assessments"][str(assessment.id)] = {
                    "clo_data": assessment_clo_data,
                    "total_obtained": float(student_total),
                    "total_marks": float(assessment_total)
                }

            # Now check if student has retake and adjust student_clo_obtained
            latest_retake = retake_by_student_id.get(student.student_id)
            if latest_retake is None:
                latest_retake = CourseRetake.objects.filter(
                    student=student,
                    failed_course_id=course_id,
                    is_active=True
                ).filter(
                    Q(failed_batch_id=batch_id) | Q(current_batch_id=batch_id)
                ).order_by('-attempt_number').first()

            retake_display_data = None
            if latest_retake:
                # Get retake assessments, questions, and marks
                retake_assessments = list(Assessment.objects.filter(
                    course_retake=latest_retake,
                    is_finalized=True
                ).order_by('assessment_type', 'id'))
                retake_questions = list(
                    Question.objects.filter(assessment__in=retake_assessments)
                    .select_related('assessment', 'clo')
                )
                retake_sqms = list(StudentQuestionMark.objects.filter(
                    student=student,
                    question__in=retake_questions
                ).select_related('question', 'question__clo'))

                # Group retake sqms by clo order number!
                retake_sqms_by_order = defaultdict(list)
                retake_total_by_order = defaultdict(int)
                retake_marks_map = {}
                for sqm in retake_sqms:
                    retake_marks_map[sqm.question_id] = sqm.marks_obtained
                    order_num = sqm.question.clo.order_number
                    retake_sqms_by_order[order_num].append(sqm)
                    retake_total_by_order[order_num] += sqm.question.marks

                retake_assessment_rows = {}
                retake_type_totals = {}
                for assessment in retake_assessments:
                    assessment_questions = [q for q in retake_questions if q.assessment_id == assessment.id]
                    assessment_total = sum(q.marks for q in assessment_questions)
                    student_total = sum(
                        retake_marks_map.get(q.id, Decimal('0'))
                        for q in assessment_questions
                    )

                    assessment_clo_data = {}
                    for q in assessment_questions:
                        clo_code = f"CLO-{q.clo.order_number}"
                        if clo_code not in assessment_clo_data:
                            assessment_clo_data[clo_code] = {
                                "obtained": 0,
                                "total": 0
                            }
                        assessment_clo_data[clo_code]["obtained"] += float(retake_marks_map.get(q.id, Decimal('0')))
                        assessment_clo_data[clo_code]["total"] += float(q.marks)

                    ass_type = assessment.assessment_type
                    if ass_type not in retake_type_totals:
                        retake_type_totals[ass_type] = {
                            "obtained": 0,
                            "total": 0
                        }
                    retake_type_totals[ass_type]["obtained"] += float(student_total)
                    retake_type_totals[ass_type]["total"] += float(assessment_total)

                    retake_assessment_rows[str(assessment.id)] = {
                        "title": assessment.title,
                        "assessment_type": assessment.assessment_type,
                        "clo_data": assessment_clo_data,
                        "total_obtained": float(student_total),
                        "total_marks": float(assessment_total)
                    }

                retake_type_names = {assessment.assessment_type for assessment in retake_assessments}

                # Keep retake students compatible with the main report table, whose
                # headers are based on the original finalized assessments. Retake
                # marks are copied into matching original assessment-type/CLO cells;
                # exempt assessment types remain visible as NA on the frontend.
                retake_rows_by_type = defaultdict(list)
                for retake_assessment in retake_assessments:
                    retake_rows_by_type[retake_assessment.assessment_type].append(
                        retake_assessment_rows.get(str(retake_assessment.id), {})
                    )

                effective_assessment_rows = {}
                effective_type_totals = {}
                retake_display_cells = {}
                for assessment in assessments:
                    ass_type = assessment.assessment_type
                    original_assessment_questions = [
                        q for q in questions if q.assessment_id == assessment.id
                    ]
                    assessment_clo_data = {}
                    for q in original_assessment_questions:
                        clo_code = f"CLO-{q.clo.order_number}"
                        if clo_code not in assessment_clo_data:
                            assessment_clo_data[clo_code] = {
                                "obtained": 0,
                                "total": 0
                            }
                        assessment_clo_data[clo_code]["total"] += float(q.marks)

                    if ass_type in retake_type_names:
                        retake_clo_totals = defaultdict(lambda: {"obtained": Decimal('0'), "total": Decimal('0')})
                        for retake_row in retake_rows_by_type.get(ass_type, []):
                            for clo_code, retake_clo_data in retake_row.get("clo_data", {}).items():
                                retake_clo_totals[clo_code]["obtained"] += Decimal(
                                    str(retake_clo_data.get("obtained", 0))
                                )
                                retake_clo_totals[clo_code]["total"] += Decimal(
                                    str(retake_clo_data.get("total", 0))
                                )
                                retake_display_cells[f"{ass_type}:{clo_code}"] = {
                                    "title": retake_row.get("title", ""),
                                    "obtained": float(retake_clo_data.get("obtained", 0)),
                                    "total": float(retake_clo_data.get("total", 0)),
                                }

                        for clo_code, original_clo_data in assessment_clo_data.items():
                            retake_clo_data = retake_clo_totals.get(clo_code)
                            if not retake_clo_data or retake_clo_data["total"] <= 0:
                                continue
                            original_total = Decimal(str(original_clo_data.get("total", 0)))
                            scaled_obtained = (
                                retake_clo_data["obtained"] / retake_clo_data["total"]
                            ) * original_total
                            assessment_clo_data[clo_code]["obtained"] = float(
                                round(scaled_obtained, 2)
                            )
                    else:
                        for clo_code in assessment_clo_data:
                            assessment_clo_data[clo_code]["is_exempt"] = True

                    total_obtained = sum(
                        Decimal(str(data.get("obtained", 0)))
                        for data in assessment_clo_data.values()
                    )
                    total_available = sum(
                        Decimal(str(data.get("total", 0)))
                        for data in assessment_clo_data.values()
                    )

                    effective_assessment_rows[str(assessment.id)] = {
                        "clo_data": assessment_clo_data,
                        "total_obtained": float(total_obtained),
                        "total_marks": float(total_available),
                        "is_exempt": ass_type not in retake_type_names,
                    }

                    if ass_type not in effective_type_totals:
                        effective_type_totals[ass_type] = {
                            "obtained": 0,
                            "total": 0,
                            "is_exempt": ass_type not in retake_type_names,
                        }
                    effective_type_totals[ass_type]["obtained"] += float(total_obtained)
                    effective_type_totals[ass_type]["total"] += float(total_available)
                    effective_type_totals[ass_type]["is_exempt"] = (
                        effective_type_totals[ass_type]["is_exempt"]
                        and ass_type not in retake_type_names
                    )

                retake_display_data = {
                    "attempt_number": latest_retake.attempt_number,
                    "retake_id": str(latest_retake.id),
                    "retake_type_groups": build_type_groups(retake_assessments, retake_questions),
                    "retake_assessments": retake_assessment_rows,
                    "retake_type_totals": retake_type_totals,
                    "retake_display_cells": retake_display_cells,
                    "assessments": effective_assessment_rows,
                    "type_totals": effective_type_totals,
                    "exempt_types": sorted(original_type_names - retake_type_names),
                }

                # Now adjust student_clo_obtained for each clo order number with retakes
                for order_num in retake_sqms_by_order:
                    clo_key = f"CLO-{order_num}"
                    # Get original total for this clo order number!
                    original_clo_questions = [
                        q for q in questions if q.assessment.course_retake_id is None and q.clo.order_number == order_num
                    ]
                    original_total = sum(q.marks for q in original_clo_questions)

                    # Calculate retake total
                    retake_clo_sqms = retake_sqms_by_order[order_num]
                    retake_total = retake_total_by_order[order_num]
                    retake_obtained = sum(sqm.marks_obtained for sqm in retake_clo_sqms)

                    if original_total > 0 and retake_total > 0:
                        scaled_obtained = (retake_obtained / retake_total) * original_total
                    else:
                        scaled_obtained = 0

                    # Update student_clo_obtained (replace original with scaled retake)
                    student_clo_obtained[clo_key] = Decimal(scaled_obtained)
                    student_clo_total[clo_key] = Decimal(original_total)
            # Now calculate clo attainment for student
            for order_num in clos_by_order:
                clo_code = f"CLO-{order_num}"
                total_clo = student_clo_total[clo_code]
                if total_clo > 0:
                    percent = (student_clo_obtained[clo_code] / total_clo) * 100
                else:
                    percent = Decimal('0')
                
                # Find any clo in this order number to get kpi and level!
                kpi = 60
                level = "1"
                for clo in clos_by_order[order_num]:
                    kpi = getattr(clo, "kpi_target", 60)
                    level = getattr(clo, "bloom_level", "K1").replace("K", "")
                    break

                row["clo_attainment"][clo_code] = {
                    "percentage": float(round(percent, 2)),
                    "kpi": kpi,
                    "level": level,
                    "status": "Achieved" if percent >= kpi else "Not Achieved"
                }

            # Overall score should reflect the effective retake-adjusted totals.
            obtained_marks = sum(student_clo_obtained.values())
            total_marks = sum(student_clo_total.values())
            percentage = (obtained_marks / total_marks) * 100 if total_marks else 0
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

            row["percentage"] = float(round(percentage, 2))
            row["gpa"] = float(gpa)
            row["status"] = "PASS" if percentage >= 50 else "FAIL"
            # Update class pass count for each CLO if student attained ≥50%
            for order_num in clos_by_order:
                clo_code = f"CLO-{order_num}"
                total_clo = student_clo_total[clo_code]
                if total_clo > 0:
                    student_percent = (student_clo_obtained[clo_code] / total_clo) * 100
                    if student_percent >= 50:
                        class_clo_pass_count[clo_code] += 1

            regular_count += 1
            row["count"] = regular_count

            if latest_retake:
                row["is_retake"] = True
                if retake_display_data:
                    row.update(retake_display_data)
                retake_report.append(row.copy())

            report.append(row)

        total_students = len(report)
        class_clo_pass_count = {f"CLO-{order_num}": 0 for order_num in clos_by_order}
        for row in report:
            for clo_code in class_clo_pass_count:
                clo_percentage = row.get("clo_attainment", {}).get(clo_code, {}).get("percentage", 0)
                if Decimal(str(clo_percentage)) >= Decimal('50'):
                    class_clo_pass_count[clo_code] += 1

        class_clo_attainment = {}
        for order_num in clos_by_order:
            clo_code = f"CLO-{order_num}"
            # Calculate class-level attainment using headcount KPI
            if total_students > 0:
                class_percent = (Decimal(class_clo_pass_count[clo_code]) / Decimal(total_students)) * 100
            else:
                class_percent = Decimal('0')
            
            # Find which clo in this order number is the "original" one to use for CLOAttainment!
            target_clo = None
            kpi = 60
            level = "1"
            for clo in clos_by_order[order_num]:
                # Check if this clo has any original questions!
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
                    kpi = getattr(clo, "kpi_target", 60)
                    level = getattr(clo, "bloom_level", "K1").replace("K", "")
                    break
            if not target_clo:
                # Just take first one
                target_clo = clos_by_order[order_num][0]
                kpi = getattr(target_clo, "kpi_target", 60)
                level = getattr(target_clo, "bloom_level", "K1").replace("K", "")

            is_achieved = class_percent >= kpi

            CLOAttainment.objects.update_or_create(
                clo=target_clo,
                course_id=course_id,
                batch_id=batch_id,
                semester_id=semester_id,
                defaults={
                    "attained_percentage": round(class_percent, 2),
                    "kpi_target": kpi,
                    "is_achieved": is_achieved,
                    "report_status": report_status,
                    "is_locked": lock_attainment,
                }
            )

            class_clo_attainment[clo_code] = {
                "percentage": float(round(class_percent, 2)),
                "kpi": kpi,
                "level": level,
                "status": "Achieved" if is_achieved else "Not Achieved"
            }

        formatted_assessments = build_type_groups(assessments, questions)

        # Collect all unique CLOs for summary
        all_clos = []
        seen_clos = set()
        for clo in clos:
            clo_code = f"CLO-{clo.order_number}"
            if clo_code not in seen_clos:
                seen_clos.add(clo_code)
                all_clos.append(clo_code)
        all_clos.sort()

        return {
            "students": report,
            "retake_students": [],
            "retake_students_legacy": retake_report,
            "type_groups": formatted_assessments,
            "class_clo_attainment": class_clo_attainment,
            "all_clos": all_clos,
            "allow_result_editing": session.allow_result_editing if session else False,
            "report_status": report_status,
            "course": {
                "code": course.code if course else "",
                "name": course.name if course else ""
            },
            "semester": {
                "number": semester.number if semester else ""
            }
        }
