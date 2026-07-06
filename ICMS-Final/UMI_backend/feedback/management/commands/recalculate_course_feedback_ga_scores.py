from django.core.management.base import BaseCommand
from feedback.views import FeedbackService
from core.models import Batch


class Command(BaseCommand):
    help = "Recalculate CourseFeedbackGAScore for existing feedback data"

    def add_arguments(self, parser):
        parser.add_argument(
            '--batch',
            type=str,
            help='Batch ID to recalculate for (optional)',
        )

    def handle(self, *args, **options):
        self.stdout.write("Starting to recalculate CourseFeedbackGAScore...")
        
        batch_id = options.get('batch')
        
        if batch_id:
            try:
                batch = Batch.objects.get(id=batch_id)
                self.stdout.write(f"Recalculating for batch: {batch.name}")
                FeedbackService.calculate(batch)
                self.stdout.write(f"Successfully updated CourseFeedbackGAScore for batch {batch.name}!")
            except Batch.DoesNotExist:
                self.stdout.write(f"Error: Batch with ID {batch_id} not found!")
        else:
            # Recalculate for all batches
            batches = Batch.objects.all()
            total_updated = 0
            
            for batch in batches:
                self.stdout.write(f"Recalculating for batch: {batch.name}")
                FeedbackService.calculate(batch)
                total_updated += 1
                
            self.stdout.write(f"Successfully updated CourseFeedbackGAScore for {total_updated} batches!")
