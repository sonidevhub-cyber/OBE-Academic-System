from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Notice
from .serializers import NoticeSerializer


# 🔥 HOD CREATE NOTICE
class CreateNoticeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = NoticeSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data)

        return Response(serializer.errors, status=400)


# 🔥 PUBLIC NOTICE BOARD (MAIN PAGE)
class NoticeBoardView(APIView):

    def get(self, request):
        data = Notice.objects.all().order_by('-created_at')
        return Response(NoticeSerializer(data, many=True).data)