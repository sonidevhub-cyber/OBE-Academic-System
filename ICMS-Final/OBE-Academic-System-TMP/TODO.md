# TODO - GA Module Finalized Architecture

## Backend
- [x] Update `obe/views.py`:

  - [ ] Replace `BatchGAReportView` response to match contract: `ga_attainment`, `status`, `contributing_courses`, `ga_cqi_records` (only for scope=cohort) + top-level readiness when mode=semester and scope=cohort and not ready.
  - [ ] Support query params: `mode` (semester|cumulative), `semester`, `scope` (cohort|student), `student_id`.
  - [ ] Implement readiness rules per spec.
  - [ ] Ensure teacher/student scoping (no CQI records for student).

- [ ] Update `obe/serializers.py` as needed for GA report response shape (or remove unused fields).
- [ ] Ensure `TeacherGAContextView` returns correct interim alert shape per spec.

- [ ] Verify `obe/services.py` conforms to spec:
  - [ ] `calculate_ga_attainment_semester_cohort`
  - [ ] `calculate_ga_attainment_cumulative_cohort`
  - [ ] `calculate_ga_attainment_semester_student`
  - [ ] `calculate_ga_attainment_cumulative_student`
  - [ ] `check_and_trigger_ga_cqi`
  - [ ] `get_teacher_ga_context`

## Frontend
- [ ] Locate `GAReport.tsx` (or current coordinator GA report component) and update UI:
  - [ ] Replace d_ga/i_ga/f_ga with single GA Attainment.
  - [ ] Add mode toggle + scope toggle.
  - [ ] Hide GA CQI section when scope=student.
- [ ] Add new additive `TeacherGAContext.tsx` component and call `/api/teacher/ga-context/{course_id}/`.


