import logging
import secrets
from datetime import timedelta
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import PasswordResetOTP

logger = logging.getLogger(__name__)
User = get_user_model()


def _generate_otp() -> str:
    length = max(4, int(getattr(settings, "PASSWORD_RESET_OTP_LENGTH", 6)))
    upper_bound = 10**length
    return f"{secrets.randbelow(upper_bound):0{length}d}"


def _otp_expiry():
    minutes = max(1, int(getattr(settings, "PASSWORD_RESET_OTP_EXPIRE_MINUTES", 10)))
    return timezone.now() + timedelta(minutes=minutes)


def _send_reset_otp_email(user, otp):
    subject = "Your CMS password reset code"
    from_email = settings.DEFAULT_FROM_EMAIL
    display_name = user.get_full_name() or user.username or user.email
    message = (
        f"Hello {display_name},\n\n"
        "Use this one-time code to reset your CMS password:\n\n"
        f"{otp}\n\n"
        "This code expires in 10 minutes. If you did not request a password reset, you can ignore this email.\n"
    )
    send_mail(subject, message, from_email, [user.email], fail_silently=False)


@csrf_exempt
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def request_password_reset(request):
    email = (request.data.get("email") or "").strip()

    if not email:
        return Response(
            {"message": "Email is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = User.objects.filter(email__iexact=email).first()
    if user:
        try:
            with transaction.atomic():
                PasswordResetOTP.objects.filter(user=user, used_at__isnull=True).delete()
                otp = _generate_otp()
                PasswordResetOTP.objects.create(
                    user=user,
                    email=user.email,
                    otp_hash=make_password(otp),
                    expires_at=_otp_expiry(),
                )
                _send_reset_otp_email(user, otp)
            logger.info("Password reset OTP sent to %s", user.email)
        except Exception:
            logger.exception("Failed to send password reset OTP to %s", user.email)
            return Response(
                {"message": "Unable to send reset code right now. Please try again later."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
    else:
        logger.info("Password reset requested for unknown email %s", email)

    return Response(
        {"message": "If an account exists for this email, a reset code has been sent."},
        status=status.HTTP_200_OK,
    )


@csrf_exempt
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def confirm_password_reset(request):
    email = (request.data.get("email") or "").strip()
    otp = (request.data.get("otp") or request.data.get("code") or "").strip()
    new_password = request.data.get("new_password") or request.data.get("password") or ""
    confirm_password = request.data.get("confirm_password") or request.data.get("confirmPassword") or ""

    if not email or not otp or not new_password:
        return Response(
            {"message": "email, otp, and new_password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if confirm_password and new_password != confirm_password:
        return Response(
            {"message": "Passwords do not match."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return Response(
            {"message": "Invalid code or email."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    reset_record = (
        PasswordResetOTP.objects.filter(
            user=user,
            used_at__isnull=True,
            expires_at__gt=timezone.now(),
        )
        .order_by("-created_at")
        .first()
    )

    if not reset_record:
        return Response(
            {"message": "Reset code is invalid or expired."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if reset_record.attempts >= 5:
        reset_record.delete()
        return Response(
            {"message": "Reset code is invalid or expired."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not check_password(otp, reset_record.otp_hash):
        reset_record.attempts += 1
        reset_record.save(update_fields=["attempts"])
        return Response(
            {"message": "Reset code is invalid or expired."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        validate_password(new_password, user)
    except ValidationError as exc:
        return Response(
            {"message": " ".join(exc.messages)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        user.set_password(new_password)
        user.save()
        PasswordResetOTP.objects.filter(user=user, used_at__isnull=True).delete()

    return Response(
        {"message": "Password reset successful. You can now log in with your new password."},
        status=status.HTTP_200_OK,
    )
