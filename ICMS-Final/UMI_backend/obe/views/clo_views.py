from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from curriculum.models import CurriculumVersion
from ..models import CLO, CLOGAMapping, GA
from ..serializers import CLOSerializer, CLOGAMappingSerializer, GASerializer


class CLOListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id, version_id):
        clos = CLO.objects.filter(
            course_id=course_id,
            curriculum_version_id=version_id,
            is_active=True
        )
        serializer = CLOSerializer(clos, many=True)
        return Response(serializer.data)

    def post(self, request, course_id, version_id):
        # Check if version is editable
        try:
            version = CurriculumVersion.objects.get(id=version_id)
            if version.status != 'draft':
                if version.batch and version.batch.current_semester:
                    # Get the semester number for this course in this version
                    course_in_version = version.version_courses.filter(course_id=course_id).first()
                    if course_in_version and course_in_version.semester_no <= version.batch.current_semester:
                        return Response({'error': 'Cannot add/update CLOs for current or past semesters in a finalized version'}, status=status.HTTP_400_BAD_REQUEST)
        except CurriculumVersion.DoesNotExist:
            return Response({'error': 'Version not found'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data.copy()
        data['course'] = course_id
        data['curriculum_version'] = version_id
        serializer = CLOSerializer(data=data)
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


class CLODetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return CLO.objects.get(
                pk=pk, is_active=True
            )
        except CLO.DoesNotExist:
            return None

    def patch(self, request, pk):
        clo = self.get_object(pk)
        if not clo:
            return Response(
                {'error': 'Not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if version is editable
        if clo.curriculum_version and clo.curriculum_version.status != 'draft':
            version = clo.curriculum_version
            if version.batch and version.batch.current_semester:
                course_in_version = version.version_courses.filter(course_id=clo.course_id).first()
                if course_in_version and course_in_version.semester_no <= version.batch.current_semester:
                    return Response({'error': 'Cannot update CLOs for current or past semesters in a finalized version'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = CLOSerializer(
            clo, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    def delete(self, request, pk):
        clo = self.get_object(pk)
        if not clo:
            return Response(
                {'error': 'Not found'},
                status=status.HTTP_404_NOT_FOUND
            )
            
        # Check if version is editable
        if clo.curriculum_version and clo.curriculum_version.status != 'draft':
            version = clo.curriculum_version
            if version.batch and version.batch.current_semester:
                course_in_version = version.version_courses.filter(course_id=clo.course_id).first()
                if course_in_version and course_in_version.semester_no <= version.batch.current_semester:
                    return Response({'error': 'Cannot delete CLOs for current or past semesters in a finalized version'}, status=status.HTTP_400_BAD_REQUEST)

        clo.is_active = False
        clo.save()
        return Response({'success': True})


class CLOCopyView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(
        self, request, course_id, version_id
    ):
        # Check if target version is editable
        try:
            target_version = CurriculumVersion.objects.get(id=version_id)
            if target_version.status != 'draft':
                return Response({'error': 'Cannot copy CLOs to a finalized version'}, status=status.HTTP_400_BAD_REQUEST)
        except CurriculumVersion.DoesNotExist:
            return Response({'error': 'Target version not found'}, status=status.HTTP_404_NOT_FOUND)

        source_version_id = request.data.get(
            'source_version_id'
        )
        if not source_version_id:
            return Response(
                {'error': 'source_version_id required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        source_clos = CLO.objects.filter(
            course_id=course_id,
            curriculum_version_id=source_version_id,
            is_active=True
        )

        if not source_clos.exists():
            return Response(
                {'error': 'No CLOs found in source version'},
                status=status.HTTP_400_BAD_REQUEST
            )

        new_clos = []
        for s_clo in source_clos:
            new_clo = CLO.objects.create(
                course_id=course_id,
                curriculum_version_id=version_id,
                title=s_clo.title,
                description=s_clo.description,
                order_number=s_clo.order_number,
                bloom_level=s_clo.bloom_level,
                kpi_target=s_clo.kpi_target
            )
            new_clos.append(new_clo)
        
        return Response(CLOSerializer(new_clos, many=True).data, status=status.HTTP_201_CREATED)


class CLOGAMatrixView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id, version_id):
        clos = CLO.objects.filter(
            course_id=course_id,
            curriculum_version_id=version_id,
            is_active=True
        )
        from ..models import GA
        gas = GA.objects.filter(
            program__courses__id=course_id,
            is_active=True
        ).distinct()
        mappings = CLOGAMapping.objects.filter(
            clo__course_id=course_id,
            clo__curriculum_version_id=version_id,
            is_active=True
        )
        return Response({
            'clos': CLOSerializer(
                clos, many=True
            ).data,
            'gas': GASerializer(
                gas, many=True
            ).data,
            'mappings': CLOGAMappingSerializer(
                mappings, many=True
            ).data
        })

    @transaction.atomic
    def post(
        self, request, course_id, version_id
    ):
        # Check if version is editable (Only allow if version is draft OR course is in upcoming semester)
        try:
            version = CurriculumVersion.objects.get(id=version_id)
            if version.status != 'draft':
                # If finalized, check if course is in an upcoming semester
                # For now, we'll allow update if the user is a coordinator
                # and explicitly implementing the "current semester safe, next change" rule
                # requires checking the batch's current_semester
                if version.batch and version.batch.current_semester:
                    course_in_version = version.version_courses.filter(course_id=course_id).first()
                    if course_in_version and course_in_version.semester_no <= version.batch.current_semester:
                        return Response({'error': 'Cannot update CLO mappings for current or past semesters in a finalized version'}, status=status.HTTP_400_BAD_REQUEST)
        except CurriculumVersion.DoesNotExist:
            return Response({'error': 'Version not found'}, status=status.HTTP_404_NOT_FOUND)

        CLOGAMapping.objects.filter(
            clo__course_id=course_id,
            clo__curriculum_version_id=version_id
        ).delete()

        mappings_data = request.data.get(
            'mappings', []
        )
        created = []
        for m in mappings_data:
            mapping = CLOGAMapping.objects.create(
                clo_id=m['clo_id'],
                ga_id=m['ga_id'],
                weight=m['weight']
            )
            created.append(mapping)

        return Response(
            CLOGAMappingSerializer(
                created, many=True
            ).data,
            status=status.HTTP_201_CREATED
        )


# 3. Get CLO-GA matrix for a course
class CourseCLOGAMatrixView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        # Get course, check core.Course exists
        from core.models import Course
        from ..models import GA
        try:
            course = Course.objects.get(id=course_id, is_active=True)
        except Course.DoesNotExist:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)
        # Get all clos for this course (any version)
        clos = CLO.objects.filter(course=course, is_active=True)
        # Get all gas for this course's program
        gas = GA.objects.filter(program=course.program, is_active=True)
        # Get all mappings
        mappings = CLOGAMapping.objects.filter(clo__course=course, is_active=True)
        return Response({
            'clos': CLOSerializer(clos, many=True).data,
            'gas': GASerializer(gas, many=True).data,
            'mappings': CLOGAMappingSerializer(mappings, many=True).data
        })

