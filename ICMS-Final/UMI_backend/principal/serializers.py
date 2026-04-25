from rest_framework import serializers
from django.contrib.auth import get_user_model
from datetime import datetime
from .models import Principal
from register.identifiers import identifier_in_use

User = get_user_model()


# ─────────────────────────────
# Helper — Accept Multiple Date Formats
# ─────────────────────────────
def parse_flexible_date(value):
    if not value:
        return None

    # Already correct format -> YYYY-MM-DD
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except:
        pass

    # DD-MM-YYYY
    try:
        return datetime.strptime(value, "%d-%m-%Y").date()
    except:
        pass

    # DD/MM/YYYY
    try:
        return datetime.strptime(value, "%d/%m/%Y").date()
    except:
        pass

    raise serializers.ValidationError(
        "Invalid date format. Allowed: YYYY-MM-DD / DD-MM-YYYY / DD/MM/YYYY"
    )


# ─────────────────────────────
# CREATE SERIALIZER
# ─────────────────────────────
class PrincipalCreateSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    username = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)

    class Meta:
        model = Principal
        fields = [
            "first_name", "last_name", "username", "password",
            "employee_id", "rank", "department", "gender",
            "phone", "email",
            "joining_date", "retirement_date",
            "status", "profile_pic",
        ]

    def create(self, validated_data):
        from register.identifiers import generate_employee_id
        password = validated_data.pop("password")
        validated_data.pop("username", None)
        first_name = validated_data.pop("first_name")
        last_name = validated_data.pop("last_name")
        validated_data.pop("employee_id", None)
        employee_id = generate_employee_id("principal")
        validated_data["employee_id"] = employee_id
        if identifier_in_use(employee_id):
            raise serializers.ValidationError({"employee_id": "Generated employee ID is already in use."})
        username = employee_id

        # Get or Create Auth User
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "first_name": first_name,
                "last_name": last_name,
                "email": validated_data.get("email"),
                "role": "principal",
                "is_active": True,
            }
        )
        
        # Only set password if user was created
        if created:
            user.employee_id = employee_id
            user.set_password(password)
            user.save()

        # Create or Update Principal Profile
        principal, _ = Principal.objects.get_or_create(
            user=user,
            defaults=validated_data
        )
        return principal


# ─────────────────────────────
# UPDATE SERIALIZER
# ─────────────────────────────
class PrincipalUpdateSerializer(serializers.ModelSerializer):

    joining_date = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    retirement_date = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    # Flexible date parser
    def validate_joining_date(self, value):
        return parse_flexible_date(value)

    def validate_retirement_date(self, value):
        return parse_flexible_date(value)

    class Meta:
        model = Principal
        fields = [
            "rank", "department", "gender",
            "phone", "email",
            "joining_date", "retirement_date",
            "status", "profile_pic",
        ]
