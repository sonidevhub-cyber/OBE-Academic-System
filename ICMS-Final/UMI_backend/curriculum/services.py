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
       - version_no = same as source (now allowed by unique_together update)
       - batch = target_batch
    2. Sab CurriculumVersionCourse copy karo
    3. clone_allocations_for_version() call karo
    4. Link batch to this version
    5. Return naya draft version
    """
    with transaction.atomic():
        # Use the same version number as master, but linked to this batch
        new_version_no = source_version.version_no
        
        new_version = CurriculumVersion.objects.create(
            program=source_version.program,
            batch=target_batch,
            version_no=new_version_no,
            status='draft',
            cloned_from=source_version,
            created_by=created_by
        )
        
        # Link batch to this version immediately
        target_batch.curriculum_version = new_version
        target_batch.save()
        
        # Copy courses
        for vc in source_version.version_courses.all():
            CurriculumVersionCourse.objects.create(
                version=new_version,
                course=vc.course,
                semester_no=vc.semester_no
            )
            
        # Clone allocations
        clone_allocations_for_version(source_version, new_version)
        
        # Clone CLOs and Mappings (OBE)
        from obe.models import CLO, CLOGAMapping, CLOPIMapping
        source_clos = CLO.objects.filter(curriculum_version=source_version, is_active=True)
        
        for s_clo in source_clos:
            # Create new CLO
            new_clo = CLO.objects.create(
                course=s_clo.course,
                curriculum_version=new_version,
                title=s_clo.title,
                description=s_clo.description,
                order_number=s_clo.order_number,
                bloom_level=s_clo.bloom_level,
                kpi_target=s_clo.kpi_target,
                is_active=True
            )
            
            # Copy GA Mappings for this CLO
            ga_mappings = CLOGAMapping.objects.filter(clo=s_clo, is_active=True)
            for gm in ga_mappings:
                CLOGAMapping.objects.create(
                    clo=new_clo,
                    ga=gm.ga,
                    weight=gm.weight,
                    is_active=True
                )
                
            # Copy PI Mappings for this CLO
            pi_mappings = CLOPIMapping.objects.filter(clo=s_clo, is_active=True)
            for pm in pi_mappings:
                CLOPIMapping.objects.create(
                    clo=new_clo,
                    pi=pm.pi,
                    weight=pm.weight,
                    is_active=True
                )
        
        return new_version

def suggest_curriculum_for_new_batch(batch):
    """
    1. batch.program ki latest finalized version nikalo
    2. Agar milti hai:
       → clone_curriculum_for_batch()
       → Coordinator ko flag: "Suggested curriculum ready for review"
    3. Agar nahi milti:
       → Empty draft banao
    4. Return draft version
    """
    latest_finalized = CurriculumVersion.objects.filter(
        program=batch.program, 
        status='finalized'
    ).first()
    
    if latest_finalized:
        # We need a user to 'create' this. In a signal, we might not have one.
        # For now, use the program's created_by or a system user.
        created_by = batch.program.created_by
        return clone_curriculum_for_batch(latest_finalized, batch, created_by)
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
        
        # Link batch to this version
        batch.curriculum_version = version
        batch.save()
        
        sync_courses_from_program(version)
        return version

def activate_curriculum_version(version, activated_by):
    """
    transaction.atomic()
    1. Check: status == 'draft'
    2. Check: >= 1 course exist kare
    3. Previous finalized → 'archived'
    4. Is version → 'finalized'
    5. activated_by, activated_at set karo
    6. create_offerings_from_version() call karo
    7. Return activated version
    """
    with transaction.atomic():
        if version.status != 'draft':
            raise ValidationError("Only draft versions can be finalized")
            
        courses = version.version_courses.all()
        if not courses.exists():
            raise ValidationError("Curriculum version must have at least one course")
            
        # Previous finalized → 'archived'
        CurriculumVersion.objects.filter(
            program=version.program, 
            batch=version.batch, 
            status='finalized'
        ).update(status='archived')
        
        # Is version → 'finalized'
        version.status = 'finalized'
        version.activated_by = activated_by
        version.activated_at = timezone.now()
        version.save()
        
        # Create offerings (Module 3)
        create_offerings_from_version(version)
        
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
        for vc in version.version_courses.all():
            allocation = TeacherAllocation.objects.filter(
                curriculum_version=version, 
                course=vc.course, 
                status='active'
            ).first()
            
            # Find the core.Semester object for the course's semester_no in this batch's program
            from core.models import Semester as CoreSemester
            semester_obj = CoreSemester.objects.filter(
                program=version.program,
                number=vc.semester_no
            ).first()

            # Use CourseSession since it exists in obe app
            session, created = CourseSession.objects.update_or_create(
                course=vc.course,
                batch=version.batch,
                semester=semester_obj,
                defaults={
                    'instructor': allocation.teacher if allocation else None,
                    'is_active': True
                }
            )
            offerings.append(session)
            
    return offerings

def clone_allocations_for_version(source_version, new_version):
    """
    Copies all active TeacherAllocations from source_version to new_version.
    Each allocation is a NEW database record.
    """
    with transaction.atomic():
        allocations = TeacherAllocation.objects.filter(
            curriculum_version=source_version,
            status='active'
        )
        
        for alloc in allocations:
            TeacherAllocation.objects.create(
                curriculum_version=new_version,
                course=alloc.course,
                batch=new_version.batch,
                semester_no=alloc.semester_no,
                teacher=alloc.teacher,
                allocated_by=new_version.created_by,
                cloned_from=alloc,
                status='active'
            )
