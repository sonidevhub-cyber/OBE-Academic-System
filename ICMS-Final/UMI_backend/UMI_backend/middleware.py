"""
Custom CORS middleware to ensure proper CORS headers are set.
"""
from django.utils.deprecation import MiddlewareMixin


class CustomCorsMiddleware(MiddlewareMixin):
    """
    Custom CORS middleware to handle cross-origin requests.
    This ensures that CORS headers are properly set for all responses.
    """
    
    def process_response(self, request, response):
        # Get the origin header from the request
        origin = request.META.get('HTTP_ORIGIN')
        
        # Only add CORS headers if origin is present and allowed
        allowed_origins = [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3001',
        ]
        
        if origin and origin in allowed_origins:
            response['Access-Control-Allow-Origin'] = origin
            response['Access-Control-Allow-Credentials'] = 'true'
            response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-CSRFToken, X-Requested-With, Accept, Origin, User-Agent, DNT, If-Modified-Since, Cache-Control'
            response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
            response['Access-Control-Max-Age'] = '86400'
        
        return response


class CorsForAPIOnlyMiddleware(MiddlewareMixin):
    """
    Middleware that only adds CORS headers for API endpoints.
    """
    
    def process_response(self, request, response):
        # Only apply to API requests
        if not request.path.startswith('/api/'):
            return response
            
        # Get origin from various possible header names
        origin = request.META.get('HTTP_ORIGIN') or request.META.get('HTTP_ACCESS_CONTROL_REQUEST_ORIGIN')
        
        allowed_origins = [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3001',
        ]
        
        # If origin is not in allowed list but request is from localhost:3000, allow it
        if origin not in allowed_origins:
            # Check if it starts with http://localhost: or http://127.0.0.1:
            if origin and ('localhost:300' in origin or '127.0.0.1:300' in origin):
                # Allow localhost:3000/3001 ports
                if ':3000' in origin or ':3001' in origin:
                    allowed_origins.append(origin)
        
        if origin and origin in allowed_origins:
            response['Access-Control-Allow-Origin'] = origin
            response['Access-Control-Allow-Credentials'] = 'true'
            response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-CSRFToken, X-Requested-With, Accept, Origin, User-Agent'
            response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
            response['Access-Control-Max-Age'] = '86400'
        
        return response
