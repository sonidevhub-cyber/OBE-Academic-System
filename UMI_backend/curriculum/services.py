from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from .models import CurriculumVersion, CurriculumVersionCourse
from coordinators.models import TeacherAllocation

def clone_curriculum_for_batch(source_version, target_batch, created_by):
    """
    transaction.atomic()
    1. Nayi CurriculumVersion banao:
       - status = 'draft'
       - cloned_from = source_version
       - version_no = auto-generate
       - batch = target_batch
    2. Sab CurriculumVersionCourse copy karo
    3. clone_allocations_for_version() call karo (Module 2 ka function)
    4. Return naya draft version
    """
    with transaction.atomic():
        # Auto-generate version_no
        existing_count = CurriculumVersion.objects.filter(program=source_version.program).count()
        new_version_no = f"v{existing_count + 1}.0"
        
        new_version = CurriculumVersion.objects.create(
            program=source_version.program,
            batch=target_batch,
            version_no=new_version_no,
            status='draft',
            cloned_from=source_version,
            created_by=created_by
        )
        
        # Copy courses
        for vc in source_version.version_courses.all():
            CurriculumVersionCourse.objects.create(
                version=new_version,
                course=vc.course,
                semester_no=vc.semester_no
            )
            
        # Clone allocations
        clone_allocations_for_version(source_version, new_version)
        
        return new_version

def suggest_curriculum_for_new_batch(batch):
    """
    1. batch.program ki latest active version nikalo
    2. Agar milti hai:
       → clone_curriculum_for_batch()
       → Coordinator ko flag: "Suggested curriculum ready for review"
    3. Agar nahi milti:
       → Empty draft banao
    4. Return draft version
    """
    latest_active = CurriculumVersion.objects.filter(
        program=batch.program, 
        status='active'
    ).first()
    
    if latest_active:
        # We need a user to 'create' this. In a signal, we might not have one.
        # For now, use the program's created_by or a system user.
        created_by = batch.program.created_by
        return clone_curriculum_for_batch(latest_active, batch, created_by)
    else:
        # Create empty draft
        existing_count = CurriculumVersion.objects.filter(program=batch.program).count()
        version = CurriculumVersion.objects.create(
            program=batch.program,
            batch=batch,
            version_no=f"v{existing_count + 1}.0",
            status='draft',
            created_by=batch.program.created_by
        )
        sync_courses_from_program(version)
        return version

def activate_curriculum_version(version, activated_by):
    """
    transaction.atomic()
    1. Check: status == 'draft'
    2. Check: >= 1 course exist kare
    3. Check: har course mein >= 1 CLO ho (TODO: Implement CLO check)
    4. Check: har course ki allocation ho
    5. Previous active → 'archived'
    6. Is version → 'active'
    7. activated_by, activated_at set karo
    8. create_offerings_from_version() call karo
    9. Return activated version
    """
    with transaction.atomic():
        if version.status != 'draft':
            raise ValidationError("Only draft versions can be activated")
            
        courses = version.version_courses.all()
        if not courses.exists():
            raise ValidationError("Curriculum version must have at least one course")
            
        # Check allocations
        missing_allocations = []
        for vc in courses:
            if not TeacherAllocation.objects.filter(
                curriculum_version=version, 
                course=vc.course, 
                status='active'
            ).exists():
                missing_allocations.append(vc.course.name)
        
        if missing_allocations:
            raise ValidationError(f"Please allocate teachers for: {', '.join(missing_allocations)}")
            
        # Previous active → 'archived'
        CurriculumVersion.objects.filter(
            program=version.program, 
            batch=version.batch, 
            status='active'
        ).update(status='archived')
        
        # Is version → 'active'
        version.status = 'active'
        version.activated_by = activated_by
        version.activated_at = timezone.now()
        version.save()
        
        return version

def sync_courses_from_program(version):
    """
    Copies all courses from the Program into the CurriculumVersion.
    Used for Auto-Sync when a new version is created.
    """
    from core.models.course import Course
    
    with transaction.atomic():
        program_courses = Course.objects.filter(program=version.program, is_active=True)
        
        for course in program_courses:
            # Avoid duplicates if any exist
            CurriculumVersionCourse.objects.get_or_create(
                version=version,
                course=course,
                defaults={'semester_no': course.semester.number}
            )

def create_offerings_from_version(version):
    """
    transaction.atomic()
    Har CurriculumVersionCourse ke liye:
    - CourseOffering banao (Using CourseSession model from obe app)
    - teacher = TeacherAllocation se copy
    - curriculum_version = version
    Return list of offerings
    """
    from obe.models import CourseSession
    offerings = []
    
    with transaction.atomic():
        academic_year = f"{version.batch.session_type}-{version.batch.start_year}" # Example year
        
        for vc in version.version_courses.all():
            allocation = TeacherAllocation.objects.filter(
                curriculum_version=version, 
                course=vc.course, 
                status='active'
            ).first()
            
            # Use CourseSession since it exists in obe app
            session, created = CourseSession.objects.update_or_create(
                course=vc.course,
                batch=version.batch,
                academic_year=academic_year,
                defaults={
                    'instructor': allocation.teacher if allocation else None,
                    'semester_number': vc.semester_no,
                    'status': 'allocated' if allocation else 'pending'
                }
            )
            offerings.append(session)
            
    return offerings

# Module 2 Service Functions (Placeholders or actual implementations)

def clone_allocations_for_version(source_version, new_version):
    # Module 2 function placeholder or actual implementation
    pass
