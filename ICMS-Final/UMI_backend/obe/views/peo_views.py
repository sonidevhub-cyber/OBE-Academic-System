from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
from core.models import Batch
from students.models import Student
from ..models import PEO, GAPEOMapping, GA, AlumniSurveyQuestion, AlumniSurveyCycle, AlumniSurveyResponse, get_peo_indirect_score
from ..serializers import PEOSerializer, GAPEOMappingSerializer, GASerializer, AlumniSurveyQuestionSerializer, AlumniSurveyCycleSerializer, AlumniSurveyResponseSerializer


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
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can create PEOs'}, status=status.HTTP_403_FORBIDDEN)
            
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
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can update PEOs'}, status=status.HTTP_403_FORBIDDEN)
            
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
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can delete PEOs'}, status=status.HTTP_403_FORBIDDEN)
            
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
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can update GA-PEO mappings'}, status=status.HTTP_403_FORBIDDEN)
            
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


# ========== ALUMNI SURVEY VIEWS ==========

class PEOAlumniSurveyQuestionListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, peo_id):
        try:
            peo = PEO.objects.get(id=peo_id, is_active=True)
        except PEO.DoesNotExist:
            return Response({'error': 'PEO not found'}, status=status.HTTP_404_NOT_FOUND)
        
        questions = AlumniSurveyQuestion.objects.filter(peo=peo, is_active=True).order_by('-created_at')
        return Response(AlumniSurveyQuestionSerializer(questions, many=True).data)


class AlumniSurveyQuestionDetailView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get_object(self, pk):
        try:
            return AlumniSurveyQuestion.objects.get(id=pk, is_active=True)
        except AlumniSurveyQuestion.DoesNotExist:
            return None
    
    def get(self, request, pk):
        question = self.get_object(pk)
        if not question:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(AlumniSurveyQuestionSerializer(question).data)
    
    @transaction.atomic
    def patch(self, request, pk):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_hod = (user_role == 'hod') or (user_secondary_role == 'hod')
        
        if not is_hod:
            return Response({'error': 'Only HODs can update alumni survey questions'}, status=status.HTTP_403_FORBIDDEN)
            
        question = self.get_object(pk)
        if not question:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        
        if question.is_locked and 'is_locked' not in request.data and 'is_active' not in request.data:
            return Response({'error': 'Question is locked and cannot be edited'}, status=status.HTTP_403_FORBIDDEN)
            
        serializer = AlumniSurveyQuestionSerializer(question, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(AlumniSurveyQuestionSerializer(question).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AlumniSurveyCycleListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
            
        cycles = AlumniSurveyCycle.objects.filter(batch=batch, is_active=True).order_by('-created_at')
        return Response(AlumniSurveyCycleSerializer(cycles, many=True).data)


class AlumniSurveyCycleCreateView(APIView):
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request, batch_id):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_coordinator = (user_role == 'coordinator') or (user_secondary_role == 'coordinator')
        
        if not is_coordinator:
            return Response({'error': 'Only coordinators can create alumni survey cycles'}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
        survey_window = request.data.get('survey_window')
        if not survey_window:
            return Response({'error': 'survey_window is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if there's already an active cycle for this window
        active_cycle = AlumniSurveyCycle.objects.filter(
            batch=batch, 
            survey_window=survey_window, 
            status='ACTIVE', 
            is_active=True
        ).first()
        if active_cycle:
            return Response({'error': 'There is already an active alumni survey cycle for this window and batch'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Create new cycle
        cycle = AlumniSurveyCycle.objects.create(
            batch=batch,
            survey_window=survey_window,
            status='DRAFT'
        )
        
        return Response(AlumniSurveyCycleSerializer(cycle).data, status=status.HTTP_201_CREATED)


class AlumniSurveyCycleActivateView(APIView):
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request, cycle_id):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_coordinator = (user_role == 'coordinator') or (user_secondary_role == 'coordinator')
        
        if not is_coordinator:
            return Response({'error': 'Only coordinators can activate alumni surveys'}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            cycle = AlumniSurveyCycle.objects.get(id=cycle_id, is_active=True)
        except AlumniSurveyCycle.DoesNotExist:
            return Response({'error': 'Cycle not found'}, status=status.HTTP_404_NOT_FOUND)
            
        if cycle.status != 'DRAFT':
            return Response({'error': 'Only draft cycles can be activated'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Get all locked and active alumni survey questions for the program
        questions = AlumniSurveyQuestion.objects.filter(
            peo__program=cycle.batch.program,
            is_locked=True,
            is_active=True
        )
        if not questions.exists():
            return Response({'error': 'No locked alumni survey questions found for this program'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Activate the cycle
        cycle.status = 'ACTIVE'
        cycle.activated_by = request.user
        cycle.activated_at = timezone.now()
        cycle.save()
        
        return Response(AlumniSurveyCycleSerializer(cycle).data)


class AlumniSurveyCycleCloseView(APIView):
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request, cycle_id):
        user_role = request.user.role
        user_secondary_role = request.user.secondary_role
        is_coordinator = (user_role == 'coordinator') or (user_secondary_role == 'coordinator')
        
        if not is_coordinator:
            return Response({'error': 'Only coordinators can close alumni surveys'}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            cycle = AlumniSurveyCycle.objects.get(id=cycle_id, is_active=True)
        except AlumniSurveyCycle.DoesNotExist:
            return Response({'error': 'Cycle not found'}, status=status.HTTP_404_NOT_FOUND)
            
        if cycle.status != 'ACTIVE':
            return Response({'error': 'Only active cycles can be closed'}, status=status.HTTP_400_BAD_REQUEST)
            
        cycle.status = 'CLOSED'
        cycle.closed_at = timezone.now()
        cycle.save()
        
        return Response(AlumniSurveyCycleSerializer(cycle).data)


class AlumniSurveyResponseView(APIView):
    permission_classes = []
    
    def get(self, request, cycle_id):
        try:
            cycle = AlumniSurveyCycle.objects.get(id=cycle_id, status='ACTIVE', is_active=True)
        except AlumniSurveyCycle.DoesNotExist:
            return Response({'error': 'Active cycle not found'}, status=status.HTTP_404_NOT_FOUND)
            
        questions = AlumniSurveyQuestion.objects.filter(
            peo__program=cycle.batch.program,
            is_locked=True,
            is_active=True
        )
        return Response(AlumniSurveyQuestionSerializer(questions, many=True).data)
    
    @transaction.atomic
    def post(self, request, cycle_id, student_id):
        try:
            cycle = AlumniSurveyCycle.objects.get(id=cycle_id, status='ACTIVE', is_active=True)
            student = Student.objects.get(id=student_id)
        except (AlumniSurveyCycle.DoesNotExist, Student.DoesNotExist):
            return Response({'error': 'Cycle or student not found'}, status=status.HTTP_404_NOT_FOUND)
            
        responses_data = request.data.get('responses', [])
        for resp_data in responses_data:
            question_id = resp_data.get('question')
            score = resp_data.get('score')
            
            try:
                question = AlumniSurveyQuestion.objects.get(id=question_id, is_locked=True, is_active=True)
            except AlumniSurveyQuestion.DoesNotExist:
                continue
                
            AlumniSurveyResponse.objects.update_or_create(
                cycle=cycle,
                student=student,
                question=question,
                defaults={'score': score}
            )
            
        return Response({'success': True})


class PEOIndirectScoreView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, peo_id, batch_id):
        try:
            peo = PEO.objects.get(id=peo_id, is_active=True)
            batch = Batch.objects.get(id=batch_id, is_active=True)
        except (PEO.DoesNotExist, Batch.DoesNotExist):
            return Response({'error': 'PEO or Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        
        survey_window = request.query_params.get('survey_window')
        indirect_score_data = get_peo_indirect_score(peo_id, batch_id, survey_window)
        return Response(indirect_score_data)

