from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Any

from django.db.models import Avg, Q
from django.utils import timezone

from core.models import Batch, Program
from obe.models import (
    AlumniSurveyCycle,
    AlumniSurveyQuestion,
    AlumniSurveyResponse,
    GA,
    GAPEOMapping,
    PEOCQIRecord,
    PEO,
)
from obe.services import calculate_weighted_ga_score

# Configurable thresholds. Keep these as named constants so they are easy to
# move into settings or a lookup table later.
DIRECT_WEIGHT = Decimal("80.00")
INDIRECT_WEIGHT = Decimal("20.00")
DEFAULT_PEO_KPI_THRESHOLD = Decimal("60.00")
QUESTION_LABEL_CRITICAL = Decimal("60.00")
QUESTION_LABEL_GOOD = Decimal("75.00")


def _to_float(value: Decimal | float | int | None) -> float | None:
    if value is None:
        return None
    return round(float(value), 2)


def _normalize_weighted_average(items: list[tuple[Decimal, Decimal]]) -> Decimal | None:
    available = [(score, weight) for score, weight in items if score is not None and weight > 0]
    if not available:
        return None
    total_weight = sum(weight for _, weight in available)
    if total_weight <= 0:
        return None
    total_score = Decimal("0")
    for score, weight in available:
        total_score += Decimal(str(score)) * (weight / total_weight)
    return total_score.quantize(Decimal("0.01"))


def _get_program_department(program: Program) -> str:
    # There is no dedicated department field on Program in this codebase.
    # Program code is the closest stable department-like label available.
    return program.code or program.name or "N/A"


def _resolve_batch_for_program_year(program: Program, year: int) -> Batch | None:
    batch_qs = Batch.objects.filter(program=program, is_active=True).filter(
        Q(end_year=year)
        | Q(graduated_at__year=year)
        | Q(start_year__lte=year, end_year__gte=year)
    )
    batch = batch_qs.order_by("-end_year", "-graduated_at", "-created_at").first()
    if batch:
        return batch
    return Batch.objects.filter(program=program, is_active=True).order_by(
        "-end_year",
        "-created_at",
    ).first()


def _resolve_alumni_cycle(batch: Batch, year: int) -> AlumniSurveyCycle | None:
    matching_cycles = batch.alumni_survey_cycles.filter(is_active=True).filter(
        Q(created_at__year=year)
        | Q(activated_at__year=year)
        | Q(closed_at__year=year)
    )
    cycle = matching_cycles.order_by("-closed_at", "-activated_at", "-created_at").first()
    if cycle:
        return cycle

    # Fall back to the latest active cycle for the batch.
    return batch.alumni_survey_cycles.filter(is_active=True).order_by(
        "-closed_at",
        "-activated_at",
        "-created_at",
    ).first()


def _question_label(percentage: float | None) -> str:
    if percentage is None:
        return "Not Assessed"
    value = Decimal(str(percentage))
    if value < QUESTION_LABEL_CRITICAL:
        return "Critical Low"
    if value < QUESTION_LABEL_GOOD:
        return "Satisfactory"
    return "Good"


def _get_target_threshold(peos: list[PEO]) -> float:
    if not peos:
        return float(DEFAULT_PEO_KPI_THRESHOLD)
    return float(peos[0].kpi_threshold or DEFAULT_PEO_KPI_THRESHOLD)


def _get_latest_hod_signature(cqi_records: list[PEOCQIRecord]) -> tuple[str | None, str | None]:
    approved = [record for record in cqi_records if record.status == "APPROVED" or record.is_locked]
    if not approved:
        return None, None

    latest = max(
        approved,
        key=lambda record: record.updated_at or record.created_at,
    )
    approved_by = latest.submitted_by.full_name if latest.submitted_by else None
    approved_date = (latest.updated_at or latest.created_at)
    return approved_by, approved_date.isoformat() if approved_date else None


def _build_alumni_employment_stats(batch: Batch, cycle: AlumniSurveyCycle | None) -> dict[str, Any]:
    if cycle is None:
        return {
            "employmentDistribution": [],
            "topEmployers": [],
        }

    responses = list(
        AlumniSurveyResponse.objects.filter(
            cycle=cycle,
            is_active=True,
        ).values("student_id", "employment_status", "organization_name").distinct()
    )

    employment_order = [
        "employed",
        "self_employed",
        "higher_studies",
        "unemployed",
        "housewife",
    ]
    employment_labels = {
        "employed": "Employed",
        "self_employed": "Self-Employed / Entrepreneur",
        "higher_studies": "Higher Studies",
        "unemployed": "Unemployed / Looking for Job",
        "housewife": "Housewife / Homemaker",
    }

    normalized_distribution: dict[str, int] = defaultdict(int)
    employer_counts: dict[str, int] = defaultdict(int)

    for response in responses:
        employment_status = (response.get("employment_status") or "").strip().lower()
        if employment_status:
            normalized_distribution[employment_status] += 1

        organization_name = (response.get("organization_name") or "").strip()
        if organization_name and employment_status in {"employed", "self_employed"}:
            employer_counts[organization_name] += 1

    employment_distribution = []
    for status in employment_order:
        count = normalized_distribution.get(status, 0)
        employment_distribution.append(
            {
                "key": status,
                "label": employment_labels[status],
                "count": count,
            }
        )

    top_employers = [
        {"name": name, "count": count}
        for name, count in sorted(employer_counts.items(), key=lambda item: (-item[1], item[0]))[:10]
    ]

    return {
        "employmentDistribution": employment_distribution,
        "topEmployers": top_employers,
    }


def resolve_peo_report_context(program_id: str, year: int, batch_id: str | None = None) -> dict[str, Any]:
    program = Program.objects.filter(id=program_id, is_active=True).first()
    if not program:
        raise ValueError("Program not found")

    if batch_id:
        batch = Batch.objects.filter(id=batch_id, program=program, is_active=True).first()
        if not batch:
            raise ValueError("Batch not found")
    else:
        batch = _resolve_batch_for_program_year(program, year)
        if not batch:
            raise ValueError("No active batch found for the requested program and year")

    peos = list(PEO.objects.filter(program=program, is_active=True).order_by("order_number"))
    cycle = _resolve_alumni_cycle(batch, year)
    cqi_records = list(
        PEOCQIRecord.objects.filter(batch=batch, peo__in=peos).select_related("peo", "submitted_by")
    )

    return {
        "program": program,
        "batch": batch,
        "cycle": cycle,
        "peos": peos,
        "cqi_records": cqi_records,
    }


def _build_indirect_breakdown(
    peo: PEO,
    cycle: AlumniSurveyCycle | None,
) -> tuple[float | None, list[dict[str, Any]], int]:
    questions = list(
        AlumniSurveyQuestion.objects.filter(peo=peo, is_active=True).order_by("created_at")
    )
    if cycle is None or not questions:
        return None, [], 0

    responses = AlumniSurveyResponse.objects.filter(
        cycle=cycle,
        question__in=questions,
        is_active=True,
        question__is_active=True,
    )
    total_responses = responses.values("student_id").distinct().count()

    question_rows: list[dict[str, Any]] = []
    for question in questions:
        question_responses = responses.filter(question=question)
        avg_score = question_responses.aggregate(avg=Avg("score"))["avg"]
        if avg_score is None:
            question_rows.append(
                {
                    "questionText": question.question_text,
                    "avgScore": None,
                    "percentage": None,
                    "label": "Not Assessed",
                }
            )
            continue

        percentage = round((float(avg_score) / 5.0) * 100.0, 2)
        question_rows.append(
            {
                "questionText": question.question_text,
                "avgScore": round(float(avg_score), 2),
                "percentage": percentage,
                "label": _question_label(percentage),
            }
        )

    overall_avg = responses.aggregate(avg=Avg("score"))["avg"]
    if overall_avg is None:
        return None, question_rows, total_responses

    indirect_percentage = round((float(overall_avg) / 5.0) * 100.0, 2)
    return indirect_percentage, question_rows, total_responses


def _build_direct_score(
    peo: PEO,
    batch: Batch,
) -> tuple[float | None, list[dict[str, Any]], list[str]]:
    mappings = list(
        GAPEOMapping.objects.filter(peo=peo, is_active=True).select_related("ga").order_by("ga__order_number")
    )
    if not mappings:
        return None, [], []

    contributing_gas: list[dict[str, Any]] = []
    weighted_inputs: list[tuple[Decimal, Decimal]] = []
    mapped_questions: list[str] = []

    for mapping in mappings:
        ga = mapping.ga
        mapped_questions.append(f"GA-{ga.order_number}: {ga.title or ga.description or ''}".strip())

        ga_result = calculate_weighted_ga_score(ga, batch) if batch else None
        ga_score = None
        if ga_result:
            ga_score = ga_result.get("final_score")

        if ga_score is None:
            continue

        weight = Decimal(str(mapping.weight or 0))
        weighted_inputs.append((Decimal(str(ga_score)), weight))
        contributing_gas.append(
            {
                "ga_id": str(ga.id),
                "ga_code": f"GA-{ga.order_number}",
                "ga_title": ga.title or "",
                "ga_score": round(float(ga_score), 2),
                "weight": _to_float(weight) or 0.0,
            }
        )

    direct_score = _normalize_weighted_average(weighted_inputs)
    return _to_float(direct_score), contributing_gas, mapped_questions


def calculate_peo_report(program_id: str, year: int, batch_id: str | None = None) -> dict[str, Any]:
    context = resolve_peo_report_context(program_id, year, batch_id)
    program = context["program"]
    batch = context["batch"]
    cycle = context["cycle"]
    peos = context["peos"]
    cqi_records = context["cqi_records"]
    cqi_by_peo = {str(record.peo_id): record for record in cqi_records}

    matrix: list[dict[str, Any]] = []
    chart_data: list[dict[str, Any]] = []
    triggered_count = 0

    for idx, peo in enumerate(peos):
        direct_percentage, contributing_gas, mapped_questions = _build_direct_score(peo, batch)
        indirect_percentage, per_question_rows, total_responses = _build_indirect_breakdown(peo, cycle)

        available_components: list[tuple[Decimal, Decimal]] = []
        if direct_percentage is not None:
            available_components.append((Decimal(str(direct_percentage)), DIRECT_WEIGHT))
        if indirect_percentage is not None:
            available_components.append((Decimal(str(indirect_percentage)), INDIRECT_WEIGHT))

        combined = _normalize_weighted_average(available_components)
        combined_percentage = _to_float(combined)
        target_percentage = _to_float(peo.kpi_threshold or DEFAULT_PEO_KPI_THRESHOLD) or 0.0
        status = "Achieved" if combined_percentage is not None and combined_percentage >= target_percentage else "CQI Triggered"

        if status == "CQI Triggered":
            triggered_count += 1

        cqi_record = cqi_by_peo.get(str(peo.id))
        matrix.append(
            {
                "peoId": str(peo.id),  # Keep this for key, but won't show in UI
                "description": peo.description or peo.title or "",
                "mappedQuestions": mapped_questions or [row["questionText"] for row in per_question_rows],
                "directPercentage": direct_percentage,
                "indirectPercentage": indirect_percentage,
                "combinedAttainmentPercentage": combined_percentage,
                "targetPercentage": target_percentage,
                "status": status,
                "cqiRecordId": str(cqi_record.id) if cqi_record else None,
                "cqiStatus": cqi_record.status if cqi_record else None,
                "cqiIsLocked": cqi_record.is_locked if cqi_record else False,
            }
        )

        chart_data.append(
            {
                "peoId": str(peo.id),
                "target": target_percentage,
                "achieved": combined_percentage if combined_percentage is not None else 0.0,
            }
        )

    overall_status = "cqi_required" if triggered_count > 0 else "achieved"
    target_threshold = _get_target_threshold(peos)

    return {
        "header": {
            "department": _get_program_department(program),
            "program": program.name,
            "evaluationCycleYear": str(year),
            "totalSurveyResponses": cycle.responses.filter(is_active=True).values("student_id").distinct().count() if cycle else 0,
        },
        "employmentStats": _build_alumni_employment_stats(batch, cycle),
        "summary": {
            "targetThreshold": target_threshold,
            "overallStatus": overall_status,
            "chartData": chart_data,
        },
        "matrix": matrix,
    }
