from rest_framework import serializers
from .models import Instructor

class InstructorSerializer(serializers.ModelSerializer):
    custom_id = serializers.ReadOnlyField(source='user.custom_id')
    user_email = serializers.ReadOnlyField(source='user.email')
    
    class Meta:
        model = Instructor
        fields = [
            'id', 'custom_id', 'user', 'name', 'email', 'phone', 
            'department', 'department_name', 'employment_type', 
            'qualification', 'experience', 'joining_date', 'image',
            'user_email', 'employee_id', 'designation', 'address',
            'specialization', 'experience_years', 'hire_date'
        ]

    def create(self, validated_data):
        # Generate custom_id if it doesn't exist for the user
        instructor = super().create(validated_data)
        if instructor.user and not instructor.user.custom_id:
            from core.utils import generate_custom_id
            instructor.user.custom_id = generate_custom_id('INS')
            instructor.user.save(update_fields=['custom_id'])
        return instructor
