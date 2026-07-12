from __future__ import annotations

import base64

from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsHOD, IsSACOrHOD
from obe.models import PEOCQIRecord, PEO

from .services import calculate_peo_report, resolve_peo_report_context


class PEOReportView(APIView):
    permission_classes = [IsAuthenticated, IsSACOrHOD]

    def get(self, request, program_id, year):
        try:
            payload = calculate_peo_report(program_id, int(year))
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_404_NOT_FOUND)
        return Response(payload)


class PEOReportPDFView(APIView):
    permission_classes = [IsAuthenticated, IsSACOrHOD]

    def post(self, request, program_id, year):
        chart_image = request.data.get("chart_image") or ""
        if chart_image.startswith("data:image"):
            chart_image = chart_image.split(",", 1)[-1]

        try:
            context = resolve_peo_report_context(program_id, int(year))
            report = calculate_peo_report(program_id, int(year))
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_404_NOT_FOUND)

        html = render_to_string(
            "peo_report/peo_report_pdf.html",
            {
                "report": report,
                "chart_image": chart_image,
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
            f'attachment; filename="peo-report-{context["program"].code}-{year}.pdf"'
        )
        return response


class PEOCQIUpsertView(APIView):
    permission_classes = [IsAuthenticated, IsHOD]

    def post(self, request, program_id, peo_id, year):
        identified_weakness = (request.data.get("identified_weakness") or "").strip()
        corrective_action_plan = (request.data.get("corrective_action_plan") or "").strip()

        if not identified_weakness or not corrective_action_plan:
            return Response(
                {"error": "identified_weakness and corrective_action_plan are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            context = resolve_peo_report_context(program_id, int(year))
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_404_NOT_FOUND)

        peo = PEO.objects.filter(id=peo_id, program_id=program_id, is_active=True).first()
        if not peo:
            return Response({"error": "PEO not found"}, status=status.HTTP_404_NOT_FOUND)

        batch_id = str(context["batch"].id)
        cqi, _ = PEOCQIRecord.objects.update_or_create(
            peo=peo,
            batch_id=batch_id,
            defaults={
                "root_cause": identified_weakness,
                "remedial_plan": corrective_action_plan,
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
                "identified_weakness": cqi.root_cause,
                "corrective_action_plan": cqi.remedial_plan,
                "status": "Closed",
                "hod_approved_by": request.user.full_name,
                "hod_approved_date": cqi.updated_at.isoformat(),
                "is_active": True,
            },
            status=status.HTTP_200_OK,
        )
