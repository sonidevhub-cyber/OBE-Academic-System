from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db import transaction
from .models import Student
from core.models.batch import Batch

User = get_user_model()

class StudentSerializer(serializers.ModelSerializer):
    # User fields
    first_name = serializers.CharField(write_only=True, required=False)
    last_name = serializers.CharField(write_only=True, required=False)
    email = serializers.EmailField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False)
    batch = serializers.PrimaryKeyRelatedField(queryset=Batch.objects.all(), write_only=True, required=False)
    
    # Read only user fields for representation
    user_email = serializers.EmailField(source='user.email', read_only=True)
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    role = serializers.CharField(source='user.role', read_only=True)
    batch_id = serializers.UUIDField(source='user.batch.id', read_only=True)
    batch_name = serializers.CharField(source='user.batch.name', read_only=True)
    program_id = serializers.UUIDField(source='user.batch.program.id', read_only=True)
    program_name = serializers.CharField(source='user.batch.program.name', read_only=True)
    program_code = serializers.CharField(source='user.batch.program.code', read_only=True)
    courses = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'student_id', 'custom_id', 'first_name', 'last_name', 'email', 'password', 'batch',
            'registration_number', 'name', 'department', 'phone', 'date_of_birth',
            'gender', 'blood_group', 'guardian_name', 'guardian_contact', 'address',
            'user_email', 'full_name', 'role', 'batch_id', 'batch_name', 'program_id', 
            'program_name', 'program_code', 'image', 'courses'
        ]
        read_only_fields = ['student_id', 'name']

    def get_courses(self, obj):
        if not obj.user or not obj.user.batch or not obj.user.batch.curriculum_version:
            return []
        
        version = obj.user.batch.curriculum_version
        # Get ALL courses from the curriculum version, not just current semester
        courses = version.version_courses.all()
        
        return [{
            'course_id': vc.course.id,
            'name': vc.course.name,
            'code': vc.course.code,
            'credit_hours': vc.course.credit_hours,
            'semester_no': vc.semester_no
        } for vc in courses]

    def validate_email(self, value):
        user_id = self.instance.user.id if self.instance else None
        if User.objects.exclude(id=user_id).filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_registration_number(self, value):
        student_id = self.instance.student_id if self.instance else None
        if Student.objects.exclude(student_id=student_id).filter(registration_number=value).exists():
            raise serializers.ValidationError("A student with this registration number already exists.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        first_name = validated_data.pop('first_name', '')
        last_name = validated_data.pop('last_name', '')
        email = validated_data.pop('email')
        password = validated_data.pop('password')
        batch = validated_data.pop('batch', None)
        registration_number = validated_data.get('registration_number')
        
        full_name = f"{first_name} {last_name}".strip()
        
        # Create CustomUser
        user = User.objects.create_user(
            email=email,
            full_name=full_name,
            password=password,
            role='student',
            batch=batch,
            custom_id=registration_number # Ensure User custom_id matches Reg Num
        )
        
        # Create Student profile
        student = Student.objects.create(
            user=user,
            name=full_name,
            custom_id=registration_number, # Ensure Student custom_id matches Reg Num
            **validated_data
        )
        
        return student

    @transaction.atomic
    def update(self, instance, validated_data):
        first_name = validated_data.pop('first_name', None)
        last_name = validated_data.pop('last_name', None)
        email = validated_data.pop('email', None)
        password = validated_data.pop('password', None)
        batch = validated_data.pop('batch', None)
        
        # Update User model if fields are provided
        user = instance.user
        user_updated = False
        
        if first_name is not None or last_name is not None:
            # Reconstruct full name if either name part is provided
            current_first = first_name if first_name is not None else user.full_name.split(' ')[0]
            current_last = last_name if last_name is not None else ' '.join(user.full_name.split(' ')[1:])
            user.full_name = f"{current_first} {current_last}".strip()
            instance.name = user.full_name
            user_updated = True
            
        if email:
            user.email = email
            user_updated = True
            
        if password:
            user.set_password(password)
            user_updated = True
            
        if batch:
            user.batch = batch
            user_updated = True
            
        if user_updated:
            user.save()
            
        # Update Student model
        registration_number = validated_data.get('registration_number')
        if registration_number:
            instance.custom_id = registration_number
            user.custom_id = registration_number
            user.save(update_fields=['custom_id'])

        return super().update(instance, validated_data)
