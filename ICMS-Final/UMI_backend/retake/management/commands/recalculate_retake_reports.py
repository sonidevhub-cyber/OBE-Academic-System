
from django.core.management.base import BaseCommand
from retake.models import CourseRetake
from retake.services import recalculate_reports_for_retake_queryset


class Command(BaseCommand):
    help = 'Recalculate CLO and GA reports for all existing retakes'

    def handle(self, *args, **options):
        self.stdout.write('Starting retake report recalculation...')

        retakes = CourseRetake.objects.filter(is_active=True)
        self.stdout.write(f'Found {retakes.count()} active retakes')

        processed = recalculate_reports_for_retake_queryset(retakes)
        self.stdout.write(self.style.SUCCESS(f'Successfully processed {len(processed)} retake session(s)'))

        self.stdout.write(self.style.SUCCESS('Report recalculation complete'))
