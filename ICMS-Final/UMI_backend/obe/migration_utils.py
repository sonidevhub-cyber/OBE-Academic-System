"""
Alumni Survey -> Flexible SurveyQuestion Migration Utilities.

Legacy model (1:1 per PEO, per-student per-question rows):
    AlumniSurveyQuestion (peo FK, question_text)
    AlumniSurveyResponse  (cycle+student+question PK, score, employment_*)

New flexible model (N questions per PEO + general unscored):
    SurveyQuestion (survey_type=ALUMNI, peo FK nullable, version_snapshot_id)
    AlumniSurveySubmission (cycle+student PK, employment_*, employer_contact_email)
    AlumniSurveyAnswer (submission+question PK, score)

Rules enforced here:
  * Existing AlumniSurveyResponse rows are NEVER mutated or deleted.
    Historical integrity via version_snapshot_id = original AlumniSurveyQuestion.id
  * New SurveyQuestion rows created for each legacy AlumniSurveyQuestion get
    version_snapshot_id = original question UUID so old responses can be
    traced / re-associated if needed.
  * Coordinator runs steps 1-4 below BEFORE enabling flexible questions on
    any new cycle; legacy AlumniSurveyQuestion/Response remain readable by
    the scoring pipeline as a fallback (see get_flexible_peo_indirect_score).

Step-by-step operator flow (see run_full_alumni_migration docstring):
    1. migrate_alumni_questions_to_survey_question  (idempotent)
    2. seed_alumni_submissions_from_legacy_responses (idempotent)
    3. (optional) backfill_alumni_answers_from_legacy_responses — ONLY for
       cycles the Coordinator wants fully in the new model. Historical
       cycles can stay on the legacy path, since scoring falls through.
    4. verify_alumni_migration_integrity — counts + scoring parity check.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.db.models import Avg

from .models import (
    ALUMNI_SURVEY_TEMPLATE_PREFIX,
    SURVEY_TYPE_ALUMNI,
    AlumniSurveyAnswer,
    AlumniSurveyQuestion,
    AlumniSurveyResponse,
    AlumniSurveySubmission,
    PEO,
    SurveyQuestion,
)


@dataclass
class MigrationStepSummary:
    created: int = 0
    skipped_existing: int = 0
    errors: int = 0
    notes: list[str] | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "created": self.created,
            "skipped_existing": self.skipped_existing,
            "errors": self.errors,
            "notes": self.notes or [],
        }


def migrate_alumni_questions_to_survey_question(
    *,
    program_id: str | None = None,
    lock_migrated: bool = False,
) -> MigrationStepSummary:
    """
    For every active legacy AlumniSurveyQuestion, create a matching
    SurveyQuestion (survey_type=ALUMNI, peo=same, program=peo.program)
    with version_snapshot_id = AlumniSurveyQuestion.id.

    Idempotent: if a SurveyQuestion with the same version_snapshot_id
    already exists it is skipped (not overwritten) so any Coordinator
    edits/additions on the flexible side are preserved on re-run.
    """
    summary = MigrationStepSummary(notes=[])

    legacy_qs = AlumniSurveyQuestion.objects.filter(is_active=True).select_related(
        "peo", "peo__program"
    )
    if program_id is not None:
        legacy_qs = legacy_qs.filter(peo__program_id=program_id)

    already_migrated_ids = set(
        SurveyQuestion.objects.filter(
            survey_type=SURVEY_TYPE_ALUMNI,
            version_snapshot_id__isnull=False,
        ).values_list("version_snapshot_id", flat=True)
    )

    bulk: list[SurveyQuestion] = []
    for legacy in legacy_qs:
        if str(legacy.id) in {str(x) for x in already_migrated_ids}:
            summary.skipped_existing += 1
            continue
        if legacy.peo is None:
            summary.errors += 1
            summary.notes.append(f"Skipped legacy question {legacy.id}: peo FK is null")
            continue
        bulk.append(SurveyQuestion(
            survey_type=SURVEY_TYPE_ALUMNI,
            program=legacy.peo.program,
            peo=legacy.peo,
            question_text=legacy.question_text,
            is_locked=legacy.is_locked or lock_migrated,
            is_active=True,
            version_snapshot_id=legacy.id,
        ))

    if bulk:
        SurveyQuestion.objects.bulk_create(bulk, ignore_conflicts=True, batch_size=200)
        summary.created = len(bulk)

    return summary


def seed_alumni_submissions_from_legacy_responses(
    *,
    alumni_cycle_id: str | None = None,
) -> MigrationStepSummary:
    """
    For every (cycle, student) that already has legacy AlumniSurveyResponse
    rows, create one AlumniSurveySubmission header row carrying over the
    employment_status / organization_name / current_designation fields.

    Idempotent — get_or_create on (cycle, student). Re-run safe.
    """
    summary = MigrationStepSummary(notes=[])

    resp_qs = AlumniSurveyResponse.objects.filter(is_active=True)
    if alumni_cycle_id is not None:
        resp_qs = resp_qs.filter(cycle_id=alumni_cycle_id)

    per_student = (
        resp_qs
        .values("cycle_id", "student_id", "employment_status", "organization_name", "current_designation")
        .distinct()
    )

    with transaction.atomic():
        for row in per_student.iterator(chunk_size=500):
            _, was_created = AlumniSurveySubmission.objects.get_or_create(
                cycle_id=row["cycle_id"],
                student_id=row["student_id"],
                defaults={
                    "employment_status": row.get("employment_status"),
                    "organization_name": row.get("organization_name"),
                    "current_designation": row.get("current_designation"),
                },
            )
            if was_created:
                summary.created += 1
            else:
                summary.skipped_existing += 1

    return summary


def backfill_alumni_answers_from_legacy_responses(
    *,
    alumni_cycle_id: str | None = None,
    only_where_answer_missing: bool = True,
) -> MigrationStepSummary:
    """
    Backfill AlumniSurveyAnswer rows from legacy AlumniSurveyResponse.
    Relies on migrate_alumni_questions_to_survey_question having run first
    (so each legacy question.id is stored in SurveyQuestion.version_snapshot_id),
    AND seed_alumni_submissions_from_legacy_responses having run first (so
    a submission row exists per cycle+student).

    *Does not delete or mutate legacy rows* — legacy remains the audit trail.
    """
    summary = MigrationStepSummary(notes=[])

    legacy_qs = AlumniSurveyResponse.objects.filter(is_active=True)
    if alumni_cycle_id is not None:
        legacy_qs = legacy_qs.filter(cycle_id=alumni_cycle_id)

    version_to_flex_qid = {
        str(snap["version_snapshot_id"]): snap["id"]
        for snap in SurveyQuestion.objects.filter(
            survey_type=SURVEY_TYPE_ALUMNI,
            version_snapshot_id__isnull=False,
            is_active=True,
        ).values("id", "version_snapshot_id")
    }
    if not version_to_flex_qid:
        summary.errors += 1
        summary.notes.append(
            "No version_snapshot_id mapping found. Run migrate_alumni_questions_to_survey_question first."
        )
        return summary

    student_cycle_to_submission = {
        (str(row["cycle_id"]), str(row["student_id"])): row["id"]
        for row in AlumniSurveySubmission.objects.filter(
            is_active=True,
        ).values("id", "cycle_id", "student_id")
    }

    existing_answer_keys: set[tuple[str, str]] = set()
    if only_where_answer_missing:
        existing_answer_keys = {
            (str(a["submission_id"]), str(a["question_id"]))
            for a in AlumniSurveyAnswer.objects.filter(is_active=True)
            .values("submission_id", "question_id")
        }

    bulk: list[AlumniSurveyAnswer] = []
    for legacy in legacy_qs.select_related("question").iterator(chunk_size=1000):
        flex_qid = version_to_flex_qid.get(str(legacy.question_id))
        if flex_qid is None:
            summary.errors += 1
            continue
        sub_key = (str(legacy.cycle_id), str(legacy.student_id))
        submission_id = student_cycle_to_submission.get(sub_key)
        if submission_id is None:
            summary.errors += 1
            continue
        ans_key = (str(submission_id), str(flex_qid))
        if ans_key in existing_answer_keys:
            summary.skipped_existing += 1
            continue
        bulk.append(AlumniSurveyAnswer(
            submission_id=submission_id,
            question_id=flex_qid,
            score=legacy.score,
            submitted_at=legacy.submitted_at,
            is_active=True,
        ))
        existing_answer_keys.add(ans_key)
        if len(bulk) >= 2000:
            AlumniSurveyAnswer.objects.bulk_create(bulk, ignore_conflicts=True)
            summary.created += len(bulk)
            bulk = []

    if bulk:
        AlumniSurveyAnswer.objects.bulk_create(bulk, ignore_conflicts=True)
        summary.created += len(bulk)

    return summary


def verify_alumni_migration_integrity(
    *,
    peo_id: str,
    batch_id: str,
    survey_window: str | None = None,
    tolerance_pct: Decimal = Decimal("0.05"),
) -> dict[str, Any]:
    """
    Scoring parity check: returns legacy-vs-flexible indirect score for a
    (PEO, Batch). Operator should confirm delta <= tolerance_pct before
    locking migrated cycles to the new pipeline.
    """
    legacy_resp = AlumniSurveyResponse.objects.filter(
        question__peo_id=peo_id,
        cycle__batch_id=batch_id,
        is_active=True,
        question__is_active=True,
    )
    if survey_window:
        legacy_resp = legacy_resp.filter(cycle__survey_window=survey_window)

    legacy_avg = legacy_resp.aggregate(a=Avg("score"))["a"]
    legacy_pct: Decimal | None = None
    if legacy_avg is not None:
        legacy_pct = ((Decimal(str(legacy_avg)) - Decimal("1")) / Decimal("4")) * Decimal("100")

    flex_resp = AlumniSurveyAnswer.objects.filter(
        question__survey_type=SURVEY_TYPE_ALUMNI,
        question__peo_id=peo_id,
        question__is_active=True,
        submission__cycle__batch_id=batch_id,
        submission__is_active=True,
        is_active=True,
    )
    if survey_window:
        flex_resp = flex_resp.filter(submission__cycle__survey_window=survey_window)

    per_q = flex_resp.values("question_id").annotate(a=Avg("score")).values_list("a", flat=True)
    flex_pct: Decimal | None = None
    if per_q:
        avg_of_avgs = sum(per_q) / len(per_q)
        flex_pct = ((Decimal(str(avg_of_avgs)) - Decimal("1")) / Decimal("4")) * Decimal("100")

    delta: Decimal | None = None
    parity = None
    if legacy_pct is not None and flex_pct is not None:
        delta = abs(legacy_pct - flex_pct)
        parity = "MATCH" if delta <= tolerance_pct else "MISMATCH"

    return {
        "peo_id": str(peo_id),
        "batch_id": str(batch_id),
        "survey_window": survey_window,
        "legacy_score_pct": float(legacy_pct) if legacy_pct is not None else None,
        "legacy_respondents": legacy_resp.values("student_id").distinct().count(),
        "flexible_score_pct": float(flex_pct) if flex_pct is not None else None,
        "flexible_respondents": flex_resp.values("submission_id").distinct().count(),
        "delta_pct": float(delta) if delta is not None else None,
        "tolerance_pct": float(tolerance_pct),
        "parity_status": parity,
    }


def run_full_alumni_migration(
    *,
    program_id: str | None = None,
    alumni_cycle_id: str | None = None,
    verify_peo_id: str | None = None,
    verify_batch_id: str | None = None,
) -> dict[str, Any]:
    """
    One-shot orchestration helper. Runs step1->step2->step3 then optional
    parity verify for a named (peo, batch) pair. Safe to re-run.
    """
    report: dict[str, Any] = {}
    report["questions_migrated"] = migrate_alumni_questions_to_survey_question(
        program_id=program_id
    ).as_dict()
    report["submissions_seeded"] = seed_alumni_submissions_from_legacy_responses(
        alumni_cycle_id=alumni_cycle_id
    ).as_dict()
    report["answers_backfilled"] = backfill_alumni_answers_from_legacy_responses(
        alumni_cycle_id=alumni_cycle_id
    ).as_dict()
    if verify_peo_id and verify_batch_id:
        report["integrity_check"] = verify_alumni_migration_integrity(
            peo_id=verify_peo_id, batch_id=verify_batch_id
        )
    return report
