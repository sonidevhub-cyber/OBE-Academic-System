from django.utils import timezone
from django.utils.html import escape
from django.http import HttpResponse
from django.db import models
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from obe.models import GACQIRecord, GA
from core.models import Program, Batch
from core.permissions import IsHOD
from obe.services import calculate_weighted_ga_score
from ga_cqi_cohort.serializers import (
    GACQICohortSerializer,
    GACQICumulativeCloseSerializer,
)


def evaluate_ga_status_row(program, batch):
    """
    Evaluate GA status row and trigger GACQIRecords for BELOW_TARGET GAs
    at program end.
    """
    for ga in program.gas.filter(is_active=True):
        cohort_score = calculate_weighted_ga_score(ga, batch)
        final_score = cohort_score['final_score']
        
        if final_score is None:
            continue
            
        if final_score < ga.kpi_threshold:
            record, created = GACQIRecord.objects.get_or_create(
                ga=ga, 
                batch=batch, 
                cqi_level='CUMULATIVE',
                defaults={
                    'status': 'OPEN',
                    'issue_statement': f"Batch {batch.name} has failed to achieve "
                                      f"the target for GA-{ga.order_number} ({ga.title}) "
                                      f"at the cohort level.",
                    'triggered_at': timezone.now(),
                    'attainment_value': final_score,
                    'kpi_threshold_at_trigger': ga.kpi_threshold
                }
            )
            if not created and record.status in {'NOT_TRIGGERED', 'PENDING_HOD_INPUT', 'PENDING'}:
                record.status = 'OPEN'
                if record.triggered_at is None:
                    record.triggered_at = timezone.now()
                record.save(update_fields=['status', 'triggered_at', 'updated_at'])


class GAStatusRowView(APIView):
    """
    Get per-GA status (ON_TARGET / BELOW_TARGET) + linked GACQIRecord id if exists
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, program_id, batch_id):
        try:
            program = Program.objects.get(id=program_id)
            batch = Batch.objects.get(id=batch_id)
        except (Program.DoesNotExist, Batch.DoesNotExist):
            return Response(
                {'error': 'Program or Batch not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )

        # Evaluate and trigger CQIs if needed
        evaluate_ga_status_row(program, batch)
        
        results = []
        gas = GA.objects.filter(program=program, is_active=True)
        
        for ga in gas:
            cohort_result = calculate_weighted_ga_score(ga, batch)
            final_score = cohort_result['final_score']
            
            status_str = 'NOT_ASSESSED'
            if final_score is not None:
                status_str = 'ACHIEVED' if final_score >= ga.kpi_threshold else 'BELOW_TARGET'
                
            # Get existing GACQIRecord
            cqi_record = GACQIRecord.objects.filter(
                ga=ga, batch=batch, cqi_level='CUMULATIVE', is_active=True
            ).first()
            
            results.append({
                'ga_id': str(ga.id),
                'ga_code': f'GA-{ga.order_number}',
                'ga_title': ga.title,
                'cohort_score': final_score,
                'kpi_threshold': float(ga.kpi_threshold),
                'status': status_str,
                'cqi_record_id': str(cqi_record.id) if cqi_record else None,
                'cqi_status': cqi_record.status if cqi_record else None
            })
            
        return Response(results)


class GACQISaveView(APIView):
    """
    PATCH endpoint for HOD to save CQI with action plan
    """
    permission_classes = [IsAuthenticated, IsHOD]
    
    def patch(self, request, record_id):
        try:
            record = GACQIRecord.objects.get(id=record_id)
        except GACQIRecord.DoesNotExist:
            return Response(
                {'error': 'GACQIRecord not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        if record.cqi_level != 'CUMULATIVE' or not record.is_active:
            return Response(
                {'error': 'Only active cumulative GA-CQI records can be saved here'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if record.status in {'SAVED', 'CLOSED_IMPLEMENTED'}:
            return Response(
                {'error': 'Record already saved and locked'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        hod_action_plan = (request.data.get('hod_action_plan') or '').strip()
        if len(hod_action_plan) < 20:
            return Response(
                {'error': 'HOD action plan is required and must be at least 20 characters'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update issue statement if provided
        issue_statement = request.data.get('issue_statement')
        if issue_statement is not None:
            record.issue_statement = issue_statement
            
        record.hod_action_plan = hod_action_plan
        record.status = 'SAVED'
        record.saved_by_hod = request.user
        record.saved_at = timezone.now()
        record.save()
        
        return Response(GACQICohortSerializer(record).data)


class GACQICumulativeCloseView(generics.UpdateAPIView):
    """
    HOD-only single-step cumulative GA-CQI close action.
    """
    permission_classes = [IsAuthenticated, IsHOD]
    serializer_class = GACQICumulativeCloseSerializer
    lookup_field = 'id'
    lookup_url_kwarg = 'id'

    def get_queryset(self):
        return GACQIRecord.objects.filter(
            cqi_level='CUMULATIVE',
            is_active=True,
        ).select_related('ga', 'batch', 'closed_by')

    def perform_update(self, serializer):
        record = self.get_object()

        if record.status == 'CLOSED_IMPLEMENTED':
            raise ValidationError({'detail': 'This cumulative GA-CQI record is already closed.'})

        if record.status != 'SAVED':
            raise ValidationError({'detail': 'Only saved cumulative GA-CQI records can be closed.'})

        serializer.save(
            status='CLOSED_IMPLEMENTED',
            closed_by=self.request.user,
            closed_at=timezone.now(),
        )


class GACQIAdvisoryExportView(APIView):
    """
    Get all saved GACQIRecords for advisory export
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, program_id, batch_id):
        try:
            program = Program.objects.get(id=program_id)
            batch = Batch.objects.get(id=batch_id)
        except (Program.DoesNotExist, Batch.DoesNotExist):
            return Response(
                {'error': 'Program or Batch not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
            
        cqi_records = GACQIRecord.objects.filter(
            batch=batch,
            cqi_level='CUMULATIVE',
            is_active=True,
            status__in=['SAVED', 'CLOSED_IMPLEMENTED'],
        ).select_related('ga', 'saved_by_hod')
        
        serializer = GACQICohortSerializer(cqi_records, many=True)
        
        return Response(serializer.data)


class GACQIAdvisoryExportPDFView(APIView):
    """
    Generate advisory export PDF
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, program_id, batch_id):
        try:
            program = Program.objects.get(id=program_id)
            batch = Batch.objects.get(id=batch_id)
        except (Program.DoesNotExist, Batch.DoesNotExist):
            return Response(
                {'error': 'Program or Batch not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
            
        cqi_records = GACQIRecord.objects.filter(
            batch=batch,
            cqi_level='CUMULATIVE',
            is_active=True,
            status__in=['SAVED', 'CLOSED_IMPLEMENTED'],
        ).select_related('ga', 'saved_by_hod')
        
        html_content = f"""
        <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; padding: 20px; }}
                    h1 {{ color: #2d3748; }}
                    table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
                    th, td {{ border: 1px solid #e2e8f0; padding: 12px; text-align: left; }}
                    th {{ background-color: #f7fafc; }}
                </style>
            </head>
            <body>
                <h1>GA-CQI Advisory Report</h1>
                <h2>Batch: {escape(batch.name)} | Program: {escape(program.name)}</h2>
                <h3>Generated on: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}</h3>
                
                <table>
                    <tr>
                        <th>GA Code</th>
                        <th>GA Title</th>
                        <th>Status</th>
                        <th>Attainment Score</th>
                        <th>KPI Threshold</th>
                        <th>Issue</th>
                        <th>HOD Action Plan</th>
                        <th>Departmental Improvement Framework</th>
                        <th>Saved By</th>
                        <th>Saved At</th>
                        <th>Closed By</th>
                        <th>Closed At</th>
                    </tr>
        """
        
        for record in cqi_records:
            html_content += f"""
                    <tr>
                        <td>GA-{record.ga.order_number}</td>
                        <td>{escape(record.ga.title)}</td>
                        <td>{escape(record.get_status_display())}</td>
                        <td>{record.attainment_value}%</td>
                        <td>{record.kpi_threshold_at_trigger}%</td>
                        <td>{escape(record.issue_statement)}</td>
                        <td>{escape(record.hod_action_plan or '-')}</td>
                        <td>{escape(record.remedy_text or '-')}</td>
                        <td>{escape(record.saved_by_hod.full_name if record.saved_by_hod else 'N/A')}</td>
                        <td>{record.saved_at.strftime('%Y-%m-%d %H:%M:%S') if record.saved_at else 'N/A'}</td>
                        <td>{escape(record.closed_by.full_name if record.closed_by else 'N/A')}</td>
                        <td>{record.closed_at.strftime('%Y-%m-%d %H:%M:%S') if record.closed_at else 'N/A'}</td>
                    </tr>
            """
            
        html_content += """
                </table>
            </body>
        </html>
        """
        
        try:
            from weasyprint import HTML
            pdf_file = HTML(string=html_content).write_pdf()
            response = HttpResponse(pdf_file, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="ga-cqi-advisory-{batch.custom_id}.pdf"'
            return response
        except ImportError:
            return Response(
                {'error': 'PDF generation is unavailable because WeasyPrint is not installed.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
