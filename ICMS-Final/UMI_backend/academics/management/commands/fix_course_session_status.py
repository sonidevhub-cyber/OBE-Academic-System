
from django.core.management.base import BaseCommand
from obe.models import CourseSession
from assessments.models import Assessment


class Command(BaseCommand):
    help = "Fix CourseSession status: mark as ASSESSMENT_DONE if all assessments are finalized"

    def handle(self, *args, **options):
        self.stdout.write("Starting to fix CourseSession status...")
        
        # Find all CourseSessions that are IN_PROGRESS but have all assessments finalized
        fixed_count = 0
        for session in CourseSession.objects.filter(assessment_status='IN_PROGRESS'):
            # Check if ALL assessments for this session are finalized
            all_assessments = Assessment.objects.filter(
                course=session.course,
                batch=session.batch,
                semester=session.semester
            )
            
            if all_assessments.exists():
                all_finalized = all(a.is_finalized for a in all_assessments)
                if all_finalized:
                    # Mark this session as done
                    session.assessment_done = True
                    session.assessment_status = 'ASSESSMENT_DONE'
                    session.save()
                    fixed_count +=1
                    self.stdout.write(f"  Updated: {session.course.code} - {session.batch.name} - {len(all_assessments)} assessments")
                
        self.stdout.write(f"Successfully updated {fixed_count} CourseSessions!")
