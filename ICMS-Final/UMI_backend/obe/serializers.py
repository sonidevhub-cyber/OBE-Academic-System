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
<<<<<<< HEAD
            'id', 'program', 'title', 
=======
            'id', 'program', 'code', 'title', 
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
            'description', 'order_number', 
            'is_active', 'created_at' 
        ] 
        read_only_fields = ['id', 'created_at'] 
<<<<<<< HEAD
=======

>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
 
 
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
<<<<<<< HEAD
            'order_number', 'bloom_level', 'kpi_target', 
=======
            'order_number', 'kpi_target', 
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
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
<<<<<<< HEAD
    semester_name = serializers.CharField( 
        source='semester.name', read_only=True 
    ) 
    instructor_name = serializers.CharField( 
        source='instructor.full_name', 
=======
    instructor_name = serializers.CharField( 
        source='instructor.name', 
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
        read_only=True 
    ) 
 
    class Meta: 
        model = CourseSession 
        fields = [ 
<<<<<<< HEAD
            'id', 'course', 'batch', 'semester',
            'instructor', 'course_name', 
            'batch_name', 'semester_name', 'instructor_name', 
            'is_active', 'created_at' 
=======
            'id', 'course', 'batch', 
            'instructor', 'course_name', 
            'batch_name', 'instructor_name', 
            'academic_year', 'semester_number', 
            'status', 'is_active', 'created_at' 
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
        ] 
        read_only_fields = ['id', 'created_at'] 
 
 
class CurriculumVersionSerializer( 
    serializers.ModelSerializer 
): 
    batch_name = serializers.CharField( 
        source='batch.name', read_only=True 
    ) 
<<<<<<< HEAD
=======
    course_name = serializers.CharField( 
        source='course.name', read_only=True 
    ) 
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
 
    class Meta: 
        model = CurriculumVersion 
        fields = [ 
<<<<<<< HEAD
            'id', 'batch', 
            'batch_name', 'version_number', 
            'is_effective', 'is_active', 'created_at' 
=======
            'id', 'batch', 'course', 
            'batch_name', 'course_name', 
            'action', 'semester_number', 
            'note', 'is_active', 'created_at' 
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
        ] 
        read_only_fields = ['id', 'created_at'] 
