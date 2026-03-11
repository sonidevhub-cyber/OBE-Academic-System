from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from .models import Department

User = get_user_model()

class DepartmentAPITestCase(APITestCase):
    def setUp(self):
        # Create test users
        self.admin_user = User.objects.create_user(
            username='admin',
            password='adminpass',
            role='admin'
        )
        self.student_user = User.objects.create_user(
            username='student',
            password='studentpass',
            role='student'
        )
        self.instructor_user = User.objects.create_user(
            username='instructor',
            password='instructorpass',
            role='instructor'
        )

        # Create a test department
        self.department = Department.objects.create(
            name='Computer Science',
            code='CS',
            description='CS Department'
        )

    def test_get_departments_list_unauthenticated(self):
        """Test that unauthenticated users can read departments"""
        url = reverse('department-list-create')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_get_departments_list_authenticated(self):
        """Test that authenticated users can read departments"""
        self.client.login(username='student', password='studentpass')
        url = reverse('department-list-create')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_department_admin(self):
        """Test that admin can create department"""
        self.client.login(username='admin', password='adminpass')
        url = reverse('department-list-create')
        data = {
            'name': 'Mathematics',
            'code': 'MATH',
            'description': 'Math Department'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Department.objects.count(), 2)

    def test_create_department_student_forbidden(self):
        """Test that student cannot create department"""
        self.client.login(username='student', password='studentpass')
        url = reverse('department-list-create')
        data = {
            'name': 'Physics',
            'code': 'PHY',
            'description': 'Physics Department'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_department_instructor_forbidden(self):
        """Test that instructor cannot create department"""
        self.client.login(username='instructor', password='instructorpass')
        url = reverse('department-list-create')
        data = {
            'name': 'Chemistry',
            'code': 'CHEM',
            'description': 'Chemistry Department'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_department_admin(self):
        """Test that admin can update department"""
        self.client.login(username='admin', password='adminpass')
        url = reverse('department-detail', kwargs={'pk': self.department.pk})
        data = {
            'name': 'Updated Computer Science',
            'code': 'CS',
            'description': 'Updated CS Department'
        }
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.department.refresh_from_db()
        self.assertEqual(self.department.name, 'Updated Computer Science')

    def test_update_department_student_forbidden(self):
        """Test that student cannot update department"""
        self.client.login(username='student', password='studentpass')
        url = reverse('department-detail', kwargs={'pk': self.department.pk})
        data = {
            'name': 'Hacked Computer Science',
            'code': 'CS',
            'description': 'Hacked CS Department'
        }
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_department_admin(self):
        """Test that admin can delete department"""
        self.client.login(username='admin', password='adminpass')
        url = reverse('department-detail', kwargs={'pk': self.department.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Department.objects.count(), 0)

    def test_delete_department_student_forbidden(self):
        """Test that student cannot delete department"""
        self.client.login(username='student', password='studentpass')
        url = reverse('department-detail', kwargs={'pk': self.department.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
