from __future__ import annotations

from django.db import transaction

from obe.models import CourseSession, GAReport, GAMasterCache
from obe.services import calculate_ga_report

from .invalidation_service import resolve_invalidation_logs


def refresh_ga_master_cache_for_batch(batch):
    session = (
        CourseSession.objects.filter(batch=batch, is_active=True, assessment_status="ASSESSMENT_DONE")
        .order_by("-created_at")
        .first()
    )
    if session is None:
        return None

    from obe.signals import update_ga_master_cache

    with transaction.atomic():
        update_ga_master_cache(sender=CourseSession, instance=session, created=False)
        GAMasterCache.objects.filter(batch=batch).update(needs_recalculation=False)
        resolve_invalidation_logs(batch=batch)
        return GAMasterCache.objects.filter(batch=batch).first()


def get_ga_report_with_invalidation_check(batch, *, refresh_master_cache=False):
    # TODO: Wire existing GA report views to call this helper before rendering.
    # That keeps the lazy refresh behavior in one place without changing CQI flows.
    if refresh_master_cache:
        refresh_ga_master_cache_for_batch(batch)

    stale_reports = GAReport.objects.filter(batch=batch, needs_recalculation=True)
    if stale_reports.exists():
        stale_reports.update(is_locked=False)
        report_rows = calculate_ga_report(batch)
        GAReport.objects.filter(batch=batch).update(needs_recalculation=False)
        resolve_invalidation_logs(batch=batch)
        return report_rows

    return calculate_ga_report(batch)
