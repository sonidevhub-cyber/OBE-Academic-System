
from django.core.management.base import BaseCommand
from obe.models import CourseGAScore


class Command(BaseCommand):
    help = "Check all CourseGAScore values"

    def handle(self, *args, **options):
        self.stdout.write("Checking CourseGAScores...")
        
        for score in CourseGAScore.objects.all():
            self.stdout.write(
                f"  Course: {score.course_session.course.code} | "
                f"Batch: {score.course_session.batch.name} | "
                f"GA: {score.ga.order_number} | Score: {score.score}"
            )
