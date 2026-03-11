from django.core.management.base import BaseCommand
from instructors.models import Instructor
from academics.models import Timetable

class Command(BaseCommand):
    def handle(self, *args, **options):
        instructor = Instructor.objects.get(employee_id='0499515')
        timetables = Timetable.objects.filter(instructor=instructor)
        
        self.stdout.write(f"Instructor: {instructor.name}")
        self.stdout.write(f"Total timetables: {timetables.count()}")
        
        for tt in timetables:
            self.stdout.write(f"Day: '{tt.day}' | Time: {tt.start_time}-{tt.end_time} | Course: {tt.course.name}")