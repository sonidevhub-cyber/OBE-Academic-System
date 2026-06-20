from rest_framework.views import APIView 
from rest_framework.response import Response 
from rest_framework import status 
from rest_framework.permissions import IsAuthenticated 
from django.db import transaction
from decimal import Decimal
from curriculum.models import CurriculumVersion
from .models import ( 
    PEO, GA, GAPEOMapping, 
    CLO, CLOGAMapping, 
    CourseSession, CourseGAScore,
    GACQIRecord, GACQIResubmissionHistory
) 
from .serializers import ( 
    PEOSerializer, GASerializer, 
    GAPEOMappingSerializer, 
    CLOSerializer, CLOGAMappingSerializer, 
    CourseSessionSerializer, 
    CurriculumVersionSerializer,
    CourseGAScoreSerializer,
    GACQIRecordSerializer,
    GACQIResubmissionHistorySerializer
) 
from .services import (
    calculate_course_ga_score,
    calculate_all_course_ga_scores,
    calculate_semester_ga_score,
    calculate_program_ga_attainment
)
from core.models import Batch, Semester
 
 
# ─── PEO Views ─────────────────────────── 
 
class PEOListCreateView(APIView): 
    permission_classes = [IsAuthenticated] 
 
    def get(self, request, program_id): 
        peos = PEO.objects.filter( 
            program_id=program_id, 
            is_active=True 
        ) 
        serializer = PEOSerializer(peos, many=True) 
        return Response(serializer.data) 
 
    def post(self, request, program_id): 
        print(f"DEBUG: PEO POST request for program_id: {program_id}")
        print(f"DEBUG: Request data: {request.data}")
        data = request.data.copy() 
        data['program'] = program_id 
        serializer = PEOSerializer(data=data) 
        if serializer.is_valid(): 
            serializer.save() 
            return Response( 
                serializer.data, 
                status=status.HTTP_201_CREATED 
            ) 
        print(f"DEBUG: PEO Serializer errors: {serializer.errors}")
        return Response( 
            serializer.errors, 
            status=status.HTTP_400_BAD_REQUEST 
        ) 
 
 
class PEODetailView(APIView): 
    permission_classes = [IsAuthenticated] 
 
    def get_object(self, pk): 
        try: 
            return PEO.objects.get( 
                pk=pk, is_active=True 
            ) 
        except PEO.DoesNotExist: 
            return None 
 
    def get(self, request, pk): 
        peo = self.get_object(pk) 
        if not peo: 
            return Response( 
                {'error': 'Not found'}, 
                status=status.HTTP_404_NOT_FOUND 
            ) 
        return Response(PEOSerializer(peo).data) 
 
    def patch(self, request, pk): 
        peo = self.get_object(pk) 
        if not peo: 
            return Response( 
                {'error': 'Not found'}, 
                status=status.HTTP_404_NOT_FOUND 
            ) 
        serializer = PEOSerializer( 
            peo, data=request.data, partial=True 
        ) 
        if serializer.is_valid(): 
            serializer.save() 
            return Response(serializer.data) 
        return Response( 
            serializer.errors, 
            status=status.HTTP_400_BAD_REQUEST 
        ) 
 
    def delete(self, request, pk): 
        peo = self.get_object(pk) 
        if not peo: 
            return Response( 
                {'error': 'Not found'}, 
                status=status.HTTP_404_NOT_FOUND 
            ) 
        peo.is_active = False 
        peo.save() 
        return Response( 
            {'success': True}, 
            status=status.HTTP_200_OK 
        ) 
 
 
# ─── GA Views ──────────────────────────── 
 
class GAListCreateView(APIView): 
    permission_classes = [IsAuthenticated] 
 
    def get(self, request, program_id): 
        gas = GA.objects.filter( 
            program_id=program_id, 
            is_active=True 
        ) 
        serializer = GASerializer(gas, many=True) 
        return Response(serializer.data) 
 
    @transaction.atomic
    def post(self, request, program_id): 
        print(f"DEBUG: GA POST request for program_id: {program_id}")
        print(f"DEBUG: Request data: {request.data}")
        
        data = request.data.copy() 
        data['program'] = program_id 
        serializer = GASerializer(data=data) 
        if serializer.is_valid(): 
            ga = serializer.save() 
            
            return Response( 
                GASerializer(ga).data, 
                status=status.HTTP_201_CREATED 
            ) 
        print(f"DEBUG: GA Serializer errors: {serializer.errors}")
        return Response( 
            serializer.errors, 
            status=status.HTTP_400_BAD_REQUEST 
        ) 
 
 
class GADetailView(APIView): 
    permission_classes = [IsAuthenticated] 
 
    def get_object(self, pk): 
        try: 
            return GA.objects.get( 
                pk=pk, is_active=True 
            ) 
        except GA.DoesNotExist: 
            return None 
 
    def get(self, request, pk): 
        ga = self.get_object(pk) 
        if not ga: 
            return Response( 
                {'error': 'Not found'}, 
                status=status.HTTP_404_NOT_FOUND 
            ) 
        return Response(GASerializer(ga).data) 
 
    @transaction.atomic
    def patch(self, request, pk): 
        ga = self.get_object(pk) 
        if not ga: 
            return Response( 
                {'error': 'Not found'}, 
                status=status.HTTP_404_NOT_FOUND 
            ) 
        
        serializer = GASerializer( 
            ga, data=request.data, partial=True 
        ) 
        if serializer.is_valid(): 
            serializer.save() 
            return Response(GASerializer(ga).data) 
        return Response( 
            serializer.errors, 
            status=status.HTTP_400_BAD_REQUEST 
        ) 
 
    def delete(self, request, pk): 
        ga = self.get_object(pk) 
        if not ga: 
            return Response( 
                {'error': 'Not found'}, 
                status=status.HTTP_404_NOT_FOUND 
            ) 
        ga.is_active = False 
        ga.save() 
        return Response({'success': True}) 
 
 
# ─── GA-PEO Matrix View ────────────────── 
 
class GAPEOMatrixView(APIView): 
    permission_classes = [IsAuthenticated] 
 
    def get(self, request, program_id): 
        gas = GA.objects.filter( 
            program_id=program_id, 
            is_active=True 
        ) 
        peos = PEO.objects.filter( 
            program_id=program_id, 
            is_active=True 
        ) 
        mappings = GAPEOMapping.objects.filter( 
            ga__program_id=program_id, 
            is_active=True 
        ) 
        return Response({ 
            'gas': GASerializer(gas, many=True).data, 
            'peos': PEOSerializer( 
                peos, many=True 
            ).data, 
            'mappings': GAPEOMappingSerializer( 
                mappings, many=True 
            ).data 
        }) 
 
    @transaction.atomic 
    def post(self, request, program_id): 
        # Bulk save matrix 
        # Delete existing mappings 
        GAPEOMapping.objects.filter( 
            ga__program_id=program_id 
        ).delete() 
 
        mappings_data = request.data.get( 
            'mappings', [] 
        ) 
        created = [] 
        for m in mappings_data: 
            mapping = GAPEOMapping.objects.create( 
                ga_id=m['ga_id'], 
                peo_id=m['peo_id'] 
            ) 
            created.append(mapping) 
 
        return Response( 
            GAPEOMappingSerializer( 
                created, many=True 
            ).data, 
            status=status.HTTP_201_CREATED 
        ) 
 
 
# ─── CLO Views ─────────────────────────── 
 
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
 
 
# ─── CLO-GA Matrix View ────────────────── 
 
class CLOGAMatrixView(APIView): 
    permission_classes = [IsAuthenticated] 
 
    def get(self, request, course_id, version_id): 
        clos = CLO.objects.filter( 
            course_id=course_id, 
            curriculum_version_id=version_id, 
            is_active=True 
        ) 
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
 
 

 
 
# ─── Course Session Views ───────────────── 
 
class CourseSessionListView(APIView): 
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        try:
            from core.models import Batch
            batch = Batch.objects.get(id=batch_id)
            print(f"[CourseSessionListView] Batch {batch.name} current_semester: {batch.current_semester}")
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=404)
        
        sessions = CourseSession.objects.filter(
            batch_id=batch_id,
            is_active=True
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
                    is_active=True
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
 
 
# ─── Curriculum Version Views ───────────── 
 
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
 
 
# ─── Effective Curriculum View ──────────── 
 
class EffectiveCurriculumView(APIView): 
    permission_classes = [IsAuthenticated] 
 
    def get(self, request, batch_id): 
        from academic_structure.models import ( 
            Batch, Course 
        ) 
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
        from academic_structure.serializers import ( 
            CourseSerializer 
        ) 
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


# ========== NEW GA MODULE VIEWS ==========

# 1. Get all GAs
class GAAllView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        gas = GA.objects.filter(is_active=True)
        return Response(GASerializer(gas, many=True).data)


# 2. Create CLO-GA mapping
class GACLOMappingCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, ga_id):
        try:
            ga = GA.objects.get(id=ga_id, is_active=True)
        except GA.DoesNotExist:
            return Response({'error': 'GA not found'}, status=status.HTTP_404_NOT_FOUND)
        data = request.data.copy()
        data['ga'] = ga_id
        serializer = CLOGAMappingSerializer(data=data)
        if serializer.is_valid():
            # Validate that clo's row sum is 1.00
            clo = serializer.validated_data['clo']
            existing_mappings = CLOGAMapping.objects.filter(clo=clo, is_active=True)
            total_weight = sum(m.weight for m in existing_mappings) + serializer.validated_data['weight']
            if round(float(total_weight), 2) != 1.00:
                return Response(
                    {'error': f'CLO weight row sum must be 1.00, got {total_weight}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# 3. Get CLO-GA matrix for a course
class CourseCLOGAMatrixView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        # Get course, check core.Course exists
        from core.models import Course
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


# 4. Post Course Final Submit (Assessment Done)
class CourseFinalSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, session_id):
        try:
            session = CourseSession.objects.get(id=session_id, is_active=True)
        except CourseSession.DoesNotExist:
            return Response({'error': 'Course session not found'}, status=status.HTTP_404_NOT_FOUND)
        
        session.assessment_status = 'ASSESSMENT_DONE'
        session.save()
        
        # Calculate Course GA Scores
        calculate_all_course_ga_scores(session)
        
        return Response(CourseSessionSerializer(session).data)


# 5. Get Course GA Scores
class CourseGAScoresView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        try:
            session = CourseSession.objects.get(id=session_id, is_active=True)
        except CourseSession.DoesNotExist:
            return Response({'error': 'Course session not found'}, status=status.HTTP_404_NOT_FOUND)
        
        scores = CourseGAScore.objects.filter(course_session=session)
        return Response(CourseGAScoreSerializer(scores, many=True).data)


# 6. Get Semester GA Summary
class BatchSemesterGASummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        # Get semester from request params?
        semester_id = request.query_params.get('semester_id')
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Get all GAs
        gas = GA.objects.filter(program=batch.program, is_active=True)
        summaries = []
        for ga in gas:
            if semester_id:
                try:
                    semester = Semester.objects.get(id=semester_id)
                    ga_score = calculate_semester_ga_score(batch, semester, ga)
                except Semester.DoesNotExist:
                    ga_score = None
            else:
                ga_score = None
            
            summaries.append({
                'ga': GASerializer(ga).data,
                'score': float(ga_score) if ga_score else None,
                'kpi_threshold': float(ga.kpi_threshold),
                'pass': ga_score is not None and ga_score >= float(ga.kpi_threshold)
            })
        
        return Response(summaries)


# 7. Get Program GA Summary
class BatchProgramGASummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
        gas = GA.objects.filter(program=batch.program, is_active=True)
        summaries = []
        for ga in gas:
            final_score = calculate_program_ga_attainment(batch, ga)
            summaries.append({
                'ga': GASerializer(ga).data,
                'final_score': float(final_score),
                'kpi_threshold': float(ga.kpi_threshold),
                'pass': final_score >= float(ga.kpi_threshold)
            })
        
        return Response(summaries)


# 8. Post GA CQI Record
class GACQICreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = GACQIRecordSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(status='PENDING_HOD_APPROVAL')
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# 9. Approve GA CQI
class GACQIApproveView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, cqi_id):
        try:
            cqi = GACQIRecord.objects.get(id=cqi_id)
        except GACQIRecord.DoesNotExist:
            return Response({'error': 'CQI not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Save history
        GACQIResubmissionHistory.objects.create(
            cqi_record=cqi,
            reason_snapshot=cqi.reason,
            remedy_snapshot=cqi.remedy,
            status_at_time=cqi.status
        )

        cqi.status = 'FULLY_APPROVED'
        cqi.save()
        return Response(GACQIRecordSerializer(cqi).data)


# 10. Reject GA CQI
class GACQIRejectView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, cqi_id):
        try:
            cqi = GACQIRecord.objects.get(id=cqi_id)
        except GACQIRecord.DoesNotExist:
            return Response({'error': 'CQI not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Save history
        GACQIResubmissionHistory.objects.create(
            cqi_record=cqi,
            reason_snapshot=cqi.reason,
            remedy_snapshot=cqi.remedy,
            status_at_time=cqi.status
        )

        hod_comment = request.data.get('hod_rejection_comment', '')
        cqi.status = 'SENT_BACK'
        cqi.hod_rejection_comment = hod_comment
        cqi.save()
        return Response(GACQIRecordSerializer(cqi).data)


# 11. Get GA CQI History
class GACQIHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, cqi_id):
        try:
            cqi = GACQIRecord.objects.get(id=cqi_id)
        except GACQIRecord.DoesNotExist:
            return Response({'error': 'CQI not found'}, status=status.HTTP_404_NOT_FOUND)
        
        history = cqi.history.all().order_by('-submitted_at')
        return Response(GACQIResubmissionHistorySerializer(history, many=True).data)


# 12. Unlock Course Assessment
class CourseUnlockView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, session_id):
        try:
            session = CourseSession.objects.get(id=session_id, is_active=True)
        except CourseSession.DoesNotExist:
            return Response({'error': 'Course session not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Mark all existing scores as stale
        CourseGAScore.objects.filter(course_session=session).update(is_stale=True)
        
        # Set back to in progress
        session.assessment_status = 'IN_PROGRESS'
        session.save()
        
        return Response(CourseSessionSerializer(session).data)


# 14. Get Course CLO Report
class CourseCLOReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        try:
            session = CourseSession.objects.select_related('course', 'batch', 'semester', 'instructor').get(id=session_id, is_active=True)
        except CourseSession.DoesNotExist:
            return Response({'error': 'Course session not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Get Course info
        course = session.course
        
        # Get CLOs for this course
        from curriculum.models import CurriculumVersion
        version = None
        try:
            if session.batch.curriculum_version:
                version = session.batch.curriculum_version
            else:
                version = CurriculumVersion.objects.filter(program=course.program, is_active=True).first()
        except Exception:
            pass
        
        clos = CLO.objects.filter(
            course=course,
            curriculum_version=version,
            is_active=True
        ).select_related('course', 'curriculum_version').order_by('order_number')
        
        # Get Assessments for this course, batch, semester that are finalized
        from assessments.models import Assessment, Question, StudentQuestionMark
        assessments = Assessment.objects.filter(
            course=course,
            batch=session.batch,
            semester=session.semester,
            is_finalized=True
        ).prefetch_related('questions__clo')
        
        # Get all students in this batch
        from students.models import Student
        students = Student.objects.filter(user__batch=session.batch)
        
        clo_summary = []
        for clo in clos:
            # Get all questions mapped to this CLO
            questions = Question.objects.filter(clo=clo, assessment__in=assessments)
            
            total_marks = sum(q.marks for q in questions)
            total_obtained = Decimal('0')
            total_questions = questions.count()
            
            # Calculate total obtained marks across all students and questions
            if total_questions > 0:
                student_marks = StudentQuestionMark.objects.filter(question__in=questions)
                total_obtained = sum(sm.marks_obtained for sm in student_marks)
                total_possible = total_marks * students.count()
                
                if total_possible > 0:
                    overall_attainment = float((total_obtained / total_possible) * 100)
                else:
                    overall_attainment = 0
            else:
                overall_attainment = 0
            
            target_kpi = clo.kpi_target
            status = 'ACHIEVED' if overall_attainment >= target_kpi else 'BELOW_TARGET'
            
            # Find all assessments that have questions mapped to this CLO
            mapped_assessments = []
            for ass in assessments:
                has_clo = any(q.clo.id == clo.id for q in ass.questions.all())
                if has_clo:
                    mapped_assessments.append(ass.title)
            
            clo_summary.append({
                'clo_code': f'CLO-{clo.order_number}',
                'description': clo.title,
                'target_kpi': target_kpi,
                'overall_attainment': round(overall_attainment, 2),
                'status': status,
                'mapped_assessments': mapped_assessments,
                'unmapped_assessments': [a.title for a in assessments if a.title not in mapped_assessments]
            })
        
        assessment_effectiveness = []
        for assessment in assessments:
            # Get all questions and mapped CLOs for this assessment
            questions = assessment.questions.all()
            mapped_clos = list({f'CLO-{q.clo.order_number}' for q in questions})
            
            # Calculate average attainment for this assessment
            ass_total_marks = sum(q.marks for q in questions)
            ass_total_obtained = Decimal('0')
            if ass_total_marks > 0:
                ass_student_marks = StudentQuestionMark.objects.filter(question__in=questions)
                ass_total_obtained = sum(sm.marks_obtained for sm in ass_student_marks)
                ass_total_possible = ass_total_marks * students.count()
                if ass_total_possible > 0:
                    avg_attainment = float((ass_total_obtained / ass_total_possible) * 100)
                else:
                    avg_attainment = 0
            else:
                avg_attainment = 0
            
            effectiveness = 'GOOD' if avg_attainment >= 60 else 'NEEDS_REVIEW'
            
            assessment_effectiveness.append({
                'assessment_name': assessment.title,
                'mapped_clos': mapped_clos,
                'avg_attainment': round(avg_attainment, 2),
                'effectiveness': effectiveness,
                'is_single_point_of_failure': avg_attainment < 50,
                'note': 'Single point of failure - Low attainment' if avg_attainment < 50 else ''
            })
        
        # Get CQI records
        cqi_list = []
        cqis = GACQIRecord.objects.filter(affected_course_sessions=session)
        for cqi in cqis:
            cqi_list.append({
                'clo_code': f'GA-{cqi.ga.order_number}',
                'clo_description': cqi.ga.title,
                'course_code': course.code,
                'reason': cqi.reason,
                'action_plan': cqi.remedy,
                'instructor': session.instructor.full_name if session.instructor else 'N/A',
                'approved_by': 'N/A',
                'status': cqi.status
            })
        
        return Response({
            'course': {
                'code': course.code,
                'title': course.name,
                'semester': session.semester.name if session.semester else 'N/A',
                'session': session.id
            },
            'clo_summary': clo_summary,
            'assessment_effectiveness': assessment_effectiveness,
            'cqi_list': cqi_list
        })

# 13. Get GA Report (Readiness + Auto-generated)
class BatchGAReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check readiness - only current/previous semesters
        all_sessions = CourseSession.objects.filter(batch=batch, is_active=True).select_related('semester')
        # Filter to only current/previous semesters
        sessions = []
        for session in all_sessions:
            if session.semester and session.semester.number <= batch.current_semester:
                sessions.append(session)
        
        courses_total = len(sessions)
        courses_assessment_done = len([s for s in sessions if s.assessment_status == 'ASSESSMENT_DONE'])
        
        cqis = GACQIRecord.objects.filter(affected_course_sessions__in=sessions).distinct()
        cqi_total = cqis.count()
        cqi_fully_approved = cqis.filter(status='FULLY_APPROVED').count()
        
        blocking_reasons = []
        if courses_assessment_done < courses_total:
            blocking_reasons.append(f'{courses_total - courses_assessment_done} of {courses_total} courses not yet Assessment Done')
        if cqi_fully_approved < cqi_total:
            blocking_reasons.append(f'{cqi_total - cqi_fully_approved} of {cqi_total} GA-level CQIs still pending approval')
        
        is_ready = (courses_assessment_done == courses_total and cqi_fully_approved == cqi_total)
        
        if not is_ready:
            return Response({
                'status': 'NOT_READY',
                'readiness': {
                    'courses_total': courses_total,
                    'courses_assessment_done': courses_assessment_done,
                    'cqi_total': cqi_total,
                    'cqi_fully_approved': cqi_fully_approved,
                    'blocking_reasons': blocking_reasons
                }
            })
        
        # Calculate CourseGAScores for all courses
        from .services import calculate_all_course_ga_scores, calculate_program_ga_attainment
        for session in sessions:
            if session.assessment_status == 'ASSESSMENT_DONE':
                calculate_all_course_ga_scores(session)
        
        # If ready, generate report
        gas = GA.objects.filter(program=batch.program, is_active=True)
        ga_summary = []
        
        for ga in gas:
            final_score = calculate_program_ga_attainment(batch, ga)
            d_ga = float(final_score)  # Use calculated score as D_GA for now
            i_ga = float(final_score)  # Use calculated score as I_GA for now
            
            # Get contributing courses
            contributing_courses = []
            course_sessions = [s for s in sessions if CourseGAScore.objects.filter(course_session=s, ga=ga, is_stale=False).exists()]
            for cs in course_sessions:
                course_ga_score = CourseGAScore.objects.get(course_session=cs, ga=ga, is_stale=False)
                # Get real student count
                from students.models import Student
                student_count = Student.objects.filter(user__batch=cs.batch).count()
                contributing_courses.append({
                    'course_code': cs.course.code,
                    'course_ga_score': float(course_ga_score.score),
                    'enrolled_students': student_count
                })
            
            status = 'ACHIEVED' if final_score >= ga.kpi_threshold else 'BELOW_TARGET'
            ga_summary.append({
                'ga_code': f'GA-{ga.order_number}',
                'title': ga.title,
                'kpi_threshold': float(ga.kpi_threshold),
                'd_ga': d_ga,
                'i_ga': i_ga,
                'f_ga': float(final_score),
                'status': status,
                'contributing_courses': contributing_courses
            })
        
        # Get CQI list
        cqi_list = []
        for cqi in cqis:
            cqi_list.append({
                'ga_code': f'GA-{cqi.ga.order_number}',
                'trigger_type': cqi.trigger_type,
                'reason': cqi.reason,
                'remedy': cqi.remedy,
                'status': cqi.status
            })
        
        return Response({
            'status': 'READY',
            'batch': {
                'code': batch.name,
                'graduating_semester': 8
            },
            'ga_summary': ga_summary,
            'cqi_list': cqi_list
        })
