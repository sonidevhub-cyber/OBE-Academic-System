from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction, IntegrityError
from .models import Department, Semester, Course
from .serializers import DepartmentSerializer, SemesterSerializer, CourseSerializer
from .permissions import AllowAnyReadOnly
import logging
import re
from register.access_control import can_access_department, get_user_assigned_department_id, is_department_scoped_admin
from rbac.services import user_has_permission

logger = logging.getLogger(__name__)


def _build_unique_semester_code(department_code: str, semester_number: int) -> str:
    """
    Build a Semester.semester_code that always fits max_length=10 and stays unique.
    """
    base = re.sub(r'[^A-Z0-9]', '', (department_code or '').upper()) or 'DEPT'
    suffix = f"S{semester_number}"

    max_base_len = max(1, 10 - len(suffix))
    candidate = f"{base[:max_base_len]}{suffix}"

    if not Semester.objects.filter(semester_code=candidate).exists():
        return candidate

    counter = 1
    while True:
        tail = f"{semester_number}{counter}"
        max_base_len = max(1, 10 - len(tail))
        candidate = f"{base[:max_base_len]}{tail}"
        if not Semester.objects.filter(semester_code=candidate).exists():
            return candidate
        counter += 1


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Department.objects.all()
        if is_department_scoped_admin(self.request.user):
            assigned_department_id = get_user_assigned_department_id(self.request.user)
            queryset = queryset.filter(department_id=assigned_department_id)
        return queryset

    def create(self, request, *args, **kwargs):
        """Override create to handle errors properly"""
        if not user_has_permission(request.user, 'manage_departments'):
            return Response({'error': 'Forbidden', 'required_permission': 'manage_departments'}, status=status.HTTP_403_FORBIDDEN)
        if is_department_scoped_admin(request.user):
            return Response({'error': 'Forbidden: Department admins cannot create departments.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            with transaction.atomic():
                serializer = self.get_serializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                
                department = serializer.save()
                
                # Auto-generate semesters based on num_semesters
                for i in range(1, department.num_semesters + 1):
                    semester_name = f"Semester {i}"
                    # Avoid duplicate semester rows for same department + semester name
                    if not Semester.objects.filter(department=department, name=semester_name).exists():
                        semester_code = _build_unique_semester_code(department.code, i)
                        Semester.objects.create(
                            name=semester_name,
                            semester_code=semester_code,
                            program=department.name,
                            capacity=30,
                            department=department
                        )
                
                headers = self.get_success_headers(serializer.data)
                return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
                
        except IntegrityError as e:
            logger.error(f"Database integrity error creating department: {str(e)}")
            return Response(
                {'error': 'Department with this name or code already exists.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error creating department: {str(e)}")
            return Response(
                {'error': f'Failed to create department: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def update(self, request, *args, **kwargs):
        if not user_has_permission(request.user, 'manage_departments'):
            return Response({'error': 'Forbidden', 'required_permission': 'manage_departments'}, status=status.HTTP_403_FORBIDDEN)
        if is_department_scoped_admin(request.user):
            return Response({'error': 'Forbidden: Department admins cannot update departments.'}, status=status.HTTP_403_FORBIDDEN)
        instance = self.get_object()
        prev_num = instance.num_semesters
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        try:
            with transaction.atomic():
                department = serializer.save()
                new_num = department.num_semesters

                if new_num > prev_num:
                    for i in range(prev_num + 1, new_num + 1):
                        semester_name = f"Semester {i}"
                        if not Semester.objects.filter(department=department, name=semester_name).exists():
                            semester_code = _build_unique_semester_code(department.code, i)
                            Semester.objects.create(
                                name=semester_name,
                                semester_code=semester_code,
                                program=department.name,
                                capacity=30,
                                department=department
                            )
                elif new_num < prev_num:
                    semesters = Semester.objects.filter(department=department)
                    for sem in semesters:
                        match = re.search(r"(\\d+)$", sem.name or "")
                        sem_num = int(match.group(1)) if match else None
                        if sem_num and sem_num > new_num:
                            if Course.objects.filter(semester=sem).exists():
                                return Response(
                                    {'error': f'Cannot reduce semesters. {sem.name} has courses.'},
                                    status=status.HTTP_400_BAD_REQUEST
                                )
                            sem.delete()

                return Response(serializer.data, status=status.HTTP_200_OK)
        except IntegrityError as e:
            logger.error(f"Database integrity error updating department: {str(e)}")
            return Response(
                {'error': 'Department with this name or code already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error updating department: {str(e)}")
            return Response(
                {'error': f'Failed to update department: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def semesters(self, request, pk=None):
        department = self.get_object()
        semesters = Semester.objects.filter(department=department)
        serializer = SemesterSerializer(semesters, many=True)
        return Response(serializer.data)


class SemesterViewSet(viewsets.ModelViewSet):
    queryset = Semester.objects.all()
    serializer_class = SemesterSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = Semester.objects.all()
        department = self.request.query_params.get('department', None)
        user = self.request.user
        # If coordinator/HOD, restrict to their department unless explicit filter overrides
        if not department:
            if hasattr(user, 'coordinator_profile') and user.coordinator_profile and user.coordinator_profile.department:
                department = user.coordinator_profile.department_id
            elif hasattr(user, 'hod_profile') and user.hod_profile and user.hod_profile.department:
                department = user.hod_profile.department_id
        if department is not None:
            queryset = queryset.filter(department=department)
        if is_department_scoped_admin(self.request.user):
            assigned_department_id = get_user_assigned_department_id(self.request.user)
            queryset = queryset.filter(department_id=assigned_department_id)
        return queryset

    def create(self, request, *args, **kwargs):
        if not user_has_permission(request.user, 'manage_departments'):
            return Response({'error': 'Forbidden', 'required_permission': 'manage_departments'}, status=status.HTTP_403_FORBIDDEN)
        department_id = request.data.get('department')
        if not can_access_department(request.user, department_id):
            return Response({'error': 'Forbidden: You can only manage semesters in your assigned department.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not user_has_permission(request.user, 'manage_departments'):
            return Response({'error': 'Forbidden', 'required_permission': 'manage_departments'}, status=status.HTTP_403_FORBIDDEN)
        instance = self.get_object()
        target_department_id = request.data.get('department', instance.department_id)
        if not can_access_department(request.user, instance.department_id) or not can_access_department(request.user, target_department_id):
            return Response({'error': 'Forbidden: You can only manage semesters in your assigned department.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Course.objects.select_related('semester', 'semester__department').all()
        semester_id = self.request.query_params.get('semester')
        department_id = self.request.query_params.get('department')
        if semester_id is not None:
            queryset = queryset.filter(semester_id=semester_id)
        if department_id is not None:
            queryset = queryset.filter(semester__department_id=department_id)
        if is_department_scoped_admin(self.request.user):
            assigned_department_id = get_user_assigned_department_id(self.request.user)
            queryset = queryset.filter(semester__department_id=assigned_department_id)
        return queryset

    def _resolve_target_department_id(self, data, instance=None):
        semester_id = data.get('semester')
        department_id = data.get('department_id')

        if department_id:
            return int(department_id)

        if semester_id:
            try:
                semester = Semester.objects.get(semester_id=semester_id)
                return int(semester.department_id)
            except Exception:
                return None

        if instance and instance.semester_id:
            return int(instance.semester.department_id)

        return None

    def create(self, request, *args, **kwargs):
        if not user_has_permission(request.user, 'manage_courses'):
            return Response({'error': 'Forbidden', 'required_permission': 'manage_courses'}, status=status.HTTP_403_FORBIDDEN)
        target_department_id = self._resolve_target_department_id(request.data)
        if not can_access_department(request.user, target_department_id):
            return Response({'error': 'Forbidden: You can only manage courses in your assigned department.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not user_has_permission(request.user, 'manage_courses'):
            return Response({'error': 'Forbidden', 'required_permission': 'manage_courses'}, status=status.HTTP_403_FORBIDDEN)
        instance = self.get_object()
        target_department_id = self._resolve_target_department_id(request.data, instance=instance)
        current_department_id = instance.semester.department_id if instance.semester else None
        if not can_access_department(request.user, current_department_id) or not can_access_department(request.user, target_department_id):
            return Response({'error': 'Forbidden: You can only manage courses in your assigned department.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not user_has_permission(request.user, 'manage_courses'):
            return Response({'error': 'Forbidden', 'required_permission': 'manage_courses'}, status=status.HTTP_403_FORBIDDEN)
        instance = self.get_object()
        current_department_id = instance.semester.department_id if instance.semester else None
        if not can_access_department(request.user, current_department_id):
            return Response({'error': 'Forbidden: You can only manage courses in your assigned department.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)
