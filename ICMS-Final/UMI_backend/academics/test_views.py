from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

class TestHODView(APIView):
    """Simple test view to verify HOD endpoint is working"""
    
    def get(self, request):
        return Response({
            'message': 'HOD test endpoint is working',
            'user': str(request.user),
            'authenticated': request.user.is_authenticated
        }, status=status.HTTP_200_OK)