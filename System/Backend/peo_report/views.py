from __future__ import annotations

import math

from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.safestring import mark_safe
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsHOD, IsSACOrHOD
from obe.models import PEOCQIRecord, PEO

from .services import calculate_peo_report, resolve_peo_report_context


def _polar_to_cartesian(cx: float, cy: float, radius: float, angle_degrees: float) -> tuple[float, float]:
    radians = math.radians(angle_degrees)
    return cx + (radius * math.cos(radians)), cy + (radius * math.sin(radians))


def _describe_pie_slice(cx: float, cy: float, radius: float, start_angle: float, end_angle: float) -> str:
    start_x, start_y = _polar_to_cartesian(cx, cy, radius, start_angle)
    end_x, end_y = _polar_to_cartesian(cx, cy, radius, end_angle)
    large_arc_flag = 1 if end_angle - start_angle > 180 else 0
    return (
        f"M {cx} {cy} "
        f"L {start_x:.2f} {start_y:.2f} "
        f"A {radius} {radius} 0 {large_arc_flag} 1 {end_x:.2f} {end_y:.2f} Z"
    )


def _build_pie_chart_svg(achieved_count: int, cqi_count: int) -> str:
    total = achieved_count + cqi_count
    if total <= 0:
        return mark_safe(
            """
            <svg viewBox="0 0 320 220" width="100%" height="220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="No data pie chart">
              <rect x="1" y="1" width="318" height="218" rx="18" fill="#ffffff" stroke="#e5e7eb"/>
              <text x="160" y="105" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#6b7280">No CQI data available</text>
            </svg>
            """
        )

    cx, cy, radius = 106, 108, 64
    start_angle = -90.0
    achieved_angle = (achieved_count / total) * 360.0
    cqi_angle = 360.0 - achieved_angle
    achieved_pct = round((achieved_count / total) * 100.0, 1)
    cqi_pct = round((cqi_count / total) * 100.0, 1)

    slices: list[str] = []
    if achieved_count > 0:
        slices.append(
            f'<path d="{_describe_pie_slice(cx, cy, radius, start_angle, start_angle + achieved_angle)}" fill="#2563eb" />'
        )
    if cqi_count > 0:
        slices.append(
            f'<path d="{_describe_pie_slice(cx, cy, radius, start_angle + achieved_angle, start_angle + achieved_angle + cqi_angle)}" fill="#f59e0b" />'
        )

    return mark_safe(
        f"""
        <svg viewBox="0 0 320 220" width="100%" height="220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="PO status pie chart">
          <rect x="1" y="1" width="318" height="218" rx="18" fill="#ffffff" stroke="#e5e7eb"/>
          <text x="214" y="46" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#111827">PO Status</text>
          <text x="214" y="70" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#6b7280">Achieved vs CQI Required</text>
          <circle cx="{cx}" cy="{cy}" r="{radius}" fill="none" stroke="#e5e7eb" stroke-width="26" />
          {''.join(slices)}
          <circle cx="{cx}" cy="{cy}" r="38" fill="#ffffff" />
          <text x="{cx}" y="{cy - 2}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="#111827">{achieved_count}</text>
          <text x="{cx}" y="{cy + 16}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="10" fill="#6b7280">Achieved</text>
          <rect x="190" y="96" width="14" height="14" rx="3" fill="#2563eb" />
          <text x="210" y="108" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#111827">Achieved: {achieved_count} ({achieved_pct}%)</text>
          <rect x="190" y="126" width="14" height="14" rx="3" fill="#f59e0b" />
          <text x="210" y="138" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#111827">CQI Required: {cqi_count} ({cqi_pct}%)</text>
        </svg>
        """
    )


class PEOReportView(APIView):
    permission_classes = [IsAuthenticated, IsSACOrHOD]

    def get(self, request, program_id, year):
        batch_id = request.query_params.get("batch_id")
        try:
            payload = calculate_peo_report(program_id, int(year), batch_id)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_404_NOT_FOUND)
        return Response(payload)


class PEOReportPDFView(APIView):
    permission_classes = [IsAuthenticated, IsSACOrHOD]

    def post(self, request, program_id, year):
        chart_image = request.data.get("chart_image") or ""
        if chart_image.startswith("data:image"):
            chart_image = chart_image.split(",", 1)[-1]

        batch_id = request.query_params.get("batch_id") or request.data.get("batch_id")
        try:
            context = resolve_peo_report_context(program_id, int(year), batch_id)
            report = calculate_peo_report(program_id, int(year), batch_id)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_404_NOT_FOUND)

        achieved_count = sum(1 for row in report.get("matrix", []) if row.get("status") == "Achieved")
        cqi_count = max(len(report.get("matrix", [])) - achieved_count, 0)

        html = render_to_string(
            "peo_report/peo_report_pdf.html",
            {
                "report": report,
                "chart_image": chart_image,
                "pie_chart_svg": _build_pie_chart_svg(achieved_count, cqi_count),
                "generated_at": timezone.now(),
            },
        )

        try:
            from weasyprint import HTML
        except ImportError:
            return Response(
                {"error": "PDF generation is unavailable because WeasyPrint is not installed."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        pdf_file = HTML(string=html, base_url=request.build_absolute_uri("/")).write_pdf()
        response = HttpResponse(pdf_file, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="po-report-{context["program"].code}-{year}.pdf"'
        )
        return response


class PEOCQIUpsertView(APIView):
    permission_classes = [IsAuthenticated, IsHOD]

    def post(self, request, program_id, peo_id, year):
        root_cause = (request.data.get("root_cause") or request.data.get("identified_weakness") or "").strip()
        remedial_plan = (request.data.get("remedial_plan") or request.data.get("corrective_action_plan") or "").strip()

        if not root_cause or not remedial_plan:
            return Response(
                {"error": "root_cause and remedial_plan are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        batch_id = request.query_params.get("batch_id") or request.data.get("batch_id")
        try:
            context = resolve_peo_report_context(program_id, int(year), batch_id)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_404_NOT_FOUND)

        peo = PEO.objects.filter(id=peo_id, program_id=program_id, is_active=True).first()
        if not peo:
            return Response({"error": "PO not found"}, status=status.HTTP_404_NOT_FOUND)

        batch_id = str(context["batch"].id)
        cqi, _ = PEOCQIRecord.objects.update_or_create(
            peo=peo,
            batch_id=batch_id,
            defaults={
                "root_cause": root_cause,
                "remedial_plan": remedial_plan,
                "status": "APPROVED",
                "submitted_by": request.user,
                "is_locked": True,
                "attainment_value": None,
                "kpi_threshold_at_trigger": peo.kpi_threshold,
            },
        )
        cqi.updated_at = timezone.now()
        cqi.save(update_fields=["updated_at"])

        return Response(
            {
                "id": str(cqi.id),
                "peo": str(peo.id),
                "batch": batch_id,
                "root_cause": cqi.root_cause,
                "remedial_plan": cqi.remedial_plan,
                "status": "Closed",
                "hod_approved_by": request.user.full_name,
                "hod_approved_date": cqi.updated_at.isoformat(),
                "is_active": True,
            },
            status=status.HTTP_200_OK,
        )
