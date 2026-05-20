<<<<<<< HEAD
from rest_framework import generics, permissions, viewsets
from rest_framework.permissions import AllowAny
from .models import Program, Batch
from .serializers import ProgramSerializer, BatchSerializer

=======
from rest_framework import generics, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Program, Batch
from .serializers import ProgramSerializer, BatchSerializer


>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
class ProgramViewSet(viewsets.ModelViewSet):
    queryset = Program.objects.all()
    serializer_class = ProgramSerializer

<<<<<<< HEAD
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [permissions.IsAuthenticated()]
=======
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03

class BatchViewSet(viewsets.ModelViewSet):
    queryset = Batch.objects.all()
    serializer_class = BatchSerializer

<<<<<<< HEAD
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = Batch.objects.all()
        program_id = self.request.query_params.get('program', None)
        if program_id:
            queryset = queryset.filter(program_id=program_id)
        return queryset
=======
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03

class BatchDetailView(generics.RetrieveAPIView):
    queryset = Batch.objects.all()
    serializer_class = BatchSerializer
<<<<<<< HEAD
=======


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


>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
