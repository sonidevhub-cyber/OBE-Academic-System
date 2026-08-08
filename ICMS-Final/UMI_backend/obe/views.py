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
    get_students_for_batch,
    get_effective_course_sessions,
    get_teacher_ga_context
)
from .reporting import invalidate_ga_reports_for_batch
from core.models import Batch, Semester
from students.models import Student
from assessments.models import Assessment, Question, StudentQuestionMark
 

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
        
        scores = CourseGAScore.objects.filter(course_session=session, is_active=True)
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
        CourseGAScore.objects.filter(course_session=session).update(is_stale=True, is_active=False)
        
        # Set back to in progress
        session.assessment_status = 'IN_PROGRESS'
        session.save()
        invalidate_ga_reports_for_batch(session.batch)
        
        return Response(CourseSessionSerializer(session).data)


# 10. Get Batch Students List
class BatchStudentsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Use User model (core app) which is what has the batch foreign key
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        users = User.objects.filter(
            batch=batch,
            role='student',
            is_active=True
        )
        
        student_list = []
        for user in users:
            # Try to get associated student profile if exists
            student_profile = None
            try:
                from students.models import Student
                student_profile = Student.objects.get(user=user)
            except (ImportError, Student.DoesNotExist):
                pass
            
            student_list.append({
                'id': str(user.id),  # Use user's id (uuid)
                'student_id': user.custom_id or str(user.id),
                'name': user.full_name,
                'roll_number': student_profile.registration_number if student_profile else '',
                'is_active': user.is_active
            })
        
        return Response(student_list)


# 11. GA Report View
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
        print("=== BatchGAReportView ===")
        print("batch_id:", batch_id)
        print("request.query_params:", request.query_params)
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            print("ERROR: Batch not found")
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)

        scope = request.query_params.get('scope', 'cohort')    # cohort|student|all_students|course_wise
        student_id = request.query_params.get('student_id', None)
        print("scope:", scope)
        print("student_id:", student_id)

        # For scope=student or all_students
        student_objs = []
        if scope == 'student':
            if not student_id:
                print("ERROR: student_id missing")
                return Response({'error': 'student_id is required when scope=student'}, status=status.HTTP_400_BAD_REQUEST)
            # Get User first
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(id=student_id)
                student_obj = Student.objects.get(user=user)
                student_objs = [student_obj]
            except (User.DoesNotExist, Student.DoesNotExist):
                print("ERROR: Student not found")
                return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)
            print("student_obj found:", student_obj)
        elif scope == 'all_students':
            student_objs = list(get_students_for_batch(batch))
            print("student_objs count:", len(student_objs))

        # Readiness gate (only when scope=cohort)
        if scope == 'cohort':
            readiness = self._get_readiness_for_cumulative_cohort(batch)
            if not readiness['ready']:
                return Response(readiness)

        is_program_end_ready = batch.is_program_end_ready
        
        # Determine ga rows
        gas = GA.objects.filter(program=batch.program, is_active=True).order_by('order_number')
        
        if scope == 'all_students':
            # Build student-level data
            student_reports = []
            from django.contrib.auth import get_user_model
            User = get_user_model()
            
            for student_obj in student_objs:
                user = student_obj.user
                student_ga_scores = []
                for ga in gas:
                    ga_attainment = calculate_ga_attainment_cumulative_student(student_obj, ga, batch=batch)
                    is_below = False
                    if ga_attainment is not None:
                        is_below = float(ga_attainment) < float(ga.kpi_threshold)
                    student_ga_scores.append({
                        'ga_id': str(ga.id),
                        'ga_code': f'GA-{ga.order_number}',
                        'direct_score': float(ga_attainment) if ga_attainment is not None else None,
                        'is_below_threshold': is_below
                    })
                student_reports.append({
                    'id': str(user.id),
                    'name': user.full_name,
                    'registration_number': student_obj.registration_number,
                    'ga_scores': student_ga_scores,
                    'is_dropped': not user.is_active,
                    'is_frozen': False
                })
            
            # Calculate cohort-level summary for footer
            cohort_summary = []
            for ga in gas:
                weighted_result = calculate_weighted_ga_score(ga, batch)
                final_score = weighted_result['final_score']
                direct_attainment = weighted_result['direct_score']
                indirect_attainment = weighted_result['indirect_score']
                # Calculate final as 80% direct + 20% indirect if both available
                calculated_final = None
                if direct_attainment is not None and indirect_attainment is not None:
                    calculated_final = (direct_attainment * 0.8) + (indirect_attainment * 0.2)
                elif direct_attainment is not None:
                    calculated_final = direct_attainment
                elif indirect_attainment is not None:
                    calculated_final = indirect_attainment
                cohort_summary.append({
                    'ga_id': str(ga.id),
                    'ga_code': f'GA-{ga.order_number}',
                    'ga_title': ga.title,
                    'ga_kpi_threshold': float(ga.kpi_threshold),
                    'direct_attainment': float(direct_attainment) if direct_attainment is not None else None,
                    'indirect_attainment': float(indirect_attainment) if indirect_attainment is not None else None,
                    'final_attainment': float(calculated_final) if calculated_final is not None else None,
                    'status': 'NOT_ASSESSED' if final_score is None else (
                        'ACHIEVED' if float(final_score) >= float(ga.kpi_threshold) else 'BELOW_TARGET'
                    )
                })
            
            return Response({
                'is_program_end_ready': is_program_end_ready,
                'gas': [{'ga_id': str(ga.id), 'ga_code': f'GA-{ga.order_number}', 'ga_title': ga.title, 'ga_kpi_threshold': float(ga.kpi_threshold)} for ga in gas],
                'students': student_reports,
                'cohort_summary': cohort_summary
            })
        elif scope == 'course_wise':
            # Build course-wise data
            allowed_course_ids = []
            if batch.curriculum_version:
                allowed_course_ids = batch.curriculum_version.version_courses.filter(
                    is_active=True
                ).values_list('course_id', flat=True)
            course_sessions = get_effective_course_sessions(
                batch,
                upto_semester=batch.current_semester,
                require_assessment_done=False,
            )
            if allowed_course_ids:
                allowed_course_ids = {str(course_id) for course_id in allowed_course_ids}
                course_sessions = [
                    session for session in course_sessions
                    if str(session.course_id) in allowed_course_ids
                ]
            course_reports_by_code = {}
            for session in course_sessions:
                course_ga_scores = []
                for ga in gas:
                    score_obj = CourseGAScore.objects.filter(
                        course_session=session,
                        ga=ga,
                        is_active=True,
                        is_stale=False
                    ).first()
                    if score_obj:
                        is_below = float(score_obj.score) < float(ga.kpi_threshold)
                        course_ga_scores.append({
                            'ga_id': str(ga.id),
                            'ga_code': f'GA-{ga.order_number}',
                            'score': float(score_obj.score),
                            'is_below_threshold': is_below
                        })
                    else:
                        course_ga_scores.append({
                            'ga_id': str(ga.id),
                            'ga_code': f'GA-{ga.order_number}',
                            'score': None,
                            'is_below_threshold': False
                        })
                course_reports_by_code[session.course.code] = {
                    'course_id': str(session.course.id),
                    'course_code': session.course.code,
                    'course_title': session.course.name,
                    'semester': session.semester.number if session.semester else None,
                    'ga_scores': course_ga_scores
                }
            course_reports = list(course_reports_by_code.values())
            # Calculate cohort-level summary for footer (same as all_students)
            cohort_summary = []
            for ga in gas:
                weighted_result = calculate_weighted_ga_score(ga, batch)
                final_score = weighted_result['final_score']
                direct_attainment = weighted_result['direct_score']
                indirect_attainment = weighted_result['indirect_score']
                # Calculate final as 80% direct + 20% indirect if both available
                calculated_final = None
                if direct_attainment is not None and indirect_attainment is not None:
                    calculated_final = (direct_attainment * 0.8) + (indirect_attainment * 0.2)
                elif direct_attainment is not None:
                    calculated_final = direct_attainment
                elif indirect_attainment is not None:
                    calculated_final = indirect_attainment
                cohort_summary.append({
                    'ga_id': str(ga.id),
                    'ga_code': f'GA-{ga.order_number}',
                    'ga_title': ga.title,
                    'ga_kpi_threshold': float(ga.kpi_threshold),
                    'direct_attainment': float(direct_attainment) if direct_attainment is not None else None,
                    'indirect_attainment': float(indirect_attainment) if indirect_attainment is not None else None,
                    'final_attainment': float(calculated_final) if calculated_final is not None else None,
                    'status': 'NOT_ASSESSED' if final_score is None else (
                        'ACHIEVED' if float(final_score) >= float(ga.kpi_threshold) else 'BELOW_TARGET'
                    )
                })
            return Response({
                'is_program_end_ready': is_program_end_ready,
                'gas': [{'ga_id': str(ga.id), 'ga_code': f'GA-{ga.order_number}', 'ga_title': ga.title, 'ga_kpi_threshold': float(ga.kpi_threshold)} for ga in gas],
                'courses': course_reports,
                'cohort_summary': cohort_summary
            })
        
        response_items = []
        print("=== GA count:", gas.count())

        for ga in gas:
            ga_attainment = None
            contributing_courses = []
            ga_cqi_records = []
            ga_code = f'GA-{ga.order_number}'

            if scope == 'cohort':
                ga_attainment = calculate_ga_attainment_cumulative_cohort(batch, ga)
                
                # Trigger cumulative CQI only if program end is ready
                if is_program_end_ready:
                    check_and_trigger_ga_cqi(batch, ga, 'CUMULATIVE')

                # Contributing courses: show course_ga_score per course session (only <= current semester)
                cs_qs = get_effective_course_sessions(
                    batch,
                    upto_semester=batch.current_semester,
                    require_assessment_done=True,
                )

                for session in cs_qs:
                    score = CourseGAScore.objects.filter(
                        course_session=session,
                        ga=ga,
                        is_active=True,
                        is_stale=False,
                    ).first()
                    if score:
                        contributing_courses.append({
                            'course_code': session.course.code,
                            'course_name': session.course.name,
                            'course_ga_score': float(score.score),
                            'enrolled_students': score.enrolled_students,
                            'semester': session.semester.number if session.semester else None,
                            'credits': session.course.credit_hours,
                        })

                # GA CQI records: cohort only, and only if program end is ready
                if is_program_end_ready:
                    cqis = GACQIRecord.objects.filter(batch=batch, ga=ga, cqi_level='CUMULATIVE')
                    for cqi in cqis:
                        ga_cqi_records.append(GACQIRecordSerializer(cqi).data)

            else:
                # scope=student
                print("=== Processing student scope for", ga_code)
                ga_attainment = calculate_ga_attainment_cumulative_student(student_objs[0], ga, batch=batch)

                # Contributing courses: show student's course_ga_score derived from StudentCLOScore (only <= current semester)
                cs_qs = get_effective_course_sessions(
                    batch,
                    upto_semester=batch.current_semester,
                    require_assessment_done=True,
                )
                print("cs_qs count for student scope:", len(cs_qs))

                # For each course, compute one course_ga_score per student's course by using StudentCLOScore weighted sum.
                for session in cs_qs:
                    mappings = CLOGAMapping.objects.filter(clo__course=session.course, ga=ga, is_active=True, clo__is_active=True)
                    print(f"session:", session.course.code, "mappings count:", mappings.count())
                    if not mappings.exists():
                        continue
                    total_att = Decimal('0')
                    total_w = Decimal('0')
                    for m in mappings:
                        # Check if m.clo has a code field first
                        clo_code = None
                        if hasattr(m.clo, 'code'):
                            clo_code = m.clo.code
                        elif hasattr(m.clo, 'order_number'):
                            clo_code = f"CLO-{m.clo.order_number}"
                        clo_score = StudentCLOScore.objects.filter(student=student_objs[0], clo=m.clo, course_session=session, is_active=True).first()
                        print(f"clo:", clo_code, "clo_score:", clo_score)
                        if clo_score:
                            total_att += clo_score.attainment * m.weight
                            total_w += m.weight
                    course_ga_score = None
                    if total_w > 0:
                        course_ga_score = round(total_att / total_w, 2)
                        print("course_ga_score for", session.course.code, "=", course_ga_score)
                    contributing_courses.append({
                        'course_code': session.course.code,
                        'course_name': session.course.name,
                        'course_ga_score': float(course_ga_score) if course_ga_score is not None else None,
                        'enrolled_students': 1,
                        'semester': session.semester.number if session.semester else None,
                        'credits': session.course.credit_hours,
                    })

            if ga_attainment is None:
                # Not assessed if missing data
                status_str = 'NOT_ASSESSED'
            else:
                status_str = 'ACHIEVED' if float(ga_attainment) >= float(ga.kpi_threshold) else 'BELOW_TARGET'

            response_items.append({
                'ga_id': str(ga.id),
                'ga_code': ga_code,
                'ga_title': ga.title,
                'ga_attainment': float(ga_attainment) if ga_attainment is not None else None,
                'ga_kpi_threshold': float(ga.kpi_threshold),
                'status': status_str,
                'contributing_courses': contributing_courses,
                'ga_cqi_records': ga_cqi_records if (scope == 'cohort' and is_program_end_ready) else [],
            })

        print("=== returning response with response_items count:", len(response_items))
        # Return top-level object with is_program_end_ready and data
        return Response({
            'is_program_end_ready': is_program_end_ready,
            'ga_reports': response_items
        })



# 11. Teacher GA Context View
class TeacherGAContextView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        batch_id = request.query_params.get('batch_id')
        context = get_teacher_ga_context(course_id, batch_id=batch_id)
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
        
        print(f"DEBUG: CourseSession - {session.id}, course: {session.course}, batch: {session.batch}, semester: {session.semester}")
        
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
        
        # First get all finalized assessments for this session
        assessments = Assessment.objects.filter(
            course=course,
            batch=session.batch,
            semester=session.semester,
            is_finalized=True
        )
        print(f"\nDEBUG: CourseSession: {session.id}, course={course.id}, batch={session.batch.id}, semester={session.semester.id if session.semester else None}")
        print(f"DEBUG: Number of assessments found: {len(assessments)}")
        for a in assessments:
            print(f"DEBUG: Assessment {a.id} ({a.title}): course={a.course.id if a.course else None}, batch={a.batch.id if a.batch else None}, semester={a.semester.id if a.semester else None}")
        
        # Get CLOs that are either:
        # 1. Linked to any question in these assessments, OR
        # 2. Associated with the session's curriculum version (if any)
        from django.db.models import Q
        clos_query = Q()
        if version:
            clos_query |= Q(is_active=True, course=course, curriculum_version=version)
        # Also include CLOs that are used in any of the assessment questions
        question_clos = Question.objects.filter(assessment__in=assessments).values_list('clo_id', flat=True)
        clos_query |= Q(id__in=question_clos)
        
        clos = CLO.objects.filter(clos_query).distinct()
        
        print(f"DEBUG: Found {len(assessments)} assessments")
        for a in assessments:
            print(f"DEBUG: Assessment - {a.id}, {a.title}")
        
        # Pre-fetch all relevant data FIRST (like CLOService does)
        students = list(Student.objects.filter(user__batch=session.batch))
        questions = list(
            Question.objects.filter(assessment__in=assessments)
            .select_related('assessment', 'clo')
        )
        all_marks = list(
            StudentQuestionMark.objects.filter(
                student__in=students,
                question__in=questions
            ).select_related('student', 'question')
        )
        # Create a marks map for quick lookup
        marks_map = {
            (m.student_id, m.question_id): m.marks_obtained
            for m in all_marks
        }
        
        clo_summary = []
        assessment_effectiveness = []
        
        for clo in clos:
            print(f"DEBUG: Processing CLO - {clo.id}, {clo.order_number}")
            # Get questions mapped to this CLO
            clo_questions = [q for q in questions if q.clo_id == clo.id]
            
            print(f"DEBUG: Found {len(clo_questions)} questions for CLO")
            
            # Calculate overall CLO attainment
            total_clo_marks = sum(q.marks for q in clo_questions)
            overall_attainment = None
            if total_clo_marks > 0:
                total_obtained_all = Decimal('0')
                total_possible_all = Decimal('0')
                
                for student in students:
                    student_total = sum(
                        marks_map.get((student.student_id, q.id), Decimal('0'))
                        for q in clo_questions
                    )
                    total_obtained_all += student_total
                    total_possible_all += total_clo_marks
                
                if total_possible_all > 0:
                    overall_attainment = round(float((total_obtained_all / total_possible_all) * 100), 2)
                    print(f"DEBUG: total_obtained_all={total_obtained_all}, total_possible_all={total_possible_all}, overall_attainment={overall_attainment}")
            
            # Determine status
            if overall_attainment is not None:
                if overall_attainment >= clo.kpi_target:
                    status = 'ACHIEVED'
                else:
                    status = 'BELOW_TARGET'
            else:
                status = 'NOT_ASSESSED'
            
            # Get mapped and unmapped assessments
            mapped_assessments = []
            unmapped_assessments = []
            
            for assessment in assessments:
                has_mapped_question = any(q.assessment_id == assessment.id for q in clo_questions)
                
                assessment_data = {
                    'id': str(assessment.id),
                    'title': assessment.title,
                    'weightage': assessment.total_marks
                }
                
                if has_mapped_question:
                    mapped_assessments.append(assessment_data)
                else:
                    unmapped_assessments.append(assessment_data)
            
            clo_summary.append({
                'clo_code': clo.code if hasattr(clo, 'code') else f'CLO-{clo.order_number}',
                'description': clo.description,
                'target_kpi': float(clo.kpi_target),
                'overall_attainment': overall_attainment,
                'status': status,
                'mapped_assessments': mapped_assessments,
                'unmapped_assessments': unmapped_assessments
            })

        # Calculate assessment effectiveness
        for assessment in assessments:
            print(f"\nDEBUG: Calculating effectiveness for assessment: {assessment.title} (id: {assessment.id})")
            assessment_questions = [q for q in questions if q.assessment_id == assessment.id]
            print(f"DEBUG: Found {len(assessment_questions)} questions for this assessment")
            total_assessment_marks = sum(q.marks for q in assessment_questions)
            print(f"DEBUG: total_assessment_marks: {total_assessment_marks}")
            avg_attainment = None
            
            if total_assessment_marks > 0:
                # Calculate per student, then average (like CLOService)
                total_obtained_all = Decimal('0')
                total_possible_all = Decimal('0')
                
                for student in students:
                    student_total = sum(
                        marks_map.get((student.student_id, q.id), Decimal('0'))
                        for q in assessment_questions
                    )
                    total_obtained_all += student_total
                    total_possible_all += total_assessment_marks
                
                if total_possible_all > 0:
                    avg_attainment = round(float((total_obtained_all / total_possible_all) * 100), 2)
                    print(f"DEBUG: total_obtained_all: {total_obtained_all}, total_possible_all: {total_possible_all}, avg_attainment: {avg_attainment}")
            
            # Get mapped CLOs
            mapped_clos = set()
            for q in assessment_questions:
                if q.clo:
                    clo_code = q.clo.code if hasattr(q.clo, 'code') else f'CLO-{q.clo.order_number}'
                    mapped_clos.add(clo_code)
            
            effectiveness = {
                'assessment': {
                    'id': str(assessment.id),
                    'title': assessment.title,
                    'weightage': assessment.total_marks
                },
                'mapped_clos': list(mapped_clos),
                'avg_attainment': avg_attainment,
                'effectiveness': 'EFFECTIVE' if avg_attainment and avg_attainment >= 70 else 'INEFFECTIVE'
            }
            assessment_effectiveness.append(effectiveness)
        
        print(f"DEBUG: clo_summary: {clo_summary}")
        print(f"DEBUG: assessment_effectiveness: {assessment_effectiveness}")
        
        return Response({
            'course': {
                'code': course.code,
                'title': course.name,
                'semester': session.semester.number if session.semester else None,
                'session': str(session.id)
            },
            'clo_summary': clo_summary,
            'assessment_effectiveness': assessment_effectiveness,
            'cqi_list': []
        })
