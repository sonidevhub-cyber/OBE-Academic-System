from rest_framework import serializers
from .models import HOD, HODRegistrationRequest
from register.models import User

class HODRegistrationRequestSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = HODRegistrationRequest
        fields = ['id', 'name', 'email', 'employee_id', 'phone', 'department',
                 'department_name', 'designation', 'experience_years', 'specialization',
                 'status', 'requested_at', 'reviewed_at', 'rejection_reason', 'hod_request_status',
                 'image', 'hire_date', 'retired_date']
        read_only_fields = ['id', 'status', 'requested_at', 'reviewed_at', 'hod_request_status']
    
    def get_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class HODSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    department = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    username = serializers.SerializerMethodField()
    joining_date = serializers.DateField(source='hire_date', read_only=True)
    status = serializers.SerializerMethodField()
    
    class Meta:
        model = HOD
        fields = ['id', 'name', 'email', 'phone', 'department', 'department_name',
                 'designation', 'specialization', 'experience_years', 'hire_date', 'joining_date',
                 'retirement_date', 'image', 'is_active', 'created_at', 'updated_at', 'employee_id', 'username', 'status']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_department(self, obj):
        if obj.department:
            return {
                'id': obj.department.department_id,
                'name': obj.department.name,
                'code': getattr(obj.department, 'code', ''),
                'department_id': obj.department.department_id
            }
        return None
    
    def get_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None
    
    def get_username(self, obj):
        if obj.user:
            return obj.user.username
        return None
    
    def get_status(self, obj):
        """Return the status based on is_active field"""
        return 'active' if obj.is_active else 'retired'


class HODRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    department_id = serializers.IntegerField()

    class Meta:
        model = HODRegistrationRequest
        fields = [
            'name', 'email', 'employee_id', 'phone', 'department_id',
            'designation', 'experience_years', 'specialization',
            'password', 'confirm_password'
        ]

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError("Passwords do not match.")
        
        # Check if email already exists
        if User.objects.filter(email=data['email']).exists():
            raise serializers.ValidationError({"email": "A user with this email already exists."})
        
        # Check if employee_id already exists
        if HODRegistrationRequest.objects.filter(employee_id=data['employee_id']).exists():
            raise serializers.ValidationError({"employee_id": "A HOD with this employee ID already exists."})
        
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        department_id = validated_data.pop('department_id')
        
        from academics.models import Department
        try:
            department = Department.objects.get(department_id=department_id)
        except Department.DoesNotExist:
            raise serializers.ValidationError({"department_id": "Invalid department."})
        
        hod_request = HODRegistrationRequest.objects.create(
            department=department,
            **validated_data
        )
        
        return hod_request
