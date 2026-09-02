

from decimal import Decimal
from collections import defaultdict

from django.db.models import Q
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from django.utils import timezone

from obe.models import CourseSession, StudentCLOScore, CLO
from curriculum.models import CurriculumVersion
from assessments.models import (
    Assessment as AssessmentModel,
    Question as QuestionModel,
    INTERNAL_ASSESSMENT_TYPES,
)
from assessments.services.clo_service import CLOService
from core.models.course import Course
from .models import SemesterCLOMasterCache, CourseCLOMasterEntry


def should_append_course_to_clo_master(course_session: CourseSession) -> bool:
    return (
        course_session.assessment_status == "ASSESSMENT_DONE"
        or course_session.internal_complete_awaiting_final
    )


def session_needs_clo_cache_sync(course_session: CourseSession, master_cache: SemesterCLOMasterCache) -> bool:
    """Return True when the cache for this session needs to be rebuilt.

    NOTE: Since Coordinator cache entries are now built from the weighted
    CLOService formula (and StudentCLOScore still uses the simple ratio),
    comparing values between those two sources is unreliable. Instead, we
    compare KEY SETS only (did a student/CLO pair appear or disappear?)
    and let the force=True path (retake-updated / manual refresh) handle
    mark edits end-to-end via the normal workflow signals.

    When in doubt, this function prefers returning True (resync) so users
    never see stale numbers at the cost of an occasional rebuild.
    """
    if not should_append_course_to_clo_master(course_session):
        return False

    active_scores_keys = set(
        StudentCLOScore.objects.filter(
            course_session=course_session,
            is_active=True,
        ).values_list("clo_id", "student_id")
    )

    cached_keys = set(
        CourseCLOMasterEntry.objects.filter(
            master_cache=master_cache,
            course_session=course_session,
            is_active=True,
        ).values_list("clo_id", "student_id")
    )

    # If no active scores exist at all but cache has entries, something is
    # off - force a sync so we rebuild from the canonical CLOService path.
    if not active_scores_keys and cached_keys:
        return True

    # Keys differ (students / CLOs added or dropped) → resync
    if active_scores_keys != cached_keys:
        return True

    # Also trigger one-time resync if we detect any legacy entry whose
    # is_kpi_achieved flag mismatches a quick CLOService class pass count
    # sample. This catches caches that still store old formula numbers.
    sample_entries = list(
        CourseCLOMasterEntry.objects.filter(
            master_cache=master_cache,
            course_session=course_session,
            is_active=True,
        )[:5]
    )
    if sample_entries:
        # If ANY clo_score is a whole-number percentage matching the simple
        # ratio pattern (0 decimals or integer like), it's likely legacy.
        # Weighted CLOService values typically have decimals like 61.32
        any_legacy_looking = False
        for entry in sample_entries:
            try:
                score_val = Decimal(str(entry.clo_score))
                if score_val == score_val.to_integral_value():
                    # Whole number could be legacy, check if any difference
                    # by running lightweight CLOService for one CLO.
                    any_legacy_looking = True
                    break
            except Exception:
                pass
        if any_legacy_looking:
            return True

    return False


def sync_stale_clo_master_cache(
    *,
    program,
    batch,
    semester,
    valid_course_ids=None,
    force=False,
) -> SemesterCLOMasterCache | None:
    """
    Keep the semester CLO master cache aligned with live StudentCLOScore data.

    Called on report load so coordinators see the same freshness as GA reports
    without pressing Refresh.
    """
    if not batch:
        return None

    master_cache, _ = SemesterCLOMasterCache.objects.get_or_create(
        program=program,
        batch=batch,
        semester=semester,
        defaults={
            "total_courses_expected": len(valid_course_ids or []),
            "total_courses_finalized": 0,
        },
    )

    if valid_course_ids is not None and master_cache.total_courses_expected != len(valid_course_ids):
        master_cache.total_courses_expected = len(valid_course_ids)
        master_cache.save(update_fields=["total_courses_expected"])

    reportable_sessions = CourseSession.objects.filter(
        course__program=program,
        semester=semester,
        batch=batch,
        is_active=True,
    ).filter(
        Q(assessment_status="ASSESSMENT_DONE")
        | Q(internal_complete_awaiting_final=True)
    ).select_related('course')
    # valid_course_ids here comes from CurriculumVersionCourse which only
    # lists Compulsory courses. Keep elective/selective sessions even when
    # not in that whitelist since they are registered dynamically via
    # StudentElectiveEnrollment.
    if valid_course_ids:
        reportable_sessions = [
            s for s in reportable_sessions
            if s.course_id in valid_course_ids
            or s.course.offering_type in (Course.OFFERING_ELECTIVE, Course.OFFERING_SELECTIVE)
        ]

    for session in reportable_sessions:
        if force or session_needs_clo_cache_sync(session, master_cache):
            append_course_to_clo_master(sender=CourseSession, instance=session, created=False)

    master_cache.refresh_from_db()
    return master_cache


@receiver(post_save, sender=CourseSession)
def append_course_to_clo_master(sender, instance, created, **kwargs):
    """
    Signal that updates CLO master cache when a course session has reportable
    CLO scores (final complete or provisional internals-only snapshot).
    """
    if not should_append_course_to_clo_master(instance):
        return

    with transaction.atomic():
        program = instance.course.program
        batch = instance.batch
        semester = instance.semester
        course = instance.course

        if not program or not batch or not semester or not course:
            return

        # Get curriculum version from BATCH (batch.curriculum_version, not from curriculum.batch)
        curriculum = batch.curriculum_version

        # Get total courses expected in this semester for this program/curriculum
        expected_courses_count = 0
        valid_course_ids = []
        if curriculum:
            # Use version_courses (through CurriculumVersionCourse) which has semester_no.
            # This list only contains Compulsory courses; Elective/Selective are
            # registered dynamically via StudentElectiveEnrollment so we never
            # gate them against this list.
            semester_courses = curriculum.version_courses.filter(
                semester_no=semester.number if semester else None,
                is_active=True
            ).select_related('course')
            expected_courses_count = semester_courses.count()
            valid_course_ids = [cvc.course.id for cvc in semester_courses]

            # Elective/Selective courses live outside CurriculumVersionCourse
            # so skip the whitelist check for those offering types.
            is_elective_offering = course.offering_type in (Course.OFFERING_ELECTIVE, Course.OFFERING_SELECTIVE)
            if not is_elective_offering and course.id not in valid_course_ids:
                return  # Don't add this course if it's not in the curriculum for this semester
        # If no curriculum version, proceed without valid course check

        # Get or create master cache
        master_cache, cache_created = SemesterCLOMasterCache.objects.get_or_create(
            program=program,
            batch=batch,
            semester=semester,
            defaults={
                'total_courses_expected': expected_courses_count,
                'total_courses_finalized': 0
            }
        )

        # Update expected courses count if necessary
        if master_cache.total_courses_expected != expected_courses_count:
            master_cache.total_courses_expected = expected_courses_count

        # Determine assessment scope based on session state
        if instance.internal_complete_awaiting_final:
            assessment_types = INTERNAL_ASSESSMENT_TYPES
            report_status = "INTERNAL"
        else:
            assessment_types = None
            report_status = "FINAL"

        # ----------------------------------------------------------
        # Use the same WEIGHTED CLOService formula as Instructor report
        # so Coordinator and Instructor numbers are 100% consistent.
        # ----------------------------------------------------------
        clo_service_result = CLOService.generate_student_report(
            course_id=course.id,
            batch_id=batch.id,
            semester_id=semester.id,
            assessment_types=assessment_types,
            report_status=report_status,
            lock_attainment=False,
        )

        seen_entry_keys = set()

        if isinstance(clo_service_result, dict) and clo_service_result.get("error"):
            # ----------------------------------------------------------
            # FALLBACK: CLOService couldn't produce a report (e.g. no
            # finalized assessments yet). Use StudentCLOScore simple
            # ratio so pending caches still get a baseline.
            # ----------------------------------------------------------
            from obe.services import _get_enrolled_student_ids_for_course_session
            enrolled_ids = _get_enrolled_student_ids_for_course_session(instance)
            enrolled_str_ids = {str(sid) for sid in enrolled_ids}

            student_clo_scores = StudentCLOScore.objects.filter(
                course_session=instance
            ).select_related('student', 'clo', 'clo__course')
            # Skip the curriculum_version whitelist filter for
            # Elective/Selective offerings — they live outside
            # CurriculumVersionCourse so their CLO rows may carry
            # a different curriculum_version or NULL.
            is_elective_offering = course.offering_type in (Course.OFFERING_ELECTIVE, Course.OFFERING_SELECTIVE)
            if curriculum and not is_elective_offering:
                student_clo_scores = student_clo_scores.filter(
                    clo__curriculum_version=curriculum
                )

            for score in student_clo_scores:
                if str(score.student_id) not in enrolled_str_ids:
                    continue
                kpi = score.clo.kpi_target
                is_achieved = score.attainment >= kpi
                entry_key = (score.clo_id, score.student_id)
                seen_entry_keys.add(entry_key)

                CourseCLOMasterEntry.objects.update_or_create(
                    master_cache=master_cache,
                    course_session=instance,
                    clo=score.clo,
                    student=score.student,
                    defaults={
                        'course': score.clo.course,
                        'clo_score': score.attainment,
                        'is_kpi_achieved': is_achieved,
                        'finalized_at': timezone.now(),
                        'is_active': True,
                    }
                )
        else:
            # ----------------------------------------------------------
            # PRIMARY: Build entries from weighted CLOService output
            # so Coordinator CLO Master matches Instructor CLO report.
            # ----------------------------------------------------------
            from students.models import Student as StudentModel

            # --- Build CLO lookup per order_number (same logic as
            #     StudentCLOScore uses: pick the CLO with real questions).
            from assessments.models import Assessment as AssessmentModel

            finalized_assessments = AssessmentModel.objects.filter(
                course_id=course.id,
                batch_id=batch.id,
                semester_id=semester.id,
                is_finalized=True,
                course_retake__isnull=True,
            )
            if assessment_types is not None:
                finalized_assessments = finalized_assessments.filter(
                    assessment_type__in=assessment_types
                )

            # Elective/Selective courses are registered dynamically and may not have
            # their CLO rows attached to this specific batch curriculum_version.
            # Drop the curriculum whitelist filter for those offering types.
            is_elective_offering = course.offering_type in (Course.OFFERING_ELECTIVE, Course.OFFERING_SELECTIVE)
            if curriculum and not is_elective_offering:
                course_clos = list(
                    CLO.objects.filter(
                        course=course,
                        is_active=True,
                        curriculum_version=curriculum,
                    )
                )
            else:
                course_clos = list(
                    CLO.objects.filter(course=course, is_active=True)
                )
            clos_by_order = defaultdict(list)
            for clo in course_clos:
                clos_by_order[clo.order_number].append(clo)

            target_clo_per_order = {}
            for order_num, clo_list in clos_by_order.items():
                selected = None
                for clo in clo_list:
                    has_q = QuestionModel.objects.filter(
                        clo=clo,
                        assessment__in=finalized_assessments,
                    ).exists()
                    if has_q:
                        selected = clo
                        break
                if selected is None and clo_list:
                    selected = clo_list[0]
                target_clo_per_order[order_num] = selected

            # --- Build Student lookup by student_id (UUID)
            student_ids_in_report = []
            for row in clo_service_result.get("students", []):
                try:
                    sid = row.get("student_id")
                    if sid:
                        student_ids_in_report.append(sid)
                except Exception:
                    pass

            db_students = StudentModel.objects.filter(
                student_id__in=student_ids_in_report
            ).select_related("user")
            student_by_id = {str(s.student_id): s for s in db_students}

            # --- Write weighted CLO percentages into cache entries
            for row in clo_service_result.get("students", []):
                row_student_id = row.get("student_id")
                student = student_by_id.get(str(row_student_id)) if row_student_id else None
                if student is None:
                    continue

                clo_attainment = row.get("clo_attainment", {}) or {}

                for clo_code, data in clo_attainment.items():
                    # clo_code looks like "CLO-1"
                    try:
                        order_str = clo_code.replace("CLO-", "")
                        order_num = int(order_str)
                    except (ValueError, AttributeError):
                        continue

                    target_clo = target_clo_per_order.get(order_num)
                    if target_clo is None:
                        continue

                    percentage = Decimal(str(data.get("percentage", 0) or 0))
                    kpi_target = Decimal(str(data.get("kpi", target_clo.kpi_target) or target_clo.kpi_target))
                    is_achieved = percentage >= kpi_target

                    entry_key = (target_clo.id, student.student_id)
                    seen_entry_keys.add(entry_key)

                    CourseCLOMasterEntry.objects.update_or_create(
                        master_cache=master_cache,
                        course_session=instance,
                        clo=target_clo,
                        student=student,
                        defaults={
                            'course': course,
                            'clo_score': round(percentage, 2),
                            'is_kpi_achieved': is_achieved,
                            'finalized_at': timezone.now(),
                            'is_active': True,
                        }
                    )

        # Mark stale rows for this session as inactive so the master keeps the
        # latest snapshot without leaving orphaned historical values visible.
        for existing_entry in CourseCLOMasterEntry.objects.filter(
            master_cache=master_cache,
            course_session=instance,
        ).select_related("clo", "student"):
            if (existing_entry.clo_id, existing_entry.student_id) not in seen_entry_keys:
                existing_entry.is_active = False
                existing_entry.save(update_fields=["is_active"])

        # Update master cache stats (only count valid courses)
        finalized_entries_query = CourseCLOMasterEntry.objects.filter(
            master_cache=master_cache,
            is_active=True
        )
        # valid_course_ids here = CurriculumVersionCourse (Compulsory only).
        # Expand the filter so Elective/Selective sessions with entries also
        # advance total_courses_finalized; otherwise the cache shows
        # not-fully-compiled and coordinator reports miss the elective column.
        if valid_course_ids:
            finalized_entries_query = finalized_entries_query.filter(
                Q(course__id__in=valid_course_ids)
                | Q(course__offering_type__in=(Course.OFFERING_ELECTIVE, Course.OFFERING_SELECTIVE))
            )
        finalized_course_sessions = finalized_entries_query.values_list('course_session_id', flat=True).distinct()
        final_count = finalized_course_sessions.count()

        master_cache.total_courses_finalized = final_count
        master_cache.is_fully_compiled = (
            master_cache.total_courses_finalized >= master_cache.total_courses_expected
        )
        master_cache.save()
