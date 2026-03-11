from django.core.management.base import BaseCommand
from academics.models import Semester, Course

class Command(BaseCommand):
    help = 'Populate sample courses for semesters that have no courses assigned'

    def handle(self, *args, **options):
        semesters_without_courses = [s for s in Semester.objects.all() if not Course.objects.filter(semester=s).exists()]
        if not semesters_without_courses:
            self.stdout.write(self.style.SUCCESS('All semesters have courses assigned. Nothing to do.'))
            return

        for semester in semesters_without_courses:
            self.stdout.write(f'Populating courses for semester: {semester.name} (ID: {semester.semester_id})')
            # Example: create 3 sample courses per semester
            for i in range(1, 4):
                course_code = f'{semester.semester_code.upper()}C{i:02d}'
                course_name = f'Sample Course {i} for {semester.name}'
                course_description = f'This is a sample course {i} for semester {semester.name}.'
                course, created = Course.objects.get_or_create(
                    code=course_code,
                    defaults={
                        'name': course_name,
                        'description': course_description,
                        'semester': semester,
                        'credits': 3,
                    }
                )
                if created:
                    self.stdout.write(f'  Created course: {course.name} ({course.code})')
                else:
                    self.stdout.write(f'  Course already exists: {course.name} ({course.code})')

        self.stdout.write(self.style.SUCCESS('Finished populating courses for semesters.'))
