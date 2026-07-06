from rest_framework import generics, permissions, viewsets
from rest_framework.permissions import AllowAny
from core.models import Program, Batch
from .serializers import ProgramSerializer, BatchSerializer

class ProgramViewSet(viewsets.ModelViewSet):
    queryset = Program.objects.all()
    serializer_class = ProgramSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [permissions.IsAuthenticated()]

class BatchViewSet(viewsets.ModelViewSet):
    queryset = Batch.objects.all()
    serializer_class = BatchSerializer

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

class BatchDetailView(generics.RetrieveAPIView):
    queryset = Batch.objects.all()
    serializer_class = BatchSerializer
