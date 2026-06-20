
from django.core.management.base import BaseCommand
from obe.models import CourseSession
from assessments.models import Assessment


class Command(BaseCommand):
    help = "Fix CourseSession status: mark as ASSESSMENT_DONE if final exam is finalized"

    def handle(self, *args, **options):
        self.stdout.write("Starting to fix CourseSession status...")
        
        # Find all CourseSessions that are IN_PROGRESS but have a finalized final exam
        fixed_count = 0
        for session in CourseSession.objects.filter(assessment_status='IN_PROGRESS'):
            # Check if this session has a finalized final exam
            final_exam = Assessment.objects.filter(
                course=session.course,
                batch=session.batch,
                semester=session.semester,
                assessment_type='final',
                is_finalized=True
            ).first()
            
            if final_exam:
                # Mark this session as done
                session.assessment_done = True
                session.assessment_status = 'ASSESSMENT_DONE'
                session.save()
                fixed_count +=1
                self.stdout.write(f"  Updated: {session.course.code} - {session.batch.name}")
                
        self.stdout.write(f"Successfully updated {fixed_count} CourseSessions!")
