from rest_framework import serializers 
from curriculum.models import CurriculumVersion
from .models import ( 
    PEO, GA, GAPEOMapping, 
    CLO, CLOGAMapping, 
    PerformanceIndicator, CLOPIMapping,
    CourseSession
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
 
 
class PerformanceIndicatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = PerformanceIndicator
        fields = ['id', 'ga', 'code', 'description', 'kpi', 'created_at']
        read_only_fields = ['id', 'created_at']


class GASerializer(serializers.ModelSerializer): 
    performance_indicators = PerformanceIndicatorSerializer(many=True, read_only=True)

    class Meta: 
        model = GA 
        fields = [ 
            'id', 'program', 'title', 
            'description', 'order_number', 'kpi_target',
            'performance_indicators',
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
    version_no = serializers.CharField( 
        source='curriculum_version.version_no', read_only=True 
    ) 
 
    class Meta: 
        model = CLO 
        fields = [ 
            'id', 'course', 'curriculum_version', 
            'course_name', 'version_no', 
            'title', 'description', 
            'order_number', 'bloom_level', 'kpi_target', 
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
 
 
class CLOPIMappingSerializer(serializers.ModelSerializer):
    clo_title = serializers.CharField(source='clo.title', read_only=True)
    pi_code = serializers.CharField(source='pi.code', read_only=True)
    weight_display = serializers.CharField(source='get_weight_display', read_only=True)

    class Meta:
        model = CLOPIMapping
        fields = [
            'id', 'clo', 'pi', 'weight',
            'clo_title', 'pi_code',
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
    semester_name = serializers.CharField( 
        source='semester.name', read_only=True 
    ) 
    instructor_name = serializers.CharField( 
        source='instructor.full_name', 
        read_only=True 
    ) 
 
    class Meta: 
        model = CourseSession 
        fields = [ 
            'id', 'course', 'batch', 'semester',
            'instructor', 'course_name', 
            'batch_name', 'semester_name', 'instructor_name', 
            'is_active', 'created_at' 
        ] 
        read_only_fields = ['id', 'created_at'] 
 
 
class CurriculumVersionSerializer( 
    serializers.ModelSerializer 
): 
    batch_name = serializers.CharField( 
        source='batch.name', read_only=True 
    ) 
 
    class Meta: 
        model = CurriculumVersion 
        fields = [ 
            'id', 'batch', 
            'batch_name', 'version_no', 
            'status', 'is_active', 'created_at' 
        ] 
        read_only_fields = ['id', 'created_at'] 
