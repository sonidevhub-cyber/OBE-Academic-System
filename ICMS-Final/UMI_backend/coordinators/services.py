from django.db import transaction
from django.core.exceptions import ValidationError
from .models import TeacherAllocation

def allocate_teacher(curriculum_version, course, teacher, batch, allocated_by, semester_no=None):
    """
    transaction.atomic()
    1. Validate teacher.role == 'teacher'
    2. Validate course in version
    3. Agar existing active allocation for this batch:
       → Old status = 'changed'
       → Naya record banao
         cloned_from = old allocation
    4. Agar nahi:
       → Direct naya record banao
    5. Return naya allocation
    """
    with transaction.atomic():
        # Validate course in version (add it if not there)
        if not curriculum_version.version_courses.filter(course=course).exists():
            from curriculum.models import CurriculumVersionCourse
            CurriculumVersionCourse.objects.create(
                version=curriculum_version,
                course=course,
                semester_no=semester_no if semester_no else course.semester.number if hasattr(course, 'semester') else 1
            )
            
        # Get existing active allocation for THIS batch
        existing = TeacherAllocation.objects.filter(
            curriculum_version=curriculum_version,
            course=course,
            batch=batch,
            status='active'
        ).first()
        
        if existing:
            # If the teacher is the same, no need to do anything
            if existing.teacher == teacher:
                return existing
                
            existing.status = 'changed'
            existing.is_active = False
            existing.save()
            
            # Use provided semester_no or existing one
            final_semester_no = semester_no if semester_no is not None else existing.semester_no
            
            new_allocation = TeacherAllocation.objects.create(
                curriculum_version=curriculum_version,
                course=course,
                batch=batch,
                semester_no=final_semester_no,
                teacher=teacher,
                allocated_by=allocated_by,
                cloned_from=existing,
                status='active'
            )
        else:
            # Get semester_no from provided value or version course or course
            final_semester_no = None
            if semester_no is not None:
                final_semester_no = semester_no
            else:
                try:
                    version_course = curriculum_version.version_courses.get(course=course)
                    final_semester_no = version_course.semester_no
                except:
                    final_semester_no = course.semester.number if hasattr(course, 'semester') else 1
                    
            new_allocation = TeacherAllocation.objects.create(
                curriculum_version=curriculum_version,
                course=course,
                batch=batch,
                semester_no=final_semester_no,
                teacher=teacher,
                allocated_by=allocated_by,
                status='active'
            )
            
        # Create or update CourseSession
        from core.models import Semester
        from obe.models import CourseSession
        
        # Find the semester object
        semester = None
        if batch.current_semester:
            try:
                semester = Semester.objects.get(
                    number=batch.current_semester,
                    program=batch.program
                )
            except Semester.DoesNotExist:
                pass
                
        if not semester and course.semester:
            semester = course.semester
            
        if not semester and final_semester_no:
            try:
                semester = Semester.objects.get(
                    number=final_semester_no,
                    program=batch.program
                )
            except Semester.DoesNotExist:
                pass
                
        # Create or update CourseSession
        CourseSession.objects.update_or_create(
            course=course,
            batch=batch,
            semester=semester,
            defaults={
                'instructor': teacher,
                'is_active': True,
                'assessment_status': 'IN_PROGRESS'
            }
        )
            
        return new_allocation

def cancel_allocation(allocation, cancelled_by, reason):
    """
    - allocation.status = 'cancelled'
    - allocation.change_reason = reason
    - allocation.is_active = False
    - Return updated allocation
    """
    allocation.status = 'cancelled'
    allocation.change_reason = reason
    allocation.is_active = False
    allocation.save()
    return allocation
