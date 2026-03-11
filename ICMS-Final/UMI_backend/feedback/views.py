from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from .models import Feedback, FeedbackNotification
from students.models import Student
from hods.models import HOD
from hods.management.hod_feedback.models import HODFeedbackControl

def _get_hod_for_user(user):
    return HOD.objects.filter(user=user).order_by('-created_at').first()

def _get_active_hod_for_department(department):
    return (
        HOD.objects.filter(department=department, is_active=True)
        .order_by('-created_at')
        .first()
    )

def _get_active_hod_for_department_id(department_id):
    return (
        HOD.objects.filter(department_id=department_id, is_active=True)
        .order_by('-created_at')
        .first()
    )

# -------------------------------------------------------------
# 1️⃣ ALLOW FEEDBACK (HOD)
# -------------------------------------------------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def allow_feedback(request):
    try:
        hod = _get_hod_for_user(request.user)   # FIXED ✓
        if not hod:
            raise HOD.DoesNotExist

        control, created = HODFeedbackControl.objects.get_or_create(hod=hod)
        control.is_allowed = True
        control.save()

        return Response({
            "success": True,
            "message": "Feedback allowed successfully"
        })

    except HOD.DoesNotExist:
        return Response({"error": "Only HODs can allow feedback"}, status=403)



# -------------------------------------------------------------
# 2️⃣ DISABLE FEEDBACK (HOD)
# -------------------------------------------------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def disable_feedback(request):
    try:
        hod = _get_hod_for_user(request.user)  # FIXED ✓
        if not hod:
            raise HOD.DoesNotExist

        control, created = HODFeedbackControl.objects.get_or_create(hod=hod)
        control.is_allowed = False
        control.save()

        return Response({
            "success": True,
            "message": "Feedback disabled successfully"
        })

    except HOD.DoesNotExist:
        return Response({"error": "Only HODs can disable feedback"}, status=403)



# -------------------------------------------------------------
# 3️⃣ CHECK FEEDBACK STATUS FOR STUDENT UI
# -------------------------------------------------------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_feedback_status(request, department_id):
    try:
        hod = _get_active_hod_for_department_id(department_id)  # FIXED ✓
        if not hod:
            raise HOD.DoesNotExist
        control, created = HODFeedbackControl.objects.get_or_create(hod=hod)

        return Response({
            "success": True,
            "is_allowed": control.is_allowed
        })

    except HOD.DoesNotExist:
        return Response({"error": "Invalid department"}, status=404)



# -------------------------------------------------------------
# 4️⃣ SUBMIT FEEDBACK (STUDENT OR HOD)
# -------------------------------------------------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_feedback(request):
    try:
        print("\n📩 SUBMIT FEEDBACK LOG")
        print("Request:", request.data)
        print("User:", request.user)

        student = None
        hod_user = None

        # -------------------------------
        # Check Student
        # -------------------------------
        try:
            student = Student.objects.get(user=request.user)
            department = student.department
            print("User is STUDENT:", student)

            # Check if HOD allowed
            hod = _get_active_hod_for_department(department)
            if not hod:
                return Response({"error": "No active HOD found for department"}, status=404)
            control, created = HODFeedbackControl.objects.get_or_create(hod=hod)

            if not control.is_allowed:
                return Response({
                    "success": False,
                    "message": "HOD has not allowed feedback yet."
                }, status=403)

        except Student.DoesNotExist:

            # -------------------------------
            # Check HOD
            # -------------------------------
            try:
                hod_user = _get_hod_for_user(request.user)
                if not hod_user:
                    raise HOD.DoesNotExist
                department = hod_user.department
                print("User is HOD:", hod_user)

            except HOD.DoesNotExist:
                return Response({"error": "Only students or HODs can submit feedback"}, status=403)

        # -------------------------------
        # Create Feedback Entry
        # -------------------------------
        feedback = Feedback.objects.create(
            department=department,
            feedback_type=request.data.get("feedback_type", "general"),
            title=request.data.get("title"),
            message=request.data.get("message"),
            rating=request.data.get("rating", 3),
            semester=request.data.get("semester", ""),
            subject_area=request.data.get("subject_area", "")
        )

        # Notify HOD only if student submitted
        hod = _get_active_hod_for_department(department)
        if not hod:
            return Response({"error": "No active HOD found for department"}, status=404)
        if hod.user != request.user:
            FeedbackNotification.objects.create(
                hod=hod,
                feedback=feedback,
                message=f"New feedback received: {feedback.title}"
            )

        return Response({
            "success": True,
            "message": "Feedback submitted successfully!"
        }, status=201)

    except Exception as e:
        import traceback
        print("Submit Error:", e)
        print(traceback.format_exc())
        return Response({"error": str(e)}, status=400)



# -------------------------------------------------------------
# 5️⃣ GET FEEDBACK FOR HOD
# -------------------------------------------------------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_department_feedback(request):
    try:
        hod = _get_hod_for_user(request.user)
        if not hod:
            raise HOD.DoesNotExist
        feedbacks = Feedback.objects.filter(department=hod.department)

        data = [{
            "id": fb.id,
            "title": fb.title,
            "message": fb.message,
            "feedback_type": fb.feedback_type,
            "rating": fb.rating,
            "semester": fb.semester,
            "subject_area": fb.subject_area,
            "is_reviewed": fb.is_reviewed,
            "created_at": fb.created_at.isoformat(),
        } for fb in feedbacks]

        return Response({
            "success": True,
            "count": len(data),
            "feedbacks": data
        })

    except HOD.DoesNotExist:
        return Response({"error": "Only HODs can view this"}, status=403)



# -------------------------------------------------------------
# 6️⃣ MARK FEEDBACK REVIEWED
# -------------------------------------------------------------
@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def mark_feedback_reviewed(request, feedback_id):
    try:
        hod = _get_hod_for_user(request.user)
        if not hod:
            raise HOD.DoesNotExist
        feedback = get_object_or_404(Feedback, id=feedback_id, department=hod.department)
        feedback.is_reviewed = True
        feedback.save()

        return Response({"success": True, "message": "Feedback marked as reviewed"})

    except HOD.DoesNotExist:
        return Response({"error": "Only HODs can review feedback"}, status=403)



# -------------------------------------------------------------
# 7️⃣ GET HOD NOTIFICATIONS
# -------------------------------------------------------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_hod_notifications(request):
    try:
        hod = _get_hod_for_user(request.user)
        if not hod:
            raise HOD.DoesNotExist
        notes = FeedbackNotification.objects.filter(hod=hod)

        data = [{
            "id": n.id,
            "message": n.message,
            "feedback_title": n.feedback.title,
            "feedback_id": n.feedback.id,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat()
        } for n in notes]

        return Response({
            "success": True,
            "notifications": data,
            "unread_count": notes.filter(is_read=False).count()
        })

    except HOD.DoesNotExist:
        return Response({"error": "Only HODs can view notifications"}, status=403)



# -------------------------------------------------------------
# 8️⃣ MARK NOTIFICATION READ
# -------------------------------------------------------------
@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, notification_id):
    try:
        hod = _get_hod_for_user(request.user)
        if not hod:
            raise HOD.DoesNotExist
        note = get_object_or_404(FeedbackNotification, id=notification_id, hod=hod)

        note.is_read = True
        note.save()

        return Response({"success": True})

    except HOD.DoesNotExist:
        return Response({"error": "Only HODs can update notifications"}, status=403)
