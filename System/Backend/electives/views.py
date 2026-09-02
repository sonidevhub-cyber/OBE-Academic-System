import uuid
from django.db import transaction
from django.db.models import Count, Prefetch, Q
from django.utils import timezone
from rest_framework import generics, status, permissions, views
from rest_framework.response import Response
from rest_framework.permissions import BasePermission

from core.models.course import Course
from core.models import Batch, Semester
from students.models import Student
from .models import (
    SelectiveGroup,
    EligibilityRule,
    ElectiveGroup,
    ElectiveSelectionWindow,
    StudentElectiveEnrollment,
)
from .serializers import (
    SelectiveGroupSerializer,
    SelectiveGroupCreateSerializer,
    EligibilityRuleSerializer,
    ElectiveGroupSerializer,
    ElectiveGroupCreateSerializer,
    ElectiveSelectionWindowSerializer,
    StudentElectiveEnrollmentSerializer,
    ElectiveCourseOptionSerializer,
    SACAssignSerializer,
)


class IsSACOrCoordinator(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = getattr(request.user, 'role', '')
        secondary = getattr(request.user, 'secondary_role', '')
        return (
            role in ('SAC', 'coordinator', 'hod', 'admin', 'director', 'instructor')
            or secondary in ('coordinator', 'hod', 'SAC')
        )


class IsStudent(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return getattr(request.user, 'role', '') == 'student'


def _resolve_curriculum_version_for_batch(batch):
    if batch.curriculum_version_id:
        return batch.curriculum_version
    from curriculum.models import CurriculumVersion, CurriculumVersionCourse
    cv_ids = CurriculumVersionCourse.objects.filter(
        course__program=batch.program,
        is_active=True,
    ).values_list('version_id', flat=True).distinct()
    cv = CurriculumVersion.objects.filter(
        id__in=list(cv_ids),
        program=batch.program,
        is_active=True,
    ).order_by('-created_at').first()
    return cv


def _check_student_eligible_for_course(student, course, selective_group):
    group_rules = EligibilityRule.objects.filter(
        selective_group=selective_group,
        is_active=True,
    )
    if not group_rules.exists():
        return True
    course_rules = group_rules.filter(course=course)
    if not course_rules.exists():
        return True
    for rule in course_rules:
        field = rule.student_attribute_field
        expected = rule.student_attribute_value
        actual = None
        if hasattr(student, field):
            actual = getattr(student, field)
        elif hasattr(student, 'user') and student.user and hasattr(student.user, field):
            actual = getattr(student.user, field)
        if actual is not None and str(actual) == str(expected):
            return True
    return False


def _get_active_batch_students(batch):
    return Student.objects.filter(
        Q(batch=batch) | Q(original_batch=batch),
        is_frozen=False,
        user__is_active=True,
    ).select_related('user').distinct()


class SelectiveGroupListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsSACOrCoordinator]

    def get_serializer_class(self):
        return SelectiveGroupCreateSerializer if self.request.method == 'POST' else SelectiveGroupSerializer

    def get_queryset(self):
        qs = SelectiveGroup.objects.filter(is_active=True).annotate(
            course_count=Count('courses', filter=Q(courses__is_active=True))
        ).select_related('curriculum_version', 'semester')
        curriculum_version_id = self.request.query_params.get('curriculum_version_id')
        semester_id = self.request.query_params.get('semester_id')
        semester_no = self.request.query_params.get('semester_no')
        if curriculum_version_id:
            qs = qs.filter(curriculum_version_id=curriculum_version_id)
        if semester_id:
            qs = qs.filter(semester_id=semester_id)
        if semester_no:
            qs = qs.filter(semester__number=int(semester_no))
        return qs


class SelectiveGroupDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated, IsSACOrCoordinator]
    serializer_class = SelectiveGroupSerializer
    queryset = SelectiveGroup.objects.filter(is_active=True).annotate(
        course_count=Count('courses', filter=Q(courses__is_active=True))
    ).select_related('curriculum_version', 'semester')

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data
        active_rules = EligibilityRule.objects.filter(
            selective_group=instance,
            is_active=True,
        ).select_related('course')
        data['eligibility_rules'] = EligibilityRuleSerializer(active_rules, many=True).data
        return Response(data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        allowed_fields = {'group_name'}
        filtered_data = {k: v for k, v in request.data.items() if k in allowed_fields}
        serializer = self.get_serializer(instance, data=filtered_data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    def perform_destroy(self, instance):
        with transaction.atomic():
            instance.is_active = False
            instance.save()
            EligibilityRule.objects.filter(
                selective_group=instance,
                is_active=True,
            ).update(is_active=False)


class EligibilityRuleCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsSACOrCoordinator]

    def post(self, request):
        selective_group_id = request.data.get('selective_group_id')
        course_id = request.data.get('course_id')
        student_attribute_field = request.data.get('student_attribute_field')
        student_attribute_value = request.data.get('student_attribute_value')

        if not all([selective_group_id, course_id, student_attribute_field, student_attribute_value]):
            return Response(
                {'error': 'selective_group_id, course_id, student_attribute_field, student_attribute_value are all required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            selective_group = SelectiveGroup.objects.get(id=selective_group_id, is_active=True)
        except SelectiveGroup.DoesNotExist:
            return Response({'error': 'SelectiveGroup not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            course = Course.objects.get(id=course_id, is_active=True)
        except Course.DoesNotExist:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)

        if course.offering_type != Course.OFFERING_SELECTIVE:
            return Response({'error': 'Course must be SELECTIVE offering type'}, status=status.HTTP_400_BAD_REQUEST)

        if course.selective_group_id != selective_group.id:
            return Response({'error': 'Course must belong to the same selective_group'}, status=status.HTTP_400_BAD_REQUEST)

        dup_rules = EligibilityRule.objects.filter(
            selective_group=selective_group,
            course=course,
            student_attribute_field=student_attribute_field,
            is_active=True,
        )
        if dup_rules.exists():
            return Response(
                {'error': f'Duplicate attribute_field "{student_attribute_field}" for course {course.code} in this selective group.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rule = EligibilityRule.objects.create(
            selective_group=selective_group,
            course=course,
            student_attribute_field=student_attribute_field,
            student_attribute_value=student_attribute_value,
        )
        return Response(EligibilityRuleSerializer(rule).data, status=status.HTTP_201_CREATED)

    def delete(self, request):
        pk = request.query_params.get('pk') or request.data.get('pk')
        if not pk:
            return Response({'error': 'pk query param is required for DELETE'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            rule = EligibilityRule.objects.get(id=pk, is_active=True)
        except EligibilityRule.DoesNotExist:
            return Response({'error': 'EligibilityRule not found'}, status=status.HTTP_404_NOT_FOUND)
        rule.is_active = False
        rule.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ElectiveCoursesView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        batch_id = request.query_params.get('batch')
        semester = request.query_params.get('semester')
        semester_id = request.query_params.get('semester_id')
        student_param = request.query_params.get('student')

        if not batch_id:
            return Response({'error': 'batch query param is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not semester and not semester_id:
            return Response({'error': 'semester or semester_id query param is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)

        sem = None
        if semester_id:
            try:
                sem = Semester.objects.get(id=semester_id, program=batch.program)
            except Semester.DoesNotExist:
                return Response({'error': 'Semester not found'}, status=status.HTTP_404_NOT_FOUND)
        elif semester:
            try:
                sem = Semester.objects.get(number=int(semester), program=batch.program)
            except (Semester.DoesNotExist, ValueError):
                return Response({'error': 'Semester not found'}, status=status.HTTP_404_NOT_FOUND)

        program = batch.program
        curriculum_version = _resolve_curriculum_version_for_batch(batch)

        courses_qs = Course.objects.filter(
            program=program,
            semester=sem,
            offering_type__in=[Course.OFFERING_ELECTIVE, Course.OFFERING_SELECTIVE],
            is_active=True,
        ).select_related('elective_group', 'selective_group', 'semester', 'program')

        window = ElectiveSelectionWindow.objects.filter(
            batch=batch,
            semester=sem,
            is_active=True,
        ).first()

        student = None
        if student_param:
            try:
                student = Student.objects.get(student_id=student_param)
            except Student.DoesNotExist:
                student = None
        if student is None and getattr(request.user, 'role', '') == 'student':
            try:
                student = Student.objects.get(user=request.user)
            except Student.DoesNotExist:
                pass

        selective_groups_map = {}
        elective_groups_map = {}
        open_electives = []

        for course in courses_qs:
            course_data = ElectiveCourseOptionSerializer(course).data

            if course.offering_type == Course.OFFERING_SELECTIVE and course.selective_group and course.selective_group.is_active:
                sg = course.selective_group
                sg_id = str(sg.id)
                if sg_id not in selective_groups_map:
                    selective_groups_map[sg_id] = {
                        'selective_group_id': sg_id,
                        'group_name': sg.group_name,
                        'required': True,
                        'courses': [],
                    }
                include_course = True
                if student is not None and sg.has_eligibility_rules:
                    include_course = _check_student_eligible_for_course(student, course, sg)
                if include_course:
                    selective_groups_map[sg_id]['courses'].append(course_data)

            elif course.offering_type == Course.OFFERING_ELECTIVE:
                if course.elective_group and course.elective_group.is_active:
                    eg = course.elective_group
                    eg_id = str(eg.id)
                    if eg_id not in elective_groups_map:
                        elective_groups_map[eg_id] = {
                            'elective_group_id': eg_id,
                            'group_name': eg.group_name,
                            'courses': [],
                        }
                    elective_groups_map[eg_id]['courses'].append(course_data)
                else:
                    open_electives.append(course_data)

        current_selections = []
        if student is not None:
            enrollments = StudentElectiveEnrollment.objects.filter(
                student=student,
                batch=batch,
                semester=sem,
                is_active=True,
            ).select_related('course')
            current_selections = [str(e.course_id) for e in enrollments]

        return Response({
            'batch_id': str(batch.id),
            'batch_custom_id': batch.custom_id,
            'semester_id': str(sem.id),
            'semester_number': sem.number,
            'window': ElectiveSelectionWindowSerializer(window).data if window else None,
            'selective_groups': list(selective_groups_map.values()),
            'elective_groups': list(elective_groups_map.values()),
            'open_electives': open_electives,
            'current_student_selections': current_selections,
        })


class StudentElectiveEnrollView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsStudent]

    @transaction.atomic
    def post(self, request):
        course_ids = request.data.get('course_ids') or []
        single_course_id = request.data.get('course_id')

        if single_course_id and not course_ids:
            course_ids = [single_course_id]

        if not course_ids:
            return Response(
                {'error': 'course_ids (list) or course_id (single) is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        batch_id = request.data.get('batch_id')
        semester_id = request.data.get('semester_id')
        semester_no = request.data.get('semester_no')

        if not batch_id:
            return Response({'error': 'batch_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)

        sem = None
        if semester_id:
            try:
                sem = Semester.objects.get(id=semester_id, program=batch.program)
            except Semester.DoesNotExist:
                return Response({'error': 'Semester not found'}, status=status.HTTP_404_NOT_FOUND)
        elif semester_no:
            try:
                sem = Semester.objects.get(number=int(semester_no), program=batch.program)
            except (Semester.DoesNotExist, ValueError):
                return Response({'error': 'Semester not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({'error': 'semester_id or semester_no is required'}, status=status.HTTP_400_BAD_REQUEST)

        window = ElectiveSelectionWindow.objects.filter(
            batch=batch,
            semester=sem,
            is_active=True,
        ).first()

        if not window or not window.is_open:
            return Response(
                {'error': 'Elective selection window is not open for this batch and semester.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            student = Student.objects.get(user=request.user)
        except Student.DoesNotExist:
            return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            StudentElectiveEnrollment.objects.filter(
                student=student,
                batch=batch,
                semester=sem,
                is_active=True,
                is_locked=False,
            ).update(is_active=False)

            created = []
            errors = []
            for cid in course_ids:
                try:
                    course = Course.objects.get(
                        id=cid,
                        program=batch.program,
                        semester=sem,
                        offering_type__in=[Course.OFFERING_ELECTIVE, Course.OFFERING_SELECTIVE],
                        is_active=True,
                    )
                except Course.DoesNotExist:
                    errors.append(f'Course {cid} is not a valid elective/selective for this batch/semester.')
                    continue

                try:
                    enrollment = StudentElectiveEnrollment(
                        student=student,
                        course=course,
                        semester=sem,
                        batch=batch,
                        enrolled_by=None,
                    )
                    enrollment.full_clean()
                    enrollment.save()
                    created.append(enrollment)
                except Exception as e:
                    errors.append(f'{course.code}: {str(e)}')

        if errors and not created:
            return Response({'errors': errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'created_count': len(created),
            'enrollments': StudentElectiveEnrollmentSerializer(created, many=True).data,
            'errors': errors,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST)


class MyElectiveEnrollmentsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def get(self, request):
        try:
            student = Student.objects.get(user=request.user)
        except Student.DoesNotExist:
            return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

        batch_id = request.query_params.get('batch_id')
        semester_no = request.query_params.get('semester_no')
        semester_id = request.query_params.get('semester_id')

        qs = StudentElectiveEnrollment.objects.filter(
            student=student,
            is_active=True,
        ).select_related(
            'course', 'course__elective_group', 'course__selective_group',
            'semester', 'batch', 'enrolled_by',
        )

        if batch_id:
            qs = qs.filter(batch_id=batch_id)
        if semester_id:
            qs = qs.filter(semester_id=semester_id)
        if semester_no and batch_id:
            try:
                batch = Batch.objects.get(id=batch_id)
                qs = qs.filter(semester__program=batch.program, semester__number=int(semester_no))
            except (Batch.DoesNotExist, ValueError):
                pass

        return Response(StudentElectiveEnrollmentSerializer(qs, many=True).data)


class ElectiveGroupListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsSACOrCoordinator]

    def get_serializer_class(self):
        return ElectiveGroupCreateSerializer if self.request.method == 'POST' else ElectiveGroupSerializer

    def get_queryset(self):
        qs = ElectiveGroup.objects.filter(is_active=True).annotate(
            course_count=Count('courses', filter=Q(courses__is_active=True))
        ).select_related('batch', 'semester')
        batch_id = self.request.query_params.get('batch_id')
        semester_id = self.request.query_params.get('semester_id')
        semester_no = self.request.query_params.get('semester_no')
        if batch_id:
            qs = qs.filter(batch_id=batch_id)
        if semester_id:
            qs = qs.filter(semester_id=semester_id)
        if semester_no and batch_id:
            try:
                batch = Batch.objects.get(id=batch_id)
                qs = qs.filter(semester__program=batch.program, semester__number=semester_no)
            except Batch.DoesNotExist:
                pass
        return qs


class ElectiveGroupDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated, IsSACOrCoordinator]
    serializer_class = ElectiveGroupSerializer
    queryset = ElectiveGroup.objects.filter(is_active=True).select_related('batch', 'semester')

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()


class SACElectiveEnrollmentsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsSACOrCoordinator]

    def get(self, request):
        batch_id = request.query_params.get('batch')
        semester = request.query_params.get('semester')
        semester_id = request.query_params.get('semester_id')

        if not batch_id:
            return Response({'error': 'batch query param is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)

        sem = None
        if semester_id:
            try:
                sem = Semester.objects.get(id=semester_id, program=batch.program)
            except Semester.DoesNotExist:
                return Response({'error': 'Semester not found'}, status=status.HTTP_404_NOT_FOUND)
        elif semester:
            try:
                sem = Semester.objects.get(number=int(semester), program=batch.program)
            except (Semester.DoesNotExist, ValueError):
                return Response({'error': 'Semester not found'}, status=status.HTTP_404_NOT_FOUND)

        curriculum_version = _resolve_curriculum_version_for_batch(batch)

        all_enrollments_qs = StudentElectiveEnrollment.objects.filter(
            batch=batch,
            is_active=True,
        )
        if sem:
            all_enrollments_qs = all_enrollments_qs.filter(semester=sem)
        all_enrollments_qs = all_enrollments_qs.select_related(
            'student', 'student__user', 'course', 'course__elective_group', 'course__selective_group',
            'semester', 'batch', 'locked_by', 'enrolled_by',
        )
        all_enrollments = StudentElectiveEnrollmentSerializer(all_enrollments_qs, many=True).data

        selective_group_enrollments = []
        if curriculum_version and sem:
            selective_groups = SelectiveGroup.objects.filter(
                curriculum_version=curriculum_version,
                semester=sem,
                is_active=True,
            ).prefetch_related('courses')

            all_batch_students = _get_active_batch_students(batch)
            student_list = list(all_batch_students)

            for sg in selective_groups:
                sg_enrollments_qs = all_enrollments_qs.filter(
                    course__selective_group=sg,
                )
                sg_enrollments = StudentElectiveEnrollmentSerializer(sg_enrollments_qs, many=True).data
                enrolled_student_ids = set(sg_enrollments_qs.values_list('student_id', flat=True))

                incomplete = []
                for stud in student_list:
                    if stud.student_id not in enrolled_student_ids:
                        incomplete.append({
                            'student_id': str(stud.student_id),
                            'custom_id': stud.custom_id,
                            'name': stud.name,
                            'registration_number': stud.registration_number,
                        })

                selective_group_enrollments.append({
                    'selective_group_id': str(sg.id),
                    'group_name': sg.group_name,
                    'enrollments': sg_enrollments,
                    'incomplete_students': incomplete,
                })

        elective_group_enrollments = []
        open_elective_enrollments = []
        for e in all_enrollments:
            if e.get('elective_group_id'):
                gid = str(e['elective_group_id'])
                found = False
                for eg in elective_group_enrollments:
                    if eg['elective_group_id'] == gid:
                        eg['enrollments'].append(e)
                        found = True
                        break
                if not found:
                    elective_group_enrollments.append({
                        'elective_group_id': gid,
                        'group_name': e['elective_group_name'],
                        'enrollments': [e],
                    })
            elif not e.get('selective_group_id'):
                open_elective_enrollments.append(e)

        incomplete_summary = {'total_students_in_batch': 0, 'students_missing_selective_picks': []}
        if curriculum_version and sem:
            all_batch_students = _get_active_batch_students(batch)
            student_list = list(all_batch_students)
            incomplete_summary['total_students_in_batch'] = len(student_list)

            selective_groups = list(SelectiveGroup.objects.filter(
                curriculum_version=curriculum_version,
                semester=sem,
                is_active=True,
            ))

            if selective_groups:
                for stud in student_list:
                    student_enrollments = all_enrollments_qs.filter(student_id=stud.student_id)
                    enrolled_sg_ids = set(student_enrollments.values_list('course__selective_group_id', flat=True))
                    enrolled_sg_ids.discard(None)

                    missing_groups = []
                    for sg in selective_groups:
                        if sg.id not in enrolled_sg_ids:
                            missing_groups.append({
                                'selective_group_id': str(sg.id),
                                'group_name': sg.group_name,
                            })
                    if missing_groups:
                        incomplete_summary['students_missing_selective_picks'].append({
                            'student_id': str(stud.student_id),
                            'custom_id': stud.custom_id,
                            'name': stud.name,
                            'missing_groups': missing_groups,
                        })

        window = ElectiveSelectionWindow.objects.filter(
            batch=batch,
            is_active=True,
        ).filter(semester=sem).first() if sem else ElectiveSelectionWindow.objects.filter(
            batch=batch, is_active=True
        ).first()

        return Response({
            'batch_id': str(batch.id),
            'batch_custom_id': batch.custom_id,
            'semester_id': str(sem.id) if sem else None,
            'semester_number': sem.number if sem else None,
            'window': ElectiveSelectionWindowSerializer(window).data if window else None,
            'selective_group_enrollments': selective_group_enrollments,
            'elective_group_enrollments': elective_group_enrollments,
            'open_elective_enrollments': open_elective_enrollments,
            'all_enrollments': all_enrollments,
            'incomplete_summary': incomplete_summary,
        })


class SACAssignView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsSACOrCoordinator]

    @transaction.atomic
    def post(self, request):
        action = request.data.get('action', 'add')
        if action not in ('add', 'remove'):
            return Response({'error': 'action must be "add" or "remove"'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = SACAssignSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        student = serializer.validated_data['student']
        course = serializer.validated_data['course']
        batch = serializer.validated_data['batch']
        sem = serializer.validated_data['semester']

        if action == 'remove':
            existing = StudentElectiveEnrollment.objects.filter(
                student=student,
                course=course,
                batch=batch,
                semester=sem,
                is_active=True,
            ).first()
            if not existing:
                return Response({'error': 'No active enrollment found for this student+course+batch+semester'}, status=status.HTTP_404_NOT_FOUND)
            if existing.is_locked:
                return Response({'error': 'Enrollment is locked and cannot be removed'}, status=status.HTTP_400_BAD_REQUEST)
            existing.is_active = False
            existing.save()
            return Response(StudentElectiveEnrollmentSerializer(existing).data)

        with transaction.atomic():
            if course.offering_type == Course.OFFERING_SELECTIVE and course.selective_group_id:
                StudentElectiveEnrollment.objects.filter(
                    student=student,
                    batch=batch,
                    semester=sem,
                    is_active=True,
                    is_locked=False,
                    course__selective_group_id=course.selective_group_id,
                ).update(is_active=False)

            try:
                enrollment = StudentElectiveEnrollment(
                    student=student,
                    course=course,
                    semester=sem,
                    batch=batch,
                    enrolled_by=request.user,
                )
                enrollment.full_clean()
                enrollment.save()
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(StudentElectiveEnrollmentSerializer(enrollment).data, status=status.HTTP_201_CREATED)


class ElectiveWindowOpenView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsSACOrCoordinator]

    @transaction.atomic
    def post(self, request):
        batch_id = request.data.get('batch_id')
        semester_id = request.data.get('semester_id')
        semester_no = request.data.get('semester_no')
        max_electives_allowed = int(request.data.get('max_electives_allowed', 1))

        if not batch_id:
            return Response({'error': 'batch_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)

        sem = None
        if semester_id:
            try:
                sem = Semester.objects.get(id=semester_id, program=batch.program)
            except Semester.DoesNotExist:
                return Response({'error': 'Semester not found'}, status=status.HTTP_404_NOT_FOUND)
        elif semester_no:
            try:
                sem = Semester.objects.get(number=int(semester_no), program=batch.program)
            except (Semester.DoesNotExist, ValueError):
                return Response({'error': 'Semester not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({'error': 'semester_id or semester_no is required'}, status=status.HTTP_400_BAD_REQUEST)

        window, _ = ElectiveSelectionWindow.objects.get_or_create(
            batch=batch,
            semester=sem,
            is_active=True,
            defaults={
                'is_open': False,
                'max_electives_allowed': max_electives_allowed,
            },
        )

        if window.is_open:
            return Response(
                {'error': 'Window is already open.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if window.closed_at is not None:
            return Response(
                {'error': 'Window was already locked and cannot be reopened.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        window.is_open = True
        window.opened_by = request.user
        window.opened_at = timezone.now()
        window.max_electives_allowed = max_electives_allowed
        window.save()

        return Response(ElectiveSelectionWindowSerializer(window).data, status=status.HTTP_200_OK)


class ElectiveWindowLockView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsSACOrCoordinator]

    @transaction.atomic
    def post(self, request):
        batch_id = request.data.get('batch_id')
        semester_id = request.data.get('semester_id')
        semester_no = request.data.get('semester_no')

        if not batch_id:
            return Response({'error': 'batch_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)

        sem = None
        if semester_id:
            try:
                sem = Semester.objects.get(id=semester_id, program=batch.program)
            except Semester.DoesNotExist:
                return Response({'error': 'Semester not found'}, status=status.HTTP_404_NOT_FOUND)
        elif semester_no:
            try:
                sem = Semester.objects.get(number=int(semester_no), program=batch.program)
            except (Semester.DoesNotExist, ValueError):
                return Response({'error': 'Semester not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({'error': 'semester_id or semester_no is required'}, status=status.HTTP_400_BAD_REQUEST)

        window = ElectiveSelectionWindow.objects.filter(
            batch=batch,
            semester=sem,
            is_active=True,
        ).first()

        if not window:
            return Response(
                {'error': 'No selection window exists for this batch/semester.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not window.is_open:
            return Response(
                {'error': 'Window is not open; cannot lock.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        curriculum_version = _resolve_curriculum_version_for_batch(batch)
        if curriculum_version and sem:
            selective_groups = list(SelectiveGroup.objects.filter(
                curriculum_version=curriculum_version,
                semester=sem,
                is_active=True,
            ))

            if selective_groups:
                all_batch_students = _get_active_batch_students(batch)
                student_list = list(all_batch_students)

                active_enrollments = StudentElectiveEnrollment.objects.filter(
                    batch=batch,
                    semester=sem,
                    is_active=True,
                )

                incomplete_picks = []
                for stud in student_list:
                    enrolled_sg_ids = set(
                        active_enrollments.filter(student_id=stud.student_id)
                        .values_list('course__selective_group_id', flat=True)
                    )
                    enrolled_sg_ids.discard(None)

                    missing_groups = []
                    for sg in selective_groups:
                        if sg.id not in enrolled_sg_ids:
                            missing_groups.append({
                                'selective_group_id': str(sg.id),
                                'group_name': sg.group_name,
                            })
                    if missing_groups:
                        incomplete_picks.append({
                            'student_id': str(stud.student_id),
                            'custom_id': stud.custom_id,
                            'name': stud.name,
                            'registration_number': stud.registration_number,
                            'missing_groups': missing_groups,
                        })

                if incomplete_picks:
                    return Response({
                        'error': 'Cannot lock: some students are missing required selective picks.',
                        'incomplete_picks': incomplete_picks,
                    }, status=status.HTTP_400_BAD_REQUEST)

        window.is_open = False
        window.closed_by = request.user
        window.closed_at = timezone.now()
        window.save()

        locked_count = StudentElectiveEnrollment.objects.filter(
            batch=batch,
            semester=sem,
            is_active=True,
            is_locked=False,
        ).update(
            is_locked=True,
            locked_by=request.user,
            locked_at=timezone.now(),
        )

        return Response({
            'window': ElectiveSelectionWindowSerializer(window).data,
            'locked_enrollments_count': locked_count,
        }, status=status.HTTP_200_OK)


class ElectiveOnlyWindowLockView(views.APIView):
    """
    Lock only elective (non-selective) enrollments for a batch/semester.

    Unlike the full window lock, this endpoint does NOT require all
    selective-group picks to be complete. It locks open electives and
    grouped electives independently, allowing the SAC to freeze elective
    selections even when some students are still missing required
    selective picks.
    """
    permission_classes = [permissions.IsAuthenticated, IsSACOrCoordinator]

    @transaction.atomic
    def post(self, request):
        batch_id = request.data.get('batch_id')
        semester_id = request.data.get('semester_id')
        semester_no = request.data.get('semester_no')

        if not batch_id:
            return Response({'error': 'batch_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)

        sem = None
        if semester_id:
            try:
                sem = Semester.objects.get(id=semester_id, program=batch.program)
            except Semester.DoesNotExist:
                return Response({'error': 'Semester not found'}, status=status.HTTP_404_NOT_FOUND)
        elif semester_no:
            try:
                sem = Semester.objects.get(number=int(semester_no), program=batch.program)
            except (Semester.DoesNotExist, ValueError):
                return Response({'error': 'Semester not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({'error': 'semester_id or semester_no is required'}, status=status.HTTP_400_BAD_REQUEST)

        window = ElectiveSelectionWindow.objects.filter(
            batch=batch,
            semester=sem,
            is_active=True,
        ).first()

        if not window:
            return Response(
                {'error': 'No selection window exists for this batch/semester.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not window.is_open:
            return Response(
                {'error': 'Window is not open; cannot lock electives.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        locked_count = StudentElectiveEnrollment.objects.filter(
            batch=batch,
            semester=sem,
            is_active=True,
            is_locked=False,
        ).filter(
            Q(course__offering_type=Course.OFFERING_ELECTIVE) |
            Q(course__offering_type=Course.OFFERING_COMPULSORY)
        ).update(
            is_locked=True,
            locked_by=request.user,
            locked_at=timezone.now(),
        )

        return Response({
            'window': ElectiveSelectionWindowSerializer(window).data,
            'locked_enrollments_count': locked_count,
            'message': f'{locked_count} elective enrollment(s) locked.',
        }, status=status.HTTP_200_OK)


class ElectiveWindowListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ElectiveSelectionWindowSerializer

    def get_queryset(self):
        qs = ElectiveSelectionWindow.objects.filter(is_active=True).select_related(
            'batch', 'semester', 'opened_by', 'closed_by',
        )
        batch_id = self.request.query_params.get('batch_id')
        semester_id = self.request.query_params.get('semester_id')
        if batch_id:
            qs = qs.filter(batch_id=batch_id)
        if semester_id:
            qs = qs.filter(semester_id=semester_id)
        return qs
