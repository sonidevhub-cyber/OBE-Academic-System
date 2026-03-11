from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Avg, Count, Q
from .models import Department, Semester, Course, Attendance, Result, Scholarship
from .serializers import (
    DepartmentSerializer,
    SemesterSerializer,
    CourseSerializer,
    AttendanceSerializer,
    ResultSerializer,
    ScholarshipSerializer,
)
from .permissions import IsAdminOrInstructorForResultsAttendance, IsAdminRoleOrReadOnly, AllowAnyReadOnly
from students.models import Student
from students.serializers import StudentSerializer


# 🎓 Student Results List & Create View
class StudentResultListCreateEnhanced(generics.ListCreateAPIView):
    serializer_class = ResultSerializer
    permission_classes = []  # Allow public access

    def get_queryset(self):
        queryset = Result.objects.filter(student_id=self.kwargs["student_id"])
        department_id = self.request.query_params.get("department_id")
        course_id = self.request.query_params.get("course_id")

        if department_id:
            queryset = queryset.filter(student__department_id=department_id)
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(student_id=self.kwargs["student_id"])

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        student_id = self.kwargs["student_id"]
        student = Student.objects.get(student_id=student_id)
        all_results = Result.objects.filter(student_id=student_id)
        cgpa_data = self.calculate_cgpa(all_results)
        promotion_data = self.check_promotion_logic(student, all_results)
        assigned_courses = student.courses.all()

        response_data = {
            "student": StudentSerializer(student).data,
            "results": serializer.data,
            "assigned_courses": CourseSerializer(assigned_courses, many=True).data,
            "cgpa": cgpa_data,
            "promotion_status": promotion_data,
        }
        return Response(response_data)

    def calculate_cgpa(self, results):
        if not results:
            return {"cgpa": 0.0, "total_credits": 0, "grade_points": 0}
        total_grade_points = 0
        total_credits = 0
        for result in results:
            credits = getattr(result, "course_credits", 3)
            grade_points = self.grade_to_points(result.grade)
            total_grade_points += grade_points * credits
            total_credits += credits
        cgpa = total_grade_points / total_credits if total_credits > 0 else 0
        return {"cgpa": round(cgpa, 2), "total_credits": total_credits, "grade_points": total_grade_points}

    def grade_to_points(self, grade):
        grade_map = {
            "A+": 4.0, "A": 4.0, "A-": 3.7,
            "B+": 3.3, "B": 3.0, "B-": 2.7,
            "C+": 2.3, "C": 2.0, "C-": 1.7,
            "D+": 1.3, "D": 1.0,
            "F": 0.0,
        }
        return grade_map.get(grade.upper(), 0.0)

    def check_promotion_logic(self, student, results):
        """Promotion/Dropping logic (without fee system)"""
        final_results = results.filter(exam_type__icontains="final")
        if not final_results:
            return {"status": "pending", "message": "No final results available"}

        failed_count = 0
        for result in final_results.order_by("-exam_date"):
            if result.grade.upper() == "F":
                failed_count += 1
                if failed_count >= 3:
                    return {
                        "status": "dropped",
                        "message": "Student dropped due to 3 consecutive failures",
                        "action": "drop_student",
                    }
            else:
                failed_count = 0

        # Promotion logic
        current_semester = student.semester
        if current_semester:
            try:
                current_num = int(current_semester.name.split()[-1])
                next_semester = Semester.objects.filter(
                    department=student.department,
                    name=f"Semester {current_num + 1}",
                ).first()
                if next_semester:
                    return {
                        "status": "promote",
                        "message": f"Promote to {next_semester.name}",
                        "next_semester_id": next_semester.semester_id,
                        "action": "promote_student",
                    }
            except (ValueError, TypeError):
                pass
        return {"status": "current", "message": "Student remains in current semester"}


# 🏛 Department → Courses List
class DepartmentCoursesView(APIView):
    permission_classes = []  # Allow public access

    def get(self, request, department_id):
        try:
            courses = Course.objects.filter(semester__department_id=department_id).select_related("semester")
            data = [
                {
                    "id": c.course_id,
                    "name": c.name,
                    "code": c.code,
                    "description": c.description,
                    "credits": c.credits,
                    "semester": c.semester.name if c.semester else "N/A",
                }
                for c in courses
            ]
            return Response(data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# 📊 Department Course Results View
class DepartmentCourseResultsView(APIView):
    permission_classes = []  # Allow public access

    def get(self, request, department_id, course_id):
        try:
            results = Result.objects.filter(
                student__department_id=department_id, course_id=course_id
            ).select_related("student", "course", "student_department", "student_semester")

            results_data = [
                {
                    "id": r.result_id,
                    "student_id": r.student.student_id,
                    "student_name": r.student.name,
                    "subject": r.course.name if r.course else "N/A",
                    "grade": r.grade,
                    "marks": f"{r.obtained_marks}/{r.total_marks}",
                    "percentage": r.percentage,
                    "semester": r.student.semester.name if r.student.semester else "N/A",
                    "department": r.student.department.name if r.student.department else "N/A",
                    "course": {
                        "id": r.course.course_id if r.course else None,
                        "name": r.course.name if r.course else "N/A",
                        "code": r.course.code if r.course else "N/A",
                    }
                    if r.course
                    else None,
                }
                for r in results
            ]
            return Response(results_data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# 🚀 Student Promotion View
class StudentPromotionActionView(APIView):
    permission_classes = []  # Allow public access

    def post(self, request, student_id):
        try:
            student = Student.objects.get(student_id=student_id)
            action = request.data.get("action")

            if action == "promote_student":
                next_semester_id = request.data.get("next_semester_id")
                if next_semester_id:
                    next_semester = Semester.objects.get(semester_id=next_semester_id)
                    student.semester = next_semester
                    student.save()
                    return Response(
                        {
                            "message": f"Student promoted to {next_semester.name}",
                            "student_id": student_id,
                            "new_semester": next_semester.name,
                        }
                    )

            elif action == "drop_student":
                student.performance_notes = (
                    f"Dropped due to consecutive failures - {request.data.get('reason', '')}"
                )
                student.save()
                return Response(
                    {"message": "Student dropped from program", "student_id": student_id, "status": "dropped"}
                )

            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
class DepartmentSemestersView(APIView):
    def get(self, request, department_id):
        semesters = Semester.objects.filter(department_id=department_id)
        serializer = SemesterSerializer(semesters, many=True)
        return Response(serializer.data)

    def post(self, request, department_id):
        """
        Create a new semester under the given department
        """
        data = request.data.copy()
        data["department"] = department_id  # auto attach department

        serializer = SemesterSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)