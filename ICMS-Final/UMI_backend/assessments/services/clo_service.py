from decimal import Decimal
from assessments.models import Assessment, Question, StudentQuestionMark, CLOAttainment
from students.models import Student
from obe.models import CLO
from academic_structure.models import Course as AcademicCourse, Semester as AcademicSemester


class CLOService:

    @staticmethod
    def generate_student_report(course_id, batch_id, semester_id):
        students = list(Student.objects.filter(user__batch_id=batch_id))
        assessments = list(Assessment.objects.filter(
            course_id=course_id,
            batch_id=batch_id,
            semester_id=semester_id,
            is_finalized=True
        ).order_by('assessment_type', 'id'))

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
        all_marks = list(
            StudentQuestionMark.objects.filter(
                student__user__batch_id=batch_id,
                question__in=questions
            ).select_related('student', 'question', 'question__clo')
        )

        marks_map = {
            (m.student_id, m.question_id): m.marks_obtained
            for m in all_marks
        }

        report = []

        # Initialize class totals (will accumulate across all students)
        class_clo_obtained = {f"CLO-{clo.order_number}": Decimal('0') for clo in clos}
        class_clo_total = {f"CLO-{clo.order_number}": Decimal('0') for clo in clos}

        for idx, student in enumerate(students, 1):
            row = {
                "count": idx,
                "name": student.name,
                "assessments": {},
                "type_totals": {},
                "clo_attainment": {}
            }

            obtained_marks = Decimal('0')
            total_marks = Decimal('0')

            # Initialize per-student CLO totals
            student_clo_obtained = {f"CLO-{clo.order_number}": Decimal('0') for clo in clos}
            student_clo_total = {f"CLO-{clo.order_number}": Decimal('0') for clo in clos}

            for assessment in assessments:
                assessment_questions = [q for q in questions if q.assessment_id == assessment.id]

                assessment_total = sum(q.marks for q in assessment_questions)
                student_total = sum(
                    marks_map.get((student.pk, q.id), 0)
                    for q in assessment_questions
                )

                obtained_marks += Decimal(student_total)
                total_marks += Decimal(assessment_total)

                assessment_clo_data = {}
                for clo in clos:
                    clo_questions = [q for q in assessment_questions if q.clo_id == clo.id]
                    if not clo_questions:
                        continue

                    clo_obtained = sum(
                        marks_map.get((student.pk, q.id), 0)
                        for q in clo_questions
                    )
                    clo_total = sum(q.marks for q in clo_questions)
                    clo_code = f"CLO-{clo.order_number}"

                    assessment_clo_data[clo_code] = {
                        "obtained": float(clo_obtained),
                        "total": float(clo_total)
                    }

                    # Update both student and class totals
                    student_clo_obtained[clo_code] += Decimal(clo_obtained)
                    student_clo_total[clo_code] += Decimal(clo_total)
                    class_clo_obtained[clo_code] += Decimal(clo_obtained)
                    class_clo_total[clo_code] += Decimal(clo_total)

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

            for clo in clos:
                clo_code = f"CLO-{clo.order_number}"
                total_clo = student_clo_total[clo_code]
                if total_clo > 0:
                    percent = (student_clo_obtained[clo_code] / total_clo) * 100
                else:
                    percent = Decimal('0')

                kpi = getattr(clo, "kpi_target", 60)
                level = getattr(clo, "bloom_level", "K1").replace("K", "")

                row["clo_attainment"][clo_code] = {
                    "percentage": float(round(percent, 2)),
                    "kpi": kpi,
                    "level": level,
                    "status": "Achieved" if percent >= kpi else "Not Achieved"
                }

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
            report.append(row)

        class_clo_attainment = {}
        for clo in clos:
            clo_code = f"CLO-{clo.order_number}"
            total_clo = class_clo_total[clo_code]
            avg = Decimal('0')
            if total_clo > 0:
                avg = (class_clo_obtained[clo_code] / total_clo) * 100

            kpi = getattr(clo, "kpi_target", 60)
            level = getattr(clo, "bloom_level", "K1").replace("K", "")
            is_achieved = avg >= kpi

            CLOAttainment.objects.update_or_create(
                clo=clo,
                course_id=course_id,
                batch_id=batch_id,
                semester_id=semester_id,
                defaults={
                    "attained_percentage": round(avg, 2),
                    "kpi_target": kpi,
                    "is_achieved": is_achieved
                }
            )

            class_clo_attainment[clo_code] = {
                "percentage": float(round(avg, 2)),
                "kpi": kpi,
                "level": level,
                "status": "Achieved" if is_achieved else "Not Achieved"
            }

        formatted_assessments = []
        assessment_types = ["quiz", "assignment", "midterm", "presentation", "final"]
        for type_name in assessment_types:
            type_assessments = []
            for assessment in assessments:
                if assessment.assessment_type != type_name:
                    continue
                ass_questions = [q for q in questions if q.assessment_id == assessment.id]
                ass_clos = {}
                for q in ass_questions:
                    clo_code = f"CLO-{q.clo.order_number}"
                    if clo_code not in ass_clos:
                        ass_clos[clo_code] = 0
                    ass_clos[clo_code] += q.marks
                clo_list = []
                for clo_code, total in ass_clos.items():
                    clo_list.append({"clo": clo_code, "total": total})
                type_assessments.append({
                    "id": str(assessment.id),
                    "title": assessment.title,
                    "clos": clo_list
                })
            if type_assessments:
                # Collect all unique CLOs for this type
                type_clos = []
                seen = set()
                for ass in type_assessments:
                    for c in ass["clos"]:
                        if c["clo"] not in seen:
                            seen.add(c["clo"])
                            type_clos.append(c["clo"])
                type_clos.sort()
                formatted_assessments.append({
                    "type": type_name,
                    "assessments": type_assessments,
                    "clos": type_clos
                })

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
            "type_groups": formatted_assessments,
            "class_clo_attainment": class_clo_attainment,
            "all_clos": all_clos,
            "course": {
                "code": course.code if course else "",
                "name": course.name if course else ""
            },
            "semester": {
                "number": semester.number if semester else ""
            }
        }
