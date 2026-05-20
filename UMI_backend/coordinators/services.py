from django.db import transaction
from django.core.exceptions import ValidationError
from .models import TeacherAllocation

def allocate_teacher(curriculum_version, course, teacher, allocated_by):
    """
    transaction.atomic()
    1. Validate teacher.role == 'teacher'
    2. Validate course in version
    3. Agar existing active allocation:
       → Old status = 'changed'
       → Naya record banao
         cloned_from = old allocation
    4. Agar nahi:
       → Direct naya record banao
    5. Return naya allocation
    """
    with transaction.atomic():
        # Validate course in version
        if not curriculum_version.version_courses.filter(course=course).exists():
            raise ValidationError("Course is not part of this curriculum version")
            
        # Get existing active allocation
        existing = TeacherAllocation.objects.filter(
            curriculum_version=curriculum_version,
            course=course,
            status='active'
        ).first()
        
        if existing:
            existing.status = 'changed'
            existing.is_active = False
            existing.save()
            
            new_allocation = TeacherAllocation.objects.create(
                curriculum_version=curriculum_version,
                course=course,
                batch=curriculum_version.batch,
                semester_no=existing.semester_no, # Copy semester_no
                teacher=teacher,
                allocated_by=allocated_by,
                cloned_from=existing,
                status='active'
            )
        else:
            # Need to find semester_no from version course
            version_course = curriculum_version.version_courses.get(course=course)
            new_allocation = TeacherAllocation.objects.create(
                curriculum_version=curriculum_version,
                course=course,
                batch=curriculum_version.batch,
                semester_no=version_course.semester_no,
                teacher=teacher,
                allocated_by=allocated_by,
                status='active'
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
