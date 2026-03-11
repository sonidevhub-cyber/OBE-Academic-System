from django.core.management.base import BaseCommand
from students.models import Student
from academics.models import Course

class Command(BaseCommand):
    help = 'Reassign courses to students based on their semester'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made'))

        students = Student.objects.all()
        total_students = students.count()
        updated_students = 0

        self.stdout.write(f'Processing {total_students} students...')

        for student in students:
            if not student.semester:
                self.stdout.write(f'Skipping student {student.student_id} ({student.name}) - no semester assigned')
                continue

            # Get all courses for this semester
            semester_courses = Course.objects.filter(
                semester__semester_id=student.semester.semester_id
            )

            if not semester_courses.exists():
                self.stdout.write(f'No courses found for semester {student.semester.name} (student: {student.student_id})')
                continue

            current_course_count = student.courses.count()
            semester_course_count = semester_courses.count()

            if current_course_count != semester_course_count:
                if dry_run:
                    self.stdout.write(
                        f'Would update student {student.student_id} ({student.name}): '
                        f'{current_course_count} -> {semester_course_count} courses'
                    )
                else:
                    # Clear existing courses and assign new ones
                    student.courses.clear()
                    student.courses.set(semester_courses)
                    updated_students += 1
                    self.stdout.write(
                        f'Updated student {student.student_id} ({student.name}): '
                        f'{current_course_count} -> {semester_course_count} courses'
                    )
            else:
                # Check if the courses match
                current_course_ids = set(student.courses.values_list('course_id', flat=True))
                semester_course_ids = set(semester_courses.values_list('course_id', flat=True))

                if current_course_ids != semester_course_ids:
                    if dry_run:
                        self.stdout.write(
                            f'Would reassign courses for student {student.student_id} ({student.name}): '
                            f'courses do not match semester'
                        )
                    else:
                        student.courses.clear()
                        student.courses.set(semester_courses)
                        updated_students += 1
                        self.stdout.write(
                            f'Reassigned courses for student {student.student_id} ({student.name})'
                        )

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(f'Dry run complete. Would update {updated_students} students.')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f'Successfully updated {updated_students} out of {total_students} students.')
            )
