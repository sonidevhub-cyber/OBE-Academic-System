from rest_framework.views import APIView 
from rest_framework.response import Response 
from rest_framework import status 
from rest_framework.permissions import IsAuthenticated 
from django.db import transaction 
from .models import ( 
    PEO, GA, GAPEOMapping, 
    CLO, CLOGAMapping, 
    CourseSession, CurriculumVersion 
) 
from .serializers import ( 
    PEOSerializer, GASerializer, 
    GAPEOMappingSerializer, 
    CLOSerializer, CLOGAMappingSerializer, 
    CourseSessionSerializer, 
    CurriculumVersionSerializer 
) 
 
 
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
 
    def post(self, request, program_id): 
        print(f"DEBUG: GA POST request for program_id: {program_id}")
        print(f"DEBUG: Request data: {request.data}")
        data = request.data.copy() 
        data['program'] = program_id 
        serializer = GASerializer(data=data) 
        if serializer.is_valid(): 
            serializer.save() 
            return Response( 
                serializer.data, 
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
            return Response(serializer.data) 
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
 
    def get(self, request, course_id, batch_id): 
        clos = CLO.objects.filter( 
            course_id=course_id, 
            batch_id=batch_id, 
            is_active=True 
        ) 
        serializer = CLOSerializer(clos, many=True) 
        return Response(serializer.data) 
 
    def post(self, request, course_id, batch_id): 
        data = request.data.copy() 
        data['course'] = course_id 
        data['batch'] = batch_id 
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
        clo.is_active = False 
        clo.save() 
        return Response({'success': True}) 
 
 
class CLOCopyView(APIView): 
    permission_classes = [IsAuthenticated] 
 
    @transaction.atomic 
    def post( 
        self, request, course_id, batch_id 
    ): 
        source_batch_id = request.data.get( 
            'source_batch_id' 
        ) 
        if not source_batch_id: 
            return Response( 
                {'error': 'source_batch_id required'}, 
                status=status.HTTP_400_BAD_REQUEST 
            ) 
 
        source_clos = CLO.objects.filter( 
            course_id=course_id, 
            batch_id=source_batch_id, 
            is_active=True 
        ) 
 
        if not source_clos.exists(): 
            return Response( 
                {'error': 'No CLOs found in source batch'}, 
                status=status.HTTP_400_BAD_REQUEST 
            ) 
 
        new_clos = [] 
        for clo in source_clos: 
            new_clo = CLO.objects.create( 
                course_id=course_id, 
                batch_id=batch_id, 
                title=clo.title, 
                description=clo.description, 
                order_number=clo.order_number, 
                bloom_level=clo.bloom_level,
                kpi_target=clo.kpi_target 
            ) 
            # Copy GA mappings too 
            for mapping in clo.ga_mappings.filter( 
                is_active=True 
            ): 
                CLOGAMapping.objects.create( 
                    clo=new_clo, 
                    ga=mapping.ga, 
                    weight=mapping.weight 
                ) 
            new_clos.append(new_clo) 
 
        return Response( 
            CLOSerializer( 
                new_clos, many=True 
            ).data, 
            status=status.HTTP_201_CREATED 
        ) 
 
 
# ─── CLO-GA Matrix View ────────────────── 
 
class CLOGAMatrixView(APIView): 
    permission_classes = [IsAuthenticated] 
 
    def get(self, request, course_id, batch_id): 
        clos = CLO.objects.filter( 
            course_id=course_id, 
            batch_id=batch_id, 
            is_active=True 
        ) 
        gas = GA.objects.filter( 
            program__courses__id=course_id, 
            is_active=True 
        ).distinct() 
        mappings = CLOGAMapping.objects.filter( 
            clo__course_id=course_id, 
            clo__batch_id=batch_id, 
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
        self, request, course_id, batch_id 
    ): 
        CLOGAMapping.objects.filter( 
            clo__course_id=course_id, 
            clo__batch_id=batch_id 
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
        sessions = CourseSession.objects.filter( 
            batch_id=batch_id, 
            is_active=True 
        ).select_related( 
            'course', 'batch', 'instructor' 
        ) 
        return Response({ 
            'sessions': CourseSessionSerializer( 
                sessions, many=True 
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
