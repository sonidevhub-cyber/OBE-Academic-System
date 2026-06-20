
from django.core.management.base import BaseCommand
from obe.models import CourseSession
from obe.services import calculate_all_course_ga_scores


class Command(BaseCommand):
    help = "Recalculate all CourseGAScores for ASSESSMENT_DONE CourseSessions"

    def handle(self, *args, **options):
        self.stdout.write("Starting to recalculate GA scores...")
        
        total_updated = 0
        for session in CourseSession.objects.filter(assessment_status='ASSESSMENT_DONE'):
            self.stdout.write(f"  Calculating for {session.course.code} - {session.batch.name}")
            scores = calculate_all_course_ga_scores(session)
            total_updated += len(scores)
            self.stdout.write(f"    - Updated {len(scores)} GA scores")
                
        self.stdout.write(f"Successfully updated {total_updated} CourseGAScores total!")
