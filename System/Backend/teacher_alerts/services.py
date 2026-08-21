from obe.models import GACQIRecord, CLOGAMapping
from core.models import Batch, Course


def get_previous_batch_same_curriculum(batch):
    """
    Get previous batch with same curriculum version
    """
    if not batch.curriculum_version:
        return None
        
    # Get batches with same curriculum version, earlier start date
    previous_batches = Batch.objects.filter(
        curriculum_version=batch.curriculum_version,
        start_date__lt=batch.start_date
    ).order_by('-start_date')
    
    return previous_batches.first()


def get_teacher_ga_warnings(teacher, course):
    """
    Get GA warnings for teacher dashboard based on previous batch's CQIs
    """
    ga_mappings = CLOGAMapping.objects.filter(
        clo__course=course, 
        is_active=True
    ).select_related('ga')
    
    if not ga_mappings.exists():
        return None
        
    previous_batch = get_previous_batch_same_curriculum(course.batch)
    
    if not previous_batch:
        return None
        
    warnings = []
    
    # Get unique GAs from mappings
    gas = set()
    for mapping in ga_mappings:
        gas.add(mapping.ga)
        
    for ga in gas:
        prev_record = GACQIRecord.objects.filter(
            ga=ga, 
            batch=previous_batch,
            cqi_level='CUMULATIVE', 
            status='SAVED', 
            is_active=True
        ).first()
        
        if prev_record:
            warnings.append({
                'ga_id': str(ga.id),
                'ga_code': f'GA-{ga.order_number}',
                'ga_title': ga.title,
                'message': f"Previous batch showed weakness in GA-{ga.order_number} ({ga.title}). "
                          f"Since your current course targets GA-{ga.order_number}, "
                          f"please focus more on problem-solving tasks in assignments.",
                'prev_cqi_record_id': str(prev_record.id)
            })
            
    return warnings
