from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from core.models import Batch
from curriculum.models import CurriculumVersion
from academic_structure.models import Course
from ..models import CourseSession
from ..serializers import CourseSessionSerializer, CurriculumVersionSerializer


class CourseSessionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(id=batch_id)
            print(f"[CourseSessionListView] Batch {batch.name} current_semester: {batch.current_semester}")
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=404)
        
        # Get the curriculum version's courses
        allowed_course_ids = []
        if batch.curriculum_version:
            allowed_course_ids = batch.curriculum_version.version_courses.filter(
                is_active=True
            ).values_list('course_id', flat=True)
        
        sessions = CourseSession.objects.filter(
            batch_id=batch_id,
            is_active=True,
            course_id__in=allowed_course_ids  # Only courses in current curriculum
        ).select_related(
            'course', 'batch', 'instructor', 'semester'
        )
        
        print("[CourseSessionListView] All sessions before filter:")
        for s in sessions:
            print(f"  - {s.course.code}: semester_number={s.semester.number if s.semester else None}")
        
        # If no sessions but batch has curriculum version, create them!
        if not sessions.exists() and batch.curriculum_version:
            try:
                from curriculum.services import create_offerings_from_version
                create_offerings_from_version(batch.curriculum_version)
                # Re-fetch sessions!
                sessions = CourseSession.objects.filter(
                    batch_id=batch_id,
                    is_active=True,
                    course_id__in=allowed_course_ids  # Again filter by allowed courses
                ).select_related(
                    'course', 'batch', 'instructor', 'semester'
                )
            except Exception as e:
                print(f"[CourseSessionListView] Error creating course sessions: {str(e)}")
        
        # Filter only current and previous semesters!
        filtered_sessions = []
        for session in sessions:
            if session.semester:
                print(f"  Checking {session.course.code}: session.semester.number={session.semester.number}, batch.current_semester={batch.current_semester}")
            if session.semester and session.semester.number <= batch.current_semester:
                filtered_sessions.append(session)
        
        print(f"[CourseSessionListView] Filtered sessions count: {len(filtered_sessions)}")
        
        return Response({
            'sessions': CourseSessionSerializer(
                filtered_sessions, many=True
            ).data
        })


class CourseSessionCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CourseSessionSerializer(
            data=request.data
        )
        if serializer.is_valid():
            serializer.save(status='allocated')
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


class CourseSessionUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            session = CourseSession.objects.get(
                pk=pk, is_active=True
            )
        except CourseSession.DoesNotExist:
            return Response(
                {'error': 'Not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = CourseSessionSerializer(
            session,
            data=request.data,
            partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


class CurriculumVersionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        versions = CurriculumVersion.objects.filter(
            batch_id=batch_id,
            is_active=True
        )
        return Response(
            CurriculumVersionSerializer(
                versions, many=True
            ).data
        )

    def post(self, request, batch_id):
        data = request.data.copy()
        data['batch'] = batch_id
        serializer = CurriculumVersionSerializer(
            data=data
        )
        if serializer.is_valid():
            serializer.save()
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


class CurriculumVersionDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            version = CurriculumVersion.objects.get(
                pk=pk, is_active=True
            )
        except CurriculumVersion.DoesNotExist:
            return Response(
                {'error': 'Not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        version.is_active = False
        version.save()
        return Response({'success': True})


class EffectiveCurriculumView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(pk=batch_id)
        except Batch.DoesNotExist:
            return Response(
                {'error': 'Batch not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Base courses from program
        base_courses = Course.objects.filter(
            program=batch.program,
            is_active=True
        )

        # Get overrides for this batch
        overrides = CurriculumVersion.objects.filter(
            batch_id=batch_id,
            is_active=True
        )

        added_ids = overrides.filter(
            action='add'
        ).values_list('course_id', flat=True)

        removed_ids = overrides.filter(
            action='remove'
        ).values_list('course_id', flat=True)

        # Final curriculum
        from academic_structure.serializers import CourseSerializer
        final_courses = base_courses.exclude(
            id__in=removed_ids
        )

        extra_courses = Course.objects.filter(
            id__in=added_ids,
            is_active=True
        )

        return Response({
            'batch': batch.name,
            'base_courses': CourseSerializer(
                final_courses, many=True
            ).data,
            'extra_courses': CourseSerializer(
                extra_courses, many=True
            ).data,
            'removed_count': len(removed_ids),
            'total_courses': (
                final_courses.count() +
                extra_courses.count()
            )
        })

