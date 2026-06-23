from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from ..models import PEO, GAPEOMapping, GA
from ..serializers import PEOSerializer, GAPEOMappingSerializer, GASerializer


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

