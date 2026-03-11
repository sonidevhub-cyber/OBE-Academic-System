from rest_framework.decorators import api_view
from rest_framework.response import Response
import psutil
import time
from django.db import connection

@api_view(['GET'])
def system_health(request):
    # Server status - for simplicity, assume always online
    server_status = 'online'

    # Database status - check if connection is usable
    try:
        connection.ensure_connection()
        database_status = 'online'
    except Exception:
        database_status = 'offline'

    # API response time - simulate with a small delay measurement
    start_time = time.time()
    # Simulate a quick operation
    time.sleep(0.01)
    api_response_time = int((time.time() - start_time) * 1000)  # in ms

    # Memory usage
    memory = psutil.virtual_memory()
    memory_usage = int(memory.percent)

    # CPU usage
    cpu_usage = int(psutil.cpu_percent(interval=0.1))

    # Active users - placeholder, should be replaced with real data
    active_users = 1247

    # Total requests - placeholder, should be replaced with real data
    total_requests = 15420

    # Error rate - placeholder, should be replaced with real data
    error_rate = 0.02

    data = {
        'serverStatus': server_status,
        'databaseStatus': database_status,
        'apiResponseTime': api_response_time,
        'memoryUsage': memory_usage,
        'cpuUsage': cpu_usage,
        'activeUsers': active_users,
        'totalRequests': total_requests,
        'errorRate': error_rate,
    }
    return Response(data)
