from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Avg, Count

from hods.management.hod_feedback.models import HODFeedbackControl
from feedback.models import Feedback
from .serializers import HODFeedbackSerializer


# ====================================
# 1) ALLOW FEEDBACK (HOD Only)
# ====================================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def allow_feedback(request):

    if not hasattr(request.user, "hod_profile"):
        return Response({"detail": "Only HOD can allow feedback"}, status=403)

    hod = request.user.hod_profile

    control, _ = HODFeedbackControl.objects.get_or_create(hod=hod)

    control.is_allowed = True
    control.save()

    return Response({
        "message": "Feedback is now OPEN for students.",
        "allowed": True
    })


# ====================================
# 2) DISABLE FEEDBACK (HOD Only)
# ====================================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def disable_feedback(request):

    if not hasattr(request.user, "hod_profile"):
        return Response({"detail": "Only HOD can disable feedback"}, status=403)

    hod = request.user.hod_profile

    control, _ = HODFeedbackControl.objects.get_or_create(hod=hod)

    control.is_allowed = False
    control.save()

    return Response({
        "message": "Feedback is now CLOSED for students.",
        "allowed": False
    })


# ================================================
# 3) STUDENT APP – Check Feedback Status by Dept
# ================================================
@api_view(["GET"])
def check_feedback_status(request, department_id):

    control = HODFeedbackControl.objects.filter(
        hod__department_id=department_id
    ).first()

    return Response({
        "allowed": control.is_allowed if control else False
    })


# ====================================
# 4) HOD – All Feedback
# ====================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def hod_all_feedback(request):

    if not hasattr(request.user, "hod_profile"):
        return Response({"detail": "Only HOD can view feedback"}, status=403)

    hod = request.user.hod_profile

    feedbacks = Feedback.objects.filter(
        department=hod.department
    ).order_by("-created_at")

    serializer = HODFeedbackSerializer(feedbacks, many=True)

    return Response(serializer.data)


# ====================================
# 5) FEEDBACK ANALYTICS
# ====================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def feedback_analytics(request):

    if not hasattr(request.user, "hod_profile"):
        return Response({"detail": "Only HOD can view analytics"}, status=403)

    hod = request.user.hod_profile

    qs = Feedback.objects.filter(department=hod.department)

    analytics = qs.aggregate(
        avg_rating=Avg("rating"),
    )

    type_counts = (
        qs.values("feedback_type")
        .annotate(total=Count("id"))
        .order_by("-total")
    )

    return Response({
        "averages": analytics,
        "feedback_type_count": list(type_counts)
    })
