from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from .models import HOD, HODRegistrationRequest
from academics.models import Department

User = get_user_model()

class HODModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='hod_test',
            email='hod@test.com',
            password='testpass123',
            role='hod'
        )
        self.department = Department.objects.create(
            name='Computer Science',
            code='CS',
            num_semesters=8
        )

    def test_hod_creation(self):
        hod = HOD.objects.create(
            user=self.user,
            name='Test HOD',
            email='hod@test.com',
            phone='1234567890',
            department=self.department,
            specialization='AI/ML',
            experience_years=5
        )
        self.assertEqual(hod.name, 'Test HOD')
        self.assertEqual(hod.department, self.department)
        self.assertTrue(hod.is_active)

class HODRegistrationRequestTest(TestCase):
    def setUp(self):
        self.department = Department.objects.create(
            name='Computer Science',
            code='CS',
            num_semesters=8
        )

    def test_hod_registration_request_creation(self):
        request = HODRegistrationRequest.objects.create(
            name='Test HOD',
            email='hod@test.com',
            employee_id='HOD001',
            phone='1234567890',
            department=self.department,
            specialization='AI/ML',
            password='testpass123'
        )
        self.assertEqual(request.status, 'pending')
        self.assertEqual(request.hod_request_status, 'pending_approval')

class HODAPITest(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@test.com',
            password='adminpass123',
            role='admin'
        )
        self.department = Department.objects.create(
            name='Computer Science',
            code='CS',
            num_semesters=8
        )

    def test_hod_registration_request_creation(self):
        data = {
            'name': 'Test HOD',
            'email': 'hod@test.com',
            'employee_id': 'HOD001',
            'phone': '1234567890',
            'department_id': self.department.department_id,
            'specialization': 'AI/ML',
            'designation': 'HOD',
            'experience_years': 5,
            'password': 'testpass123',
            'confirm_password': 'testpass123'
        }
        response = self.client.post('/api/hods/registration/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_admin_can_view_hod_requests(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/hods/admin/requests/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)