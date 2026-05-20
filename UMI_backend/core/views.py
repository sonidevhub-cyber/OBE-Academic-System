from django.http import JsonResponse
from .models import CustomUser

def check_user_role(request, email):
    try:
        user = CustomUser.objects.get(email=email)
        return JsonResponse({'email': user.email, 'role': user.role})
    except CustomUser.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)