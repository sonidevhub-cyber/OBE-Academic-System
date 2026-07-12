
from django.core.management.base import BaseCommand
from retake.models import CourseRetake
from assessments.models import Assessment


class Command(BaseCommand):
    help = "Debug retake data"

    def handle(self, *args, **options):
        self.stdout.write("--- Checking All Retake Data ---")
        retakes = CourseRetake.objects.all()
        self.stdout.write(f"Total retakes: {retakes.count()}")
        
        for retake in retakes:
            self.stdout.write(
                f"\n  Retake ID: {retake.id}, "
                f"Student: {retake.student.registration_number}, "
                f"Course: {retake.failed_course_session.course.code}, "
                f"Status: '{retake.status}', "
                f"Is Active: {retake.is_active}"
            )
            
            if retake.retake_course_session:
                cs = retake.retake_course_session
                self.stdout.write(
                    f"      Retake CS: {cs.course.code}, "
                    f"done: {cs.assessment_done}, "
                    f"status: '{cs.assessment_status}'"
                )
                assessments = Assessment.objects.filter(course_session=cs)
                self.stdout.write(f"      {assessments.count()} assessments:")
                for a in assessments:
                    self.stdout.write(
                        f"        type: '{a.assessment_type}', "
                        f"final: {a.marks_final}"
                    )
