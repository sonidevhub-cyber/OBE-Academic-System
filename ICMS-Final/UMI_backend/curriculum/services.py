from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from .models import CurriculumVersion, CurriculumVersionCourse
from coordinators.models import TeacherAllocation

def clone_curriculum_for_batch(source_version, target_batch, created_by):
    """
    Lazy Versioning:
    Cloning initially just links the target_batch to the source_version.
    No new CurriculumVersion record is created immediately.
    """
    with transaction.atomic():
        if target_batch:
            target_batch.curriculum_version = source_version
            target_batch.save()
        return source_version

def branch_version_if_needed(version, batch, user):
    """
    Helper to create a new draft version if changes are made to a shared or finalized version.
    Used for Lazy Versioning.
    """
    # If it's already a draft and ONLY used by this batch, no need to branch
    if version.status == 'draft' and version.assigned_batches.count() == 1 and version.assigned_batches.first() == batch:
        return version

    # Otherwise, create a new draft branch
    with transaction.atomic():
        base_version_no = version.version_no.split('.')[0]
        existing_count = CurriculumVersion.objects.filter(program=version.program, version_no__startswith=base_version_no).count()
        new_version_no = f"{base_version_no}.{existing_count}"

        new_version = CurriculumVersion.objects.create(
            program=version.program,
            version_no=new_version_no,
            status='draft',
            cloned_from=version,
            created_by=user
        )

        # Update this specific batch to point to the new branch
        batch.curriculum_version = new_version
        batch.save()

        # Copy courses
        for vc in version.version_courses.all():
            CurriculumVersionCourse.objects.create(
                version=new_version,
                course=vc.course,
                semester_no=vc.semester_no
            )
        
        # Copy OBE data
        from obe.models import CLO, CLOGAMapping, CLOPIMapping
        source_clos = CLO.objects.filter(curriculum_version=version, is_active=True)
        for s_clo in source_clos:
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
            # Copy GA mappings
            for gm in CLOGAMapping.objects.filter(clo=s_clo, is_active=True):
                CLOGAMapping.objects.create(
                    clo=new_clo,
                    ga=gm.ga,
                    weight=gm.weight,
                    is_active=True
                )
            # Copy PI mappings
            for pm in CLOPIMapping.objects.filter(clo=s_clo, is_active=True):
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
       → Reuse existing version (Standardization)
    3. Agar nahi milti:
       → Empty draft banao
    4. Return version
    """
    latest_finalized = CurriculumVersion.objects.filter(
        program=batch.program, 
        status='finalized'
    ).first()
    
    if latest_finalized:
        # Link batch to existing finalized version instead of cloning immediately
        batch.curriculum_version = latest_finalized
        batch.save()
        return latest_finalized
    else:
        # Create empty draft if no finalized version exists
        existing_count = CurriculumVersion.objects.filter(program=batch.program).count()
        version = CurriculumVersion.objects.create(
            program=batch.program,
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
        
        # Create offerings (Module 3) - Disabled as per user request to separate allocation from versioning
        # create_offerings_from_version(version)
        
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
    
    # Get all batches assigned to this version
    # Since Batch model has curriculum_version as FK with related_name 'assigned_batches'
    batches = version.assigned_batches.all()
    
    # If no batches linked via assigned_batches, try the single 'batch' FK on version
    if not batches.exists() and version.batch:
        import django.db.models.query
        if isinstance(batches, django.db.models.query.QuerySet):
             from core.models.batch import Batch
             batches = Batch.objects.filter(id=version.batch.id)
        else:
             batches = [version.batch]

    if not batches:
        return []

    with transaction.atomic():
        for batch in batches:
            for vc in version.version_courses.all():
                # Check for allocation specific to THIS batch
                allocation = TeacherAllocation.objects.filter(
                    curriculum_version=version, 
                    course=vc.course,
                    batch=batch,
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
                    batch=batch,
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
            # Use new_version.batch if set, otherwise fallback to original allocation's batch
            target_batch = new_version.batch or alloc.batch
            
            if not target_batch:
                continue # Skip if no batch can be determined

            TeacherAllocation.objects.create(
                curriculum_version=new_version,
                course=alloc.course,
                batch=target_batch,
                semester_no=alloc.semester_no,
                teacher=alloc.teacher,
                allocated_by=new_version.created_by,
                cloned_from=alloc,
                status='active'
            )
