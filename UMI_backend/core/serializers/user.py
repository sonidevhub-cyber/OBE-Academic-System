import secrets
import string

from django.contrib.auth import get_user_model
from rest_framework import serializers

from core.models.batch import Batch
from core.models.program import Program


User = get_user_model()


class UserListSerializer(serializers.ModelSerializer):
    role_display = serializers.SerializerMethodField()
    programs_list = serializers.SerializerMethodField()
    batch_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'custom_id',
            'full_name',
            'email',
            'role',
            'secondary_role',
            'role_display',
            'programs_list',
            'batch_name',
            'is_active',
            'designation',
            'phone',
            'profile_pic',
            'promotion_status',
            'current_semester',
            'created_at',
        ]

    def get_role_display(self, obj):
        if obj.secondary_role != 'none':
            return f"{obj.role} + {obj.secondary_role}"
        return obj.role

    def get_programs_list(self, obj):
        return [p.name for p in obj.programs.all()]

    def get_batch_name(self, obj):
        return obj.batch.name if obj.batch else None


class UserCreateSerializer(serializers.ModelSerializer):
    programs = serializers.PrimaryKeyRelatedField(queryset=Program.objects.all(), many=True, required=False)
    batch = serializers.PrimaryKeyRelatedField(queryset=Batch.objects.all(), required=False, allow_null=True)
    password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ['full_name', 'email', 'role', 'secondary_role', 'programs', 'batch', 'password', 'designation', 'phone', 'profile_pic']

    def validate(self, attrs):
        role = attrs.get('role')
        secondary_role = attrs.get('secondary_role', 'none')
        programs = attrs.get('programs', [])
        batch = attrs.get('batch')

        if role == 'SAC':
            raise serializers.ValidationError('SAC created via CLI only')

        if role == 'tvf':
            attrs['secondary_role'] = 'none'
            attrs['programs'] = []
            attrs['batch'] = None
            attrs['designation'] = 'Visiting Faculty'
            return attrs

        if role in ['student', 'alumni']:
            if not batch:
                raise serializers.ValidationError('batch is required')
            attrs['programs'] = []
            attrs['secondary_role'] = 'none'
            return attrs

        is_coordinator = role == 'coordinator' or secondary_role == 'coordinator'
        if is_coordinator:
            if not programs:
                raise serializers.ValidationError('programs is required for coordinator')
        else:
            if programs:
                raise serializers.ValidationError('Only coordinator users can have programs assigned')

        if secondary_role != 'none' and secondary_role == role:
            raise serializers.ValidationError('Primary and secondary role cannot be same')

        return attrs

    def create(self, validated_data):
        programs = validated_data.pop('programs', [])
        password = validated_data.pop('password')

        user = User.objects.create_user(
            email=validated_data['email'],
            full_name=validated_data['full_name'],
            password=password,
            role=validated_data['role'],
            secondary_role=validated_data.get('secondary_role', 'none'),
            batch=validated_data.get('batch'),
            designation=validated_data.get('designation'),
            phone=validated_data.get('phone'),
            profile_pic=validated_data.get('profile_pic'),
            must_change_password=False,
        )

        if programs:
            user.programs.set(programs)

        user.generated_password = password
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    programs = serializers.PrimaryKeyRelatedField(queryset=Program.objects.all(), many=True, required=False)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['full_name', 'email', 'role', 'secondary_role', 'programs', 'designation', 'phone', 'profile_pic', 'is_active', 'password']

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        programs = validated_data.pop('programs', None)
        
        # Update standard fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            
        # Update password if provided
        if password:
            instance.set_password(password)
            
        instance.save()
        
        # Update M2M programs if provided
        if programs is not None:
            instance.programs.set(programs)
            
        return instance


