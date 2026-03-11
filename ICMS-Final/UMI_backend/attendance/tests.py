from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from datetime import date
from .models import StudentAttendance, FacultyAttendance, AttendanceEditRequest
from students.models import Student
from instructors.models import Instructor
from academics.models import Course, Semester, Department, Timetable

User = get_user_model()

class AttendanceModelTest(TestCase):
    def setUp(self):
        # Create test data
        self.department = Department.objects.create(name="Computer Science", code="CS")
        self.semester = Semester.objects.create(name="Semester 1", department=self.department)
        self.course = Course.objects.create(name="Programming", code="CS101", semester=self.semester)
        
        self.instructor_user = User.objects.create_user(
            username="instructor1",
            email="instructor@test.com",
            role="instructor"
        )
        self.instructor = Instructor.objects.create(
            user=self.instructor_user,
            name="Test Instructor",
            department=self.department
        )
        
        self.student_user = User.objects.create_user(
            username="student1",
            email="student@test.com",
            role="student"
        )
        self.student = Student.objects.create(
            user=self.student_user,
            name="Test Student",
            student_id="CS001",
            semester=self.semester
        )
        
        self.timetable = Timetable.objects.create(
            course=self.course,
            instructor=self.instructor,
            day="monday",
            start_time="09:00",
            end_time="10:00",
            room="Room 101",
            approval_status="approved"
        )

    def test_student_attendance_creation(self):
        attendance = StudentAttendance.objects.create(
            student=self.student,
            course=self.course,
            instructor=self.instructor,
            timetable=self.timetable,
            date=date.today(),
            status='Present'
        )
        self.assertEqual(attendance.status, 'Present')
        self.assertFalse(attendance.is_locked)

    def test_faculty_attendance_creation(self):
        attendance = FacultyAttendance.objects.create(
            instructor=self.instructor,
            date=date.today(),
            status='Present'
        )
        self.assertEqual(attendance.get_faculty_name(), "Test Instructor")
        self.assertEqual(attendance.get_faculty_type(), "Instructor")

class AttendanceAPITest(APITestCase):
    def setUp(self):
        # Create test data similar to model test
        self.department = Department.objects.create(name="Computer Science", code="CS")
        self.semester = Semester.objects.create(name="Semester 1", department=self.department)
        self.course = Course.objects.create(name="Programming", code="CS101", semester=self.semester)
        
        self.instructor_user = User.objects.create_user(
            username="instructor1",
            email="instructor@test.com",
            role="instructor"
        )
        self.instructor = Instructor.objects.create(
            user=self.instructor_user,
            name="Test Instructor",
            department=self.department
        )
        
        self.student_user = User.objects.create_user(
            username="student1",
            email="student@test.com",
            role="student"
        )
        self.student = Student.objects.create(
            user=self.student_user,
            name="Test Student",
            student_id="CS001",
            semester=self.semester
        )
        
        self.timetable = Timetable.objects.create(
            course=self.course,
            instructor=self.instructor,
            day="monday",
            start_time="09:00",
            end_time="10:00",
            room="Room 101",
            approval_status="approved"
        )

    def test_instructor_can_mark_attendance(self):
        self.client.force_authenticate(user=self.instructor_user)
        
        data = {
            'timetable_id': self.timetable.timetable_id,
            'date': str(date.today()),
            'attendance_data': [
                {
                    'student_id': self.student.student_id,
                    'status': 'Present'
                }
            ]
        }
        
        response = self.client.post('/api/attendance/api/mark-class-attendance/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check if attendance was created
        attendance = StudentAttendance.objects.filter(
            student=self.student,
            timetable=self.timetable,
            date=date.today()
        ).first()
        self.assertIsNotNone(attendance)
        self.assertEqual(attendance.status, 'Present')

    def test_faculty_can_mark_self_attendance(self):
        self.client.force_authenticate(user=self.instructor_user)
        
        data = {
            'date': str(date.today()),
            'status': 'Present'
        }
        
        response = self.client.post('/api/attendance/api/mark-self-attendance/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check if faculty attendance was created
        attendance = FacultyAttendance.objects.filter(
            instructor=self.instructor,
            date=date.today()
        ).first()
        self.assertIsNotNone(attendance)
        self.assertEqual(attendance.status, 'Present')
        self.assertTrue(attendance.self_marked)

    def test_unauthorized_access_denied(self):
        # Test without authentication
        response = self.client.get('/api/attendance/api/instructor-classes/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        
        # Test with student user trying to mark attendance
        self.client.force_authenticate(user=self.student_user)
        response = self.client.post('/api/attendance/api/mark-class-attendance/', {})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)