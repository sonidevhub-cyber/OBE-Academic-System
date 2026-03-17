from collections import defaultdict
import re

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from academics.models import Course
from students.models import Student
from register.access_control import get_user_assigned_department_id, is_department_scoped_admin
from rbac.decorators import require_permission
from ..models import (
    Assessment,
    AssessmentCLOMapping,
    CLO,
    CLOGAMapping,
    GraduateAttribute,
    OBEConfiguration,
    StudentAssessment,
)

def _safe_divide(numerator, denominator):
    return (numerator / denominator) if denominator else 0.0


def _natural_key(value):
    parts = re.split(r"(\d+)", value or "")
    return [int(part) if part.isdigit() else part.lower() for part in parts]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@require_permission("view_obe_reports")
def marksheet_report(request):
    course_id = request.query_params.get("course")
    if not course_id:
        return Response({"detail": "course query param is required."}, status=status.HTTP_400_BAD_REQUEST)

    config = OBEConfiguration.objects.order_by("-updated_at").first()
    clo_pass_threshold = config.clo_pass_threshold if config else 60.0
    ga_pass_threshold = config.ga_pass_threshold if config else 60.0

    try:
        course = Course.objects.select_related("semester", "semester__department").get(course_id=course_id)
    except Course.DoesNotExist:
        return Response({"detail": "Course not found."}, status=status.HTTP_404_NOT_FOUND)

    if is_department_scoped_admin(request.user):
        assigned_department_id = get_user_assigned_department_id(request.user)
        if assigned_department_id and course.semester and course.semester.department_id != assigned_department_id:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    assessments = list(
        Assessment.objects.filter(course_id=course_id)
        .values("assessment_id", "title", "assessment_type", "total_marks", "weightage")
    )

    type_order = {
        "quiz": 1,
        "assignment": 2,
        "midterm": 3,
        "final": 4,
        "project": 5,
        "presentation": 6,
        "lab": 7,
    }
    assessments.sort(
        key=lambda a: (type_order.get(a["assessment_type"], 99), _natural_key(a["title"]))
    )

    assessment_groups_map = defaultdict(list)
    for assessment in assessments:
        assessment_groups_map[assessment["assessment_type"]].append(assessment)

    assessment_groups = []
    for assessment_type in [*type_order.keys(), *assessment_groups_map.keys()]:
        if assessment_type in assessment_groups_map:
            assessment_groups.append(
                {"assessment_type": assessment_type, "assessments": assessment_groups_map[assessment_type]}
            )

    clos = list(
        CLO.objects.filter(course_id=course_id)
        .order_by("clo_number")
        .values("id", "clo_number", "description")
    )

    assessment_ids = [a["assessment_id"] for a in assessments]

    mappings = list(
        AssessmentCLOMapping.objects.filter(assessment_id__in=assessment_ids)
        .select_related("assessment", "clo")
        .values("assessment_id", "clo_id", "weightage")
    )

    mapping_by_assessment = defaultdict(list)
    for mapping in mappings:
        mapping_by_assessment[mapping["assessment_id"]].append(mapping)

    clo_ga_mappings = list(
        CLOGAMapping.objects.filter(clo_id__in=[c["id"] for c in clos])
        .select_related("ga", "clo")
        .values("clo_id", "ga_id", "weightage")
    )

    ga_ids = sorted({m["ga_id"] for m in clo_ga_mappings})
    gas = list(
        GraduateAttribute.objects.filter(id__in=ga_ids)
        .order_by("code")
        .values("id", "code", "description")
    )

    student_ids = set(
        StudentAssessment.objects.filter(assessment_id__in=assessment_ids).values_list("student_id", flat=True)
    )
    enrolled_ids = set(
        Student.objects.filter(courses__course_id=course_id).values_list("student_id", flat=True)
    )
    student_ids |= enrolled_ids

    students = list(
        Student.objects.filter(student_id__in=student_ids).order_by("name").values("student_id", "name")
    )

    scores = defaultdict(dict)
    for sa in (
        StudentAssessment.objects.filter(assessment_id__in=assessment_ids, student_id__in=student_ids)
        .select_related("assessment", "student")
        .values("student_id", "assessment_id", "obtained_marks")
    ):
        scores[sa["student_id"]][sa["assessment_id"]] = sa["obtained_marks"]

    clo_attainment = {}
    ga_attainment = {}
    course_clo_totals = defaultdict(list)
    course_ga_totals = defaultdict(list)

    for student in students:
        student_id = student["student_id"]
        clo_scores = []
        clo_score_by_id = {}
        for clo in clos:
            clo_id = clo["id"]
            weighted_sum = 0.0
            weight_total = 0.0

            for assessment in assessments:
                assessment_id = assessment["assessment_id"]
                for mapping in mapping_by_assessment.get(assessment_id, []):
                    if mapping["clo_id"] != clo_id:
                        continue

                    assessment_total = assessment["total_marks"] or 0
                    obtained = scores.get(student_id, {}).get(assessment_id, 0) or 0
                    assessment_percent = _safe_divide(obtained, assessment_total) * 100.0
                    weight = mapping["weightage"] or 1.0

                    weighted_sum += assessment_percent * weight
                    weight_total += weight

            clo_score = _safe_divide(weighted_sum, weight_total)
            clo_score_by_id[clo_id] = clo_score
            clo_scores.append(
                {
                    "clo_id": clo_id,
                    "clo_number": clo["clo_number"],
                    "score": round(clo_score, 2),
                    "pass": clo_score >= clo_pass_threshold,
                }
            )
            course_clo_totals[clo_id].append(clo_score)

        overall = _safe_divide(sum(c["score"] for c in clo_scores), len(clo_scores))
        clo_attainment[student_id] = {
            "clo_scores": clo_scores,
            "overall": round(overall, 2),
            "overall_pass": overall >= clo_pass_threshold,
        }

        ga_scores = []
        for ga in gas:
            ga_id = ga["id"]
            weighted_sum = 0.0
            weight_total = 0.0
            for mapping in clo_ga_mappings:
                if mapping["ga_id"] != ga_id:
                    continue
                clo_id = mapping["clo_id"]
                clo_score = clo_score_by_id.get(clo_id, 0.0)
                weight = mapping["weightage"] or 1.0
                weighted_sum += clo_score * weight
                weight_total += weight

            ga_score = _safe_divide(weighted_sum, weight_total)
            ga_scores.append(
                {
                    "ga_id": ga_id,
                    "ga_code": ga["code"],
                    "score": round(ga_score, 2),
                    "pass": ga_score >= ga_pass_threshold,
                }
            )
            course_ga_totals[ga_id].append(ga_score)

        ga_overall = _safe_divide(sum(g["score"] for g in ga_scores), len(ga_scores))
        ga_attainment[student_id] = {
            "ga_scores": ga_scores,
            "overall": round(ga_overall, 2),
            "overall_pass": ga_overall >= ga_pass_threshold,
        }

    course_clo_attainment = []
    for clo in clos:
        clo_id = clo["id"]
        scores_list = course_clo_totals.get(clo_id, [])
        avg_score = _safe_divide(sum(scores_list), len(scores_list))
        course_clo_attainment.append(
            {
                "clo_id": clo_id,
                "clo_number": clo["clo_number"],
                "average": round(avg_score, 2),
                "pass": avg_score >= clo_pass_threshold,
            }
        )

    course_ga_attainment = []
    for ga in gas:
        ga_id = ga["id"]
        scores_list = course_ga_totals.get(ga_id, [])
        avg_score = _safe_divide(sum(scores_list), len(scores_list))
        course_ga_attainment.append(
            {
                "ga_id": ga_id,
                "ga_code": ga["code"],
                "average": round(avg_score, 2),
                "pass": avg_score >= ga_pass_threshold,
            }
        )

    response = {
        "thresholds": {
            "clo": clo_pass_threshold,
            "ga": ga_pass_threshold,
        },
        "course": {
            "course_id": course.course_id,
            "code": course.code,
            "name": course.name,
            "semester": course.semester.name if course.semester else None,
            "program": course.semester.program if course.semester else None,
            "department": course.semester.department.name if course.semester else None,
        },
        "assessments": assessments,
        "assessment_groups": assessment_groups,
        "clos": clos,
        "gas": gas,
        "mappings": mappings,
        "clo_ga_mappings": clo_ga_mappings,
        "students": [
            {
                "student_id": s["student_id"],
                "name": s["name"],
                "scores": scores.get(s["student_id"], {}),
                "clo_attainment": clo_attainment.get(s["student_id"], {}),
                "ga_attainment": ga_attainment.get(s["student_id"], {}),
            }
            for s in students
        ],
        "course_clo_attainment": course_clo_attainment,
        "course_ga_attainment": course_ga_attainment,
    }

    return Response(response)
