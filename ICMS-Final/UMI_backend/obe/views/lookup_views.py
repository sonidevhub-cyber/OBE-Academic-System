from django.http import JsonResponse

from academics.models import Course, Semester
from ..models import CLO


def semesters_by_department(request):
    department_id = request.GET.get("department")
    semesters = []
    if department_id:
        semesters = [
            {"id": semester.pk, "name": semester.name}
            for semester in Semester.objects.filter(department_id=department_id).order_by("name")
        ]
    return JsonResponse(semesters, safe=False)


def courses_by_semester(request):
    semester_id = request.GET.get("semester")
    department_id = request.GET.get("department")
    courses = []
    if semester_id:
        queryset = Course.objects.filter(semester_id=semester_id)
        if department_id:
            queryset = queryset.filter(semester__department_id=department_id)
        courses = [{"id": course.pk, "name": course.name} for course in queryset.order_by("name")]
    return JsonResponse(courses, safe=False)


def clos_by_course(request):
    course_id = request.GET.get("course")
    clos = []
    if course_id:
        clos = [
            {"id": clo.pk, "clo_number": f"CLO {clo.clo_number}", "name": str(clo)}
            for clo in CLO.objects.filter(course_id=course_id).order_by("clo_number")
        ]
    return JsonResponse(clos, safe=False)
