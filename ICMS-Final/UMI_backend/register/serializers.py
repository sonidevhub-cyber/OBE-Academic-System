from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    """Serializer for user data with multi-role support"""
    capabilities = serializers.SerializerMethodField()
    effective_role = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'name', 'role', 'roles', 'active_role',
            'profile_image', 'is_coordinator', 'capabilities', 'effective_role'
        ]
        read_only_fields = ['id', 'capabilities', 'effective_role']
    
    def get_capabilities(self, obj):
        from .multi_role_service import MultiRoleService
        return MultiRoleService.get_user_capabilities(obj)
    
    def get_effective_role(self, obj):
        return obj.active_role or obj.role

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    
    # HOD specific fields
    employee_id = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    department_id = serializers.IntegerField(required=False)
    designation = serializers.CharField(required=False, allow_blank=True)
    experience_years = serializers.IntegerField(required=False)
    specialization = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'confirm_password',
            'role', 'name', 'first_name', 'last_name',
            'employee_id', 'phone', 'department_id', 'designation', 
            'experience_years', 'specialization'
        ]

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError("Passwords do not match.")

        # Check if username already exists
        if User.objects.filter(username=data['username']).exists():
            raise serializers.ValidationError({"username": "A user with this username already exists."})

        # HOD specific validation
        if data.get('role') == 'hod':
            required_fields = {
                'employee_id': data.get('employee_id'),
                'phone': data.get('phone'),
                'department_id': data.get('department_id'),
                'specialization': data.get('specialization')
            }
            missing_fields = [field for field, value in required_fields.items() 
                            if not value or (field == 'department_id' and value == 0)]
            if missing_fields:
                raise serializers.ValidationError({
                    "hod_fields": f"Required fields for HOD registration: {', '.join(missing_fields)}"
                })

        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        
        # Extract HOD specific fields
        employee_id = validated_data.pop('employee_id', None)
        phone = validated_data.pop('phone', None)
        department_id = validated_data.pop('department_id', None)
        designation = validated_data.pop('designation', None)
        experience_years = validated_data.pop('experience_years', 0)
        specialization = validated_data.pop('specialization', None)
        
        # combine first_name + last_name → name
        first_name = validated_data.pop('first_name', '')
        last_name = validated_data.pop('last_name', '')
        full_name = f"{first_name} {last_name}".strip()
        
        # If role is HOD, redirect to HOD registration
        if validated_data.get('role') == 'hod':
            raise serializers.ValidationError({
                "role": "HOD registration should be done through the HOD registration endpoint."
            })

        # Regular user creation
        user = User(
            username=validated_data['username'],
            email=validated_data.get('email'),
            role=validated_data.get('role'),
            name=full_name or validated_data.get('name', ''),
            first_name=first_name,
            last_name=last_name,
        )
        user.set_password(validated_data['password'])
        user.save()
        return user



