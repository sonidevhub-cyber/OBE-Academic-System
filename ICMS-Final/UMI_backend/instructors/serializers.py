from rest_framework import serializers
from .models import Instructor

class InstructorSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    department_id = serializers.IntegerField(write_only=True, required=False)
    image = serializers.SerializerMethodField()
    
    def get_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    class Meta:
        model = Instructor
        fields = ['id', 'user', 'employee_id', 'name', 'phone', 'password', 'department', 'department_id', 'designation', 'hire_date', 'date_of_birth', 'gender', 'blood_group', 'salary', 'specialization', 'address', 'experience_years', 'image', 'ai_profile_notes', 'ai_last_generated', 'user_email', 'department_name']
        read_only_fields = ['user', 'user_email', 'department_name']

    def create(self, validated_data):
        department_id = validated_data.pop('department_id', None)
        if department_id:
            from academics.models import Department
            try:
                department = Department.objects.get(department_id=department_id)
                validated_data['department'] = department
            except Department.DoesNotExist:
                raise serializers.ValidationError("Invalid department ID")
        return super().create(validated_data)

    def update(self, instance, validated_data):
        department_id = validated_data.pop('department_id', None)
        if department_id:
            from academics.models import Department
            try:
                department = Department.objects.get(department_id=department_id)
                validated_data['department'] = department
            except Department.DoesNotExist:
                raise serializers.ValidationError("Invalid department ID")
        return super().update(instance, validated_data)
