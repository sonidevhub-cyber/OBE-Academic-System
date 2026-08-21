
from django.core.management.base import BaseCommand
from assessments.models import CLOAttainment


class Command(BaseCommand):
    help = "Check all CLOAttainment values"

    def handle(self, *args, **options):
        self.stdout.write("Checking CLOAttainments...")
        
        for ca in CLOAttainment.objects.all():
            self.stdout.write(
                f"  Course: {ca.course.code if ca.course else 'N/A'} | "
                f"Batch: {ca.batch.name} | "
                f"CLO: {ca.clo.order_number} | "
                f"Attainment: {ca.attained_percentage}% | "
                f"KPI: {ca.kpi_target}% | "
                f"Is Achieved: {ca.is_achieved}"
            )
