from rest_framework.views import APIView 
from rest_framework.response import Response 
from rest_framework import status 
from rest_framework.permissions import IsAuthenticated 
from django.db import transaction
from django.core import exceptions
from decimal import Decimal
from curriculum.models import CurriculumVersion
from .models import ( 
    PEO, GA, GAPEOMapping, 
    CLO, CLOGAMapping, 
    CourseSession, CourseGAScore,
    GACQIRecord, GACQIResubmissionHistory,
    StudentCLOScore
) 
from .serializers import ( 
    PEOSerializer, GASerializer, 
    GAPEOMappingSerializer, 
    CLOSerializer, CLOGAMappingSerializer, 
    CourseSessionSerializer, 
    CurriculumVersionSerializer,
    CourseGAScoreSerializer,
    GACQIRecordSerializer,
    GACQIResubmissionHistorySerializer,
    StudentCLOScoreSerializer
) 
from .services import (
    calculate_course_ga_score,
    calculate_all_course_ga_scores,
    calculate_ga_attainment_semester_cohort,
    calculate_ga_attainment_cumulative_cohort,
    calculate_ga_attainment_semester_student,
    calculate_ga_attainment_cumulative_student,
    check_and_trigger_ga_cqi,
    get_teacher_ga_context
)
from core.models import Batch, Semester
from students.models import Student
 

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


# ─── GA Views ───────────────────────────── 

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
                    ga_score = calculate_ga_attainment_semester_cohort(batch, semester, ga)
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
            final_score = calculate_ga_attainment_cumulative_cohort(batch, ga)
            summaries.append({
                'ga': GASerializer(ga).data,
                'final_score': float(final_score),
                'kpi_threshold': float(ga.kpi_threshold),
                'pass': final_score >= float(ga.kpi_threshold)
            })
        
        return Response(summaries)


# 8. GA CQI Views
class GACQIRecordDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, cqi_id):
        try:
            cqi = GACQIRecord.objects.get(id=cqi_id)
        except GACQIRecord.DoesNotExist:
            return Response({'error': 'CQI not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(GACQIRecordSerializer(cqi).data)

    @transaction.atomic
    def patch(self, request, cqi_id):
        try:
            cqi = GACQIRecord.objects.get(id=cqi_id)
        except GACQIRecord.DoesNotExist:
            return Response({'error': 'CQI not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if program is end ready
        if not cqi.batch.is_program_end_ready:
            return Response({'error': 'Program not yet complete — GA-CQI not available until all semesters finish'}, status=status.HTTP_403_FORBIDDEN)
        
        if cqi.is_locked:
            return Response({'error': 'This CQI record is locked and cannot be updated'}, status=status.HTTP_403_FORBIDDEN)
        
        # Check if user is coordinator (role or secondary role) for submission
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_coordinator = (user_role == 'coordinator') or (user_secondary_role == 'coordinator')
        
        if not is_coordinator:
            return Response({'error': 'Only coordinators can update root cause/remedial plan'}, status=status.HTTP_403_FORBIDDEN)

        # Save history if there are changes to root_cause or remedial_plan
        if 'root_cause' in request.data or 'remedial_plan' in request.data:
            GACQIResubmissionHistory.objects.create(
                cqi_record=cqi,
                root_cause_snapshot=cqi.root_cause,
                remedial_plan_snapshot=cqi.remedial_plan,
                hod_comment_snapshot=cqi.hod_comment,
                status_at_time=cqi.status
            )

        serializer = GACQIRecordSerializer(cqi, data=request.data, partial=True)
        if serializer.is_valid():
            # If status is being set to PENDING, or if root/plan are provided and it was SENT_BACK
            if request.data.get('status') == 'PENDING' or ((request.data.get('root_cause') or cqi.root_cause) and (request.data.get('remedial_plan') or cqi.remedial_plan) and cqi.status == 'SENT_BACK'):
                serializer.validated_data['status'] = 'PENDING'
                serializer.validated_data['submitted_by'] = request.user
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GACQICreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_coordinator = (user_role == 'coordinator') or (user_secondary_role == 'coordinator')
        
        if not is_coordinator:
            return Response({'error': 'Only coordinators can create/update GA CQI records'}, status=status.HTTP_403_FORBIDDEN)
            
        # Get required fields from request data
        ga_id = request.data.get('ga')
        batch_id = request.data.get('batch')
        cqi_level = request.data.get('cqi_level', 'CUMULATIVE')
        
        if not ga_id or not batch_id:
            return Response({'error': 'ga and batch are required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            ga = GA.objects.get(id=ga_id)
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except (GA.DoesNotExist, Batch.DoesNotExist) as e:
            return Response({'error': 'GA or Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if program is end ready
        if not batch.is_program_end_ready:
            return Response({'error': 'Program not yet complete — GA-CQI not available until all semesters finish'}, status=status.HTTP_403_FORBIDDEN)
        
        # Try to get existing record
        cqi = GACQIRecord.objects.filter(ga=ga, batch=batch, cqi_level=cqi_level).first()
        
        if cqi:
            if cqi.is_locked:
                return Response({'error': 'This CQI record is locked and cannot be updated'}, status=status.HTTP_403_FORBIDDEN)
            
            # Save history
            GACQIResubmissionHistory.objects.create(
                cqi_record=cqi,
                root_cause_snapshot=cqi.root_cause,
                remedial_plan_snapshot=cqi.remedial_plan,
                hod_comment_snapshot=cqi.hod_comment,
                status_at_time=cqi.status
            )
            
            # Update existing record
            serializer = GACQIRecordSerializer(cqi, data=request.data, partial=True)
        else:
            # Create new record
            serializer = GACQIRecordSerializer(data=request.data)
            
        if serializer.is_valid():
            cqi = serializer.save(status='PENDING', submitted_by=request.user)
            return Response(GACQIRecordSerializer(cqi).data, status=status.HTTP_200_OK if cqi else status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GACQIApproveView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, cqi_id):
        try:
            cqi = GACQIRecord.objects.get(id=cqi_id)
        except GACQIRecord.DoesNotExist:
            return Response({'error': 'CQI not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if program is end ready
        if not cqi.batch.is_program_end_ready:
            return Response({'error': 'Program not yet complete — GA-CQI not available until all semesters finish'}, status=status.HTTP_403_FORBIDDEN)
        
        if cqi.is_locked:
            return Response({'error': 'This CQI record is already locked'}, status=status.HTTP_403_FORBIDDEN)
        
        # Check if user is HOD (role or secondary role)
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can approve GA CQI records'}, status=status.HTTP_403_FORBIDDEN)

        # Save history
        GACQIResubmissionHistory.objects.create(
            cqi_record=cqi,
            root_cause_snapshot=cqi.root_cause,
            remedial_plan_snapshot=cqi.remedial_plan,
            hod_comment_snapshot=cqi.hod_comment,
            status_at_time=cqi.status
        )

        cqi.status = 'FULLY_APPROVED'
        cqi.approved_by = request.user
        cqi.is_locked = True
        cqi.save()
        return Response(GACQIRecordSerializer(cqi).data)


class GACQIRejectView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, cqi_id):
        try:
            cqi = GACQIRecord.objects.get(id=cqi_id)
        except GACQIRecord.DoesNotExist:
            return Response({'error': 'CQI not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if program is end ready
        if not cqi.batch.is_program_end_ready:
            return Response({'error': 'Program not yet complete — GA-CQI not available until all semesters finish'}, status=status.HTTP_403_FORBIDDEN)
        
        if cqi.is_locked:
            return Response({'error': 'This CQI record is locked and cannot be rejected'}, status=status.HTTP_403_FORBIDDEN)
        
        # Check if user is HOD (role or secondary role)
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can reject GA CQI records'}, status=status.HTTP_403_FORBIDDEN)

        # Save history
        GACQIResubmissionHistory.objects.create(
            cqi_record=cqi,
            root_cause_snapshot=cqi.root_cause,
            remedial_plan_snapshot=cqi.remedial_plan,
            hod_comment_snapshot=cqi.hod_comment,
            status_at_time=cqi.status
        )

        cqi.status = 'SENT_BACK'
        if 'hod_comment' in request.data:
            cqi.hod_comment = request.data.get('hod_comment')
        cqi.save()
        return Response(GACQIRecordSerializer(cqi).data)


class GACQIHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, cqi_id):
        try:
            cqi = GACQIRecord.objects.get(id=cqi_id)
        except GACQIRecord.DoesNotExist:
            return Response({'error': 'CQI not found'}, status=status.HTTP_404_NOT_FOUND)
        
        history = cqi.history.all().order_by('-submitted_at')
        return Response(GACQIResubmissionHistorySerializer(history, many=True).data)


# 9. Unlock Course Assessment
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


# 10. GA Report View
class BatchGAReportView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_readiness_for_cumulative_cohort(self, batch: Batch):
        # Only consider courses where semester number <= batch's current semester
        sessions = CourseSession.objects.filter(
            batch=batch,
            is_active=True,
            semester__number__lte=batch.current_semester,
        )
        courses_total = sessions.count()
        courses_assessment_done = sessions.filter(assessment_status='ASSESSMENT_DONE').count()

        if courses_total == 0:
            return {
                'ready': False,
                'finalized_courses': 0,
                'total_courses': 0,
                'missing_courses': [],
            }

        missing = []
        if courses_assessment_done < courses_total:
            # Identify missing courses by code for readability
            missing_qs = sessions.exclude(assessment_status='ASSESSMENT_DONE')
            missing = list(missing_qs.values_list('course__code', flat=True).distinct())

        return {
            'ready': courses_assessment_done >= courses_total,
            'finalized_courses': courses_assessment_done,
            'total_courses': courses_total,
            'missing_courses': missing,
        }

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)

        scope = request.query_params.get('scope', 'cohort')    # cohort|student
        student_id = request.query_params.get('student_id', None)

        # For scope=student
        student_obj = None
        if scope == 'student':
            if not student_id:
                return Response({'error': 'student_id is required when scope=student'}, status=status.HTTP_400_BAD_REQUEST)
            student_obj = Student.objects.filter(id=student_id).first()
            if not student_obj:
                return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

        # Readiness gate (only when scope=cohort)
        if scope == 'cohort':
            readiness = self._get_readiness_for_cumulative_cohort(batch)
            if not readiness['ready']:
                return Response(readiness)

        is_program_end_ready = batch.is_program_end_ready
        
        # Determine ga rows
        gas = GA.objects.filter(program=batch.program, is_active=True)
        response_items = []

        for ga in gas:
            ga_attainment = None
            contributing_courses = []
            ga_cqi_records = []

            if scope == 'cohort':
                ga_attainment = calculate_ga_attainment_cumulative_cohort(batch, ga)
                
                # Trigger cumulative CQI only if program end is ready
                if is_program_end_ready:
                    check_and_trigger_ga_cqi(batch, ga, 'CUMULATIVE')

                # Contributing courses: show course_ga_score per course session (only <= current semester)
                cs_qs = CourseSession.objects.filter(batch=batch, is_active=True, assessment_status='ASSESSMENT_DONE', semester__number__lte=batch.current_semester)

                for session in cs_qs.select_related('course', 'semester'):
                    score = CourseGAScore.objects.filter(course_session=session, ga=ga).first()
                    if score:
                        contributing_courses.append({
                            'course_code': session.course.code,
                            'course_name': session.course.name,
                            'course_ga_score': float(score.score),
                            'enrolled_students': score.enrolled_students,
                            'semester': session.semester.number if session.semester else None,
                        })

                # GA CQI records: cohort only, and only if program end is ready
                if is_program_end_ready:
                    cqis = GACQIRecord.objects.filter(batch=batch, ga=ga, cqi_level='CUMULATIVE')
                    for cqi in cqis:
                        ga_cqi_records.append(GACQIRecordSerializer(cqi).data)

            else:
                # scope=student
                ga_attainment = calculate_ga_attainment_cumulative_student(student_obj, ga)

                # Contributing courses: show student's course_ga_score derived from StudentCLOScore (only <= current semester)
                cs_qs = CourseSession.objects.filter(batch=batch, is_active=True, assessment_status='ASSESSMENT_DONE', semester__number__lte=batch.current_semester)

                # For each course, compute one course_ga_score per student's course by using StudentCLOScore weighted sum.
                for session in cs_qs.select_related('course', 'semester'):
                    mappings = CLOGAMapping.objects.filter(clo__course=session.course, ga=ga, is_active=True, clo__is_active=True)
                    if not mappings.exists():
                        continue
                    total_att = Decimal('0')
                    total_w = Decimal('0')
                    for m in mappings:
                        clo_score = StudentCLOScore.objects.filter(student=student_obj, clo=m.clo, course_session=session).first()
                        if clo_score:
                            total_att += clo_score.attainment * m.weight
                            total_w += m.weight
                    if total_w > 0:
                        course_ga_score = round(total_att / total_w, 2)
                        contributing_courses.append({
                            'course_code': session.course.code,
                            'course_name': session.course.name,
                            'course_ga_score': float(course_ga_score),
                            'enrolled_students': 1,
                            'semester': session.semester.number if session.semester else None,
                        })

            if ga_attainment is None:
                # Not assessed if missing data
                status_str = 'NOT_ASSESSED'
            else:
                status_str = 'ACHIEVED' if float(ga_attainment) >= float(ga.kpi_threshold) else 'BELOW_TARGET'

            response_items.append({
                'ga_id': str(ga.id),
                'ga_code': f'GA-{ga.order_number}',
                'ga_title': ga.title,
                'ga_attainment': float(ga_attainment) if ga_attainment is not None else None,
                'kpi_threshold': float(ga.kpi_threshold),
                'status': status_str,
                'contributing_courses': contributing_courses,
                'ga_cqi_records': ga_cqi_records if (scope == 'cohort' and is_program_end_ready) else [],
            })

        # Return top-level object with is_program_end_ready and data
        return Response({
            'is_program_end_ready': is_program_end_ready,
            'ga_reports': response_items
        })



# 11. Teacher GA Context View
class TeacherGAContextView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        context = get_teacher_ga_context(course_id)
        if 'error' in context:
            return Response(context, status=status.HTTP_404_NOT_FOUND)
        return Response(context)


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
        )
        
        clo_summary = []
        for clo in clos:
            # Calculate CLO attainment
            # Assuming there's a calculate_clo_attainment function
            # For now, we'll return a placeholder
            clo_summary.append({
                'clo_code': clo.code if hasattr(clo, 'code') else f'CLO-{clo.order_number}',
                'description': clo.description,
                'target_kpi': float(clo.kpi_threshold),
                'overall_attainment': None,
                'status': 'NOT_ASSESSED',
                'mapped_assessments': [],
                'unmapped_assessments': []
            })
        
        return Response({
            'course': {
                'code': course.code,
                'title': course.name,
                'semester': session.semester.number if session.semester else None,
                'session': str(session.id)
            },
            'clo_summary': clo_summary,
            'assessment_effectiveness': [],
            'cqi_list': []
        })
