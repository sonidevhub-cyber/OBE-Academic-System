
import os
import sys
import django

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "umi_backend.settings")
django.setup()

from obe.models import CourseSession
from obe.services import calculate_all_course_ga_scores
from clo_master.services import update_clo_master_cache

print("Finding CourseSession for db201, BAT-BSCS-2025-F-1, vs2025...")
# Find course session
try:
    session = CourseSession.objects.filter(
        course__code="db201",
        batch__name="BAT-BSCS-2025-F-1",
        semester__name="vs2025"
    ).first()
    
    if session:
        print(f"Found CourseSession: {session.course} - {session.batch} - {session.semester}")
        
        # Recalculate course scores
        print("Recalculating all course ga scores...")
        calculate_all_course_ga_scores(session)
        print("Recalculated course scores!")
        
        # Also update clo master cache
        print("Updating CLO master cache...")
        update_clo_master_cache(session)
        print("Updated clo master cache!")
        
        from students.models import Student
        from obe.models import StudentCLOScore
        
        # Find mudassar
        student = Student.objects.filter(registration_number="BAT-BSCS-2026-F-1-3").first()
        if student:
            print(f"Student: {student.name}")
            scores = StudentCLOScore.objects.filter(
                student=student,
                course_session=session
            )
            for score in scores:
                print(f"  {score.clo}: {score.attainment}%")
    else:
        print("CourseSession not found")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

