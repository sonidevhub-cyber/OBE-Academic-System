from rest_framework import serializers 
from .models import ( 
    PEO, GA, GAPEOMapping, 
    CLO, CLOGAMapping, 
    CourseSession, CurriculumVersion 
) 
 
 
class PEOSerializer(serializers.ModelSerializer): 
    class Meta: 
        model = PEO 
        fields = [ 
            'id', 'program', 'title', 
            'description', 'order_number', 
            'is_active', 'created_at' 
        ] 
        read_only_fields = ['id', 'created_at'] 
 
 
class GASerializer(serializers.ModelSerializer): 
    class Meta: 
        model = GA 
        fields = [ 
            'id', 'program', 'code', 'title', 
            'description', 'order_number', 
            'is_active', 'created_at' 
        ] 
        read_only_fields = ['id', 'created_at'] 

 
 
class GAPEOMappingSerializer( 
    serializers.ModelSerializer 
): 
    ga_title = serializers.CharField( 
        source='ga.title', read_only=True 
    ) 
    peo_title = serializers.CharField( 
        source='peo.title', read_only=True 
    ) 
 
    class Meta: 
        model = GAPEOMapping 
        fields = [ 
            'id', 'ga', 'peo', 
            'ga_title', 'peo_title', 
            'is_active', 'created_at' 
        ] 
        read_only_fields = ['id', 'created_at'] 
 
 
class CLOSerializer(serializers.ModelSerializer): 
    course_name = serializers.CharField( 
        source='course.name', read_only=True 
    ) 
    batch_name = serializers.CharField( 
        source='batch.name', read_only=True 
    ) 
 
    class Meta: 
        model = CLO 
        fields = [ 
            'id', 'course', 'batch', 
            'course_name', 'batch_name', 
            'title', 'description', 
            'order_number', 'kpi_target', 
            'is_active', 'created_at' 
        ] 
        read_only_fields = ['id', 'created_at'] 
 
 
class CLOGAMappingSerializer( 
    serializers.ModelSerializer 
): 
    clo_title = serializers.CharField( 
        source='clo.title', read_only=True 
    ) 
    ga_title = serializers.CharField( 
        source='ga.title', read_only=True 
    ) 
    weight_display = serializers.CharField( 
        source='get_weight_display', 
        read_only=True 
    ) 
 
    class Meta: 
        model = CLOGAMapping 
        fields = [ 
            'id', 'clo', 'ga', 'weight', 
            'clo_title', 'ga_title', 
            'weight_display', 'is_active', 
            'created_at' 
        ] 
        read_only_fields = ['id', 'created_at'] 
 
 
class CourseSessionSerializer( 
    serializers.ModelSerializer 
): 
    course_name = serializers.CharField( 
        source='course.name', read_only=True 
    ) 
    batch_name = serializers.CharField( 
        source='batch.name', read_only=True 
    ) 
    instructor_name = serializers.CharField( 
        source='instructor.name', 
        read_only=True 
    ) 
 
    class Meta: 
        model = CourseSession 
        fields = [ 
            'id', 'course', 'batch', 
            'instructor', 'course_name', 
            'batch_name', 'instructor_name', 
            'academic_year', 'semester_number', 
            'status', 'is_active', 'created_at' 
        ] 
        read_only_fields = ['id', 'created_at'] 
 
 
class CurriculumVersionSerializer( 
    serializers.ModelSerializer 
): 
    batch_name = serializers.CharField( 
        source='batch.name', read_only=True 
    ) 
    course_name = serializers.CharField( 
        source='course.name', read_only=True 
    ) 
 
    class Meta: 
        model = CurriculumVersion 
        fields = [ 
            'id', 'batch', 'course', 
            'batch_name', 'course_name', 
            'action', 'semester_number', 
            'note', 'is_active', 'created_at' 
        ] 
        read_only_fields = ['id', 'created_at'] 
