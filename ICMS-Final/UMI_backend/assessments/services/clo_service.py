from decimal import Decimal
from assessments.models import Assessment, Question, StudentQuestionMark, CLOAttainment
from students.models import Student
from obe.models import CLO


class CLOService:

    @staticmethod
    def generate_student_report(course_id, batch_id, semester_id):

        # ============================
        # ✅ STUDENTS
        # ============================
        students = list(Student.objects.filter(batch_id=batch_id))

        # ============================
        # ✅ FINALIZED ASSESSMENTS
        # ============================
        assessments = list(Assessment.objects.filter(
            course_id=course_id,
            batch_id=batch_id,
            semester_id=semester_id,
            is_finalized=True
        ))

        if not assessments:
            return {"error": "No finalized assessments found"}

        # ============================
        # ✅ CLOs
        # ============================
        clos = list(CLO.objects.filter(course_id=course_id))

        # ============================
        # 🔥 ALL QUESTIONS
        # ============================
        questions = list(
            Question.objects.filter(assessment__in=assessments)
            .select_related('assessment', 'clo')
        )

        # ============================
        # 🔥 ALL MARKS (OPTIMIZED)
        # ============================
        all_marks = list(
            StudentQuestionMark.objects.filter(
                student__batch_id=batch_id,
                question__in=questions
            ).select_related('student', 'question', 'question__clo')
        )

        # ============================
        # 🔥 FAST LOOKUP MAP
        # ============================
        marks_map = {
            (m.student_id, m.question_id): m.marks_obtained
            for m in all_marks
        }

        report = []

        # ============================
        # 🔥 CLASS TRACKING
        # ============================
        class_clo_obtained = {f"CLO-{clo.order_number}": Decimal('0') for clo in clos}
        class_clo_total = {f"CLO-{clo.order_number}": Decimal('0') for clo in clos}

        # ============================
        # 🚀 STUDENT LOOP
        # ============================
        for student in students:

            row = {
                "name": student.name,
                "quiz": {},
                "assignment": {},
                "midterm": {},
                "final": {},
                "presentation": {},
                "clo_attainment": {}
            }

            obtained_marks = Decimal('0')
            total_marks = Decimal('0')

            for assessment in assessments:

                assessment_questions = [q for q in questions if q.assessment_id == assessment.id]

                assessment_total = sum(q.marks for q in assessment_questions)
                student_total = sum(
                    marks_map.get((student.pk, q.id), 0)
                    for q in assessment_questions
                )

                obtained_marks += Decimal(student_total)
                total_marks += Decimal(assessment_total)

                # 🔥 CLO breakdown
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

                    if clo_total > 0:

                        # TYPE WISE
                        if assessment.assessment_type == "quiz":
                            row["quiz"].setdefault(clo_code, 0)
                            row["quiz"][clo_code] += float(clo_obtained)

                        elif assessment.assessment_type == "assignment":
                            row["assignment"].setdefault(clo_code, 0)
                            row["assignment"][clo_code] += float(clo_obtained)

                        elif assessment.assessment_type == "midterm":
                            row["midterm"].setdefault(clo_code, 0)
                            row["midterm"][clo_code] += float(clo_obtained)

                        elif assessment.assessment_type == "final":
                            row["final"].setdefault(clo_code, 0)
                            row["final"][clo_code] += float(clo_obtained)

                        elif assessment.assessment_type == "presentation":
                            row["presentation"].setdefault(clo_code, 0)
                            row["presentation"][clo_code] += float(clo_obtained)

                        # 🔥 CLASS AGGREGATION
                        class_clo_obtained[clo_code] += Decimal(clo_obtained)
                        class_clo_total[clo_code] += Decimal(clo_total)

            # ============================
            # 🎯 STUDENT CLO %
            # ============================
            for clo in clos:

                clo_code = f"CLO-{clo.order_number}"

                clo_total = class_clo_total[clo_code]
                clo_obtained = class_clo_obtained[clo_code]

                if clo_total > 0:
                    percent = (clo_obtained / clo_total) * 100
                else:
                    percent = Decimal('0')

                kpi = getattr(clo, "kpi_target", 60)

                row["clo_attainment"][clo_code] = {
                    "percentage": float(round(percent, 2)),
                    "status": "Achieved" if percent >= kpi else "Not Achieved"
                }

            # ============================
            # 📊 FINAL RESULT
            # ============================
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

        # ============================
        # 🏫 CLASS CLO + SAVE
        # ============================
        class_clo_attainment = {}

        for clo in clos:

            clo_code = f"CLO-{clo.order_number}"

            total = class_clo_total[clo_code]
            obtained = class_clo_obtained[clo_code]

            avg = (obtained / total) * 100 if total > 0 else Decimal('0')

            kpi = getattr(clo, "kpi_target", 60)
            is_achieved = avg >= kpi

            # 🔥 SAVE
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
                "status": "Achieved" if is_achieved else "Not Achieved"
            }

        return {
            "students": report,
            "class_clo_attainment": class_clo_attainment
        }