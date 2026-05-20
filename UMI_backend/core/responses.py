from rest_framework.response import Response
from rest_framework import status

def api_response(data=None, message="", status_code=status.HTTP_200_OK):
    return Response({
        "data": data,
        "message": message,
        "status_code": status_code
    }, status=status_code)
