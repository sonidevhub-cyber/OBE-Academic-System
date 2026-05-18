from rest_framework import generics, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Program, Batch
from .serializers import ProgramSerializer, BatchSerializer


class ProgramViewSet(viewsets.ModelViewSet):
    queryset = Program.objects.all()
    serializer_class = ProgramSerializer


class BatchViewSet(viewsets.ModelViewSet):
    queryset = Batch.objects.all()
    serializer_class = BatchSerializer


class BatchDetailView(generics.RetrieveAPIView):
    queryset = Batch.objects.all()
    serializer_class = BatchSerializer


class AllBatchesView(APIView):
    """Return a lightweight list for dropdowns."""

    def get(self, request, *args, **kwargs):
        # Match Frontend expectation (Flat): id, name, program_name
        qs = Batch.objects.select_related('program').filter(is_active=True)
        data = [
            {
                'id': str(b.id),
                'name': b.name,
                'program_name': b.program.name,
            }
            for b in qs
        ]
        return Response(data)


