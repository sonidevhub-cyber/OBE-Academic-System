from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from students.models import Student
from academics.models import Department, Semester, Course

class StudentCourseAssignmentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Create a department
        self.department = Department.objects.create(name="Computer Science", code="CS")
        # Create semesters
        self.semester1 = Semester.objects.create(name="Semester 1", semester_code="S1", program="BCS", department=self.department)
        self.semester2 = Semester.objects.create(name="Semester 2", semester_code="S2", program="BCS", department=self.department)
        # Create courses for semesters
        self.course1 = Course.objects.create(name="Intro to CS", code="CS101", credits=3, semester=self.semester1)
        self.course2 = Course.objects.create(name="Data Structures", code="CS102", credits=4, semester=self.semester1)
        self.course3 = Course.objects.create(name="Algorithms", code="CS201", credits=4, semester=self.semester2)

    def test_create_student_assigns_courses(self):
        data = {
            "name": "John Doe",
            "email": "john@example.com",
            "department_id": self.department.id,
            "semester_id": self.semester1.id,
        }
        response = self.client.post("/students/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        student_id = response.data["student_id"]
        student = Student.objects.get(student_id=student_id)
        assigned_courses = student.courses.all()
        self.assertEqual(assigned_courses.count(), 2)
        self.assertIn(self.course1, assigned_courses)
        self.assertIn(self.course2, assigned_courses)

    def test_update_student_semester_reassigns_courses(self):
        student = Student.objects.create(
            name="Jane Doe",
            email="jane@example.com",
            department=self.department,
            semester=self.semester1,
        )
        student.courses.set([self.course1, self.course2])
        data = {
            "semester_id": self.semester2.id,
        }
        response = self.client.patch(f"/students/{student.student_id}/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        student.refresh_from_db()
        assigned_courses = student.courses.all()
        self.assertEqual(assigned_courses.count(), 1)
        self.assertIn(self.course3, assigned_courses)

    def test_student_without_semester_no_courses_assigned(self):
        student = Student.objects.create(
            name="No Semester",
            email="nosem@example.com",
            department=self.department,
            semester=None,
        )
        student.courses.clear()
        # Update student without semester change
        data = {
            "name": "No Semester Updated",
        }
        response = self.client.patch(f"/students/{student.student_id}/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        student.refresh_from_db()
        self.assertEqual(student.courses.count(), 0)
