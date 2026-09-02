import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import electivesApi, {
  ElectiveCourseOption,
  GroupedElectiveCoursesResponse,
  StudentElectiveEnrollment,
} from '../../../api/electivesService';
import batchService, { BatchFlat } from '../../../api/batchService';
import { toast } from 'react-hot-toast';
import {
  Lock,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Info,
  RotateCcw,
} from 'lucide-react';

interface SelectiveGroup {
  selective_group_id: string;
  group_name: string;
  required: boolean;
  courses: ElectiveCourseOption[];
}

interface ElectiveGroup {
  elective_group_id: string;
  group_name: string;
  courses: ElectiveCourseOption[];
}

const StudentElectiveSelection: React.FC = () => {
  const { currentUser } = useAuth();

  const [batchesLoading, setBatchesLoading] = useState(true);
  const [batches, setBatches] = useState<BatchFlat[]>([]);
  const [programSemesters, setProgramSemesters] = useState<number>(8);

  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedSemesterNo, setSelectedSemesterNo] = useState<number | ''>('');

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<GroupedElectiveCoursesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [myEnrollments, setMyEnrollments] = useState<StudentElectiveEnrollment[]>([]);

  const [selectedSelective, setSelectedSelective] = useState<Record<string, string>>({});
  const [selectedOpenElectives, setSelectedOpenElectives] = useState<Set<string>>(new Set());
  const [selectedElectiveGroups, setSelectedElectiveGroups] = useState<Record<string, string>>({});

  const enrolledByCourseMap = useMemo(() => {
    const map: Record<string, StudentElectiveEnrollment> = {};
    for (const e of myEnrollments) {
      map[e.course_id] = e;
    }
    return map;
  }, [myEnrollments]);

  const studentBatchId = currentUser?.batch_id || currentUser?.batch?.id;
  const studentBatchIds = currentUser?.batch_ids
    ? Array.from(new Set(currentUser.batch_ids.filter(Boolean)))
    : studentBatchId
    ? [studentBatchId]
    : [];
  const studentSemesterNo = currentUser?.semester?.number || currentUser?.current_semester;

  useEffect(() => {
    (async () => {
      setBatchesLoading(true);
      try {
        if (studentBatchIds.length > 1) {
          const res = await batchService.getAllBatches();
          const list = Array.isArray(res.data) ? res.data : (res.data as any)?.results || [];
          const active = list.filter(
            (b: any) => b.is_active !== false && studentBatchIds.includes(b.id)
          );
          setBatches(active.length ? active : list.filter((b: any) => b.is_active !== false));
        } else if (studentBatchId) {
          setBatches([
            {
              id: studentBatchId,
              name: currentUser?.batch?.name || currentUser?.batch_name || 'My Batch',
              program_name: currentUser?.batch?.program_name || currentUser?.program_name || '',
              program_id: currentUser?.batch?.program_id || currentUser?.program_id || '',
              current_semester: Number(studentSemesterNo) || undefined,
            },
          ]);
        } else {
          const res = await batchService.getAllBatches();
          const list = Array.isArray(res.data) ? res.data : (res.data as any)?.results || [];
          setBatches(list.filter((b: any) => b.is_active !== false));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setBatchesLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!batches.length) return;
    let defaultBatchId = '';
    if (studentBatchId && batches.some((b) => b.id === studentBatchId)) {
      defaultBatchId = studentBatchId;
    } else {
      defaultBatchId = batches[0].id;
    }
    setSelectedBatchId(defaultBatchId);

    const b = batches.find((x) => x.id === defaultBatchId);
    const programId: any = (b as any)?.program_id || (b as any)?.program?.id;
    if (programId) {
      import('../../../api/academicStructureService')
        .then((m) => m.default.getProgramDetail(programId))
        .then((p) => setProgramSemesters(p.data?.total_semesters || 8))
        .catch(() => {});
    }

    const cs: any = studentSemesterNo || (b as any)?.current_semester;
    if (cs) {
      setSelectedSemesterNo(Number(cs));
    } else {
      setSelectedSemesterNo(programSemesters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches]);

  useEffect(() => {
    if (selectedBatchId && selectedSemesterNo) {
      loadElectives();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatchId, selectedSemesterNo]);

  const loadElectives = async () => {
    if (!selectedBatchId || !selectedSemesterNo) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = { batch: selectedBatchId, semester: String(selectedSemesterNo) };
      if (currentUser?.id) params.student = String(currentUser.id);

      const [choicesRes, enrollmentsRes] = await Promise.all([
        electivesApi.getCourseChoices(params),
        electivesApi
          .getMyEnrollments({
            batch_id: selectedBatchId,
            semester_no: String(selectedSemesterNo),
          })
          .catch(() => ({ data: [] })),
      ]);

      const d = choicesRes.data;
      setData(d);
      setMyEnrollments(Array.isArray(enrollmentsRes.data) ? enrollmentsRes.data : []);

      const ss: Record<string, string> = {};
      const os = new Set<string>();
      const eg: Record<string, string> = {};

      const selected = d.current_student_selections || [];

      for (const courseId of selected) {
        let found = false;
        for (const g of d.selective_groups || []) {
          const match = g.courses.find((c) => c.id === courseId);
          if (match) {
            ss[g.selective_group_id] = courseId;
            found = true;
            break;
          }
        }
        if (found) continue;

        for (const g of d.elective_groups || []) {
          const match = g.courses.find((c) => c.id === courseId);
          if (match) {
            eg[g.elective_group_id] = courseId;
            found = true;
            break;
          }
        }
        if (found) continue;

        if (d.open_electives?.some((c) => c.id === courseId)) {
          os.add(courseId);
        }
      }

      setSelectedSelective(ss);
      setSelectedOpenElectives(os);
      setSelectedElectiveGroups(eg);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load elective courses');
    } finally {
      setLoading(false);
    }
  };

  const window = data?.window;
  const isLocked = window?.status === 'LOCKED';
  const isWindowOpen = window?.status === 'OPEN';
  const maxOpen = window?.max_electives_allowed ?? 0;
  const selectiveGroups: SelectiveGroup[] = data?.selective_groups || [];
  const electiveGroups: ElectiveGroup[] = data?.elective_groups || [];
  const openElectives: ElectiveCourseOption[] = data?.open_electives || [];

  const handleSelectiveSelect = (groupId: string, courseId: string) => {
    if (isLocked || !isWindowOpen) return;
    setSelectedSelective((prev) => ({ ...prev, [groupId]: courseId }));
  };

  const handleElectiveGroupSelect = (groupId: string, courseId: string) => {
    if (isLocked || !isWindowOpen) return;
    setSelectedElectiveGroups((prev) => ({ ...prev, [groupId]: courseId }));
  };

  const handleOpenToggle = (courseId: string) => {
    if (isLocked || !isWindowOpen) return;
    setSelectedOpenElectives((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        if (next.size >= maxOpen) {
          toast.error(`You may only select up to ${maxOpen} open elective(s).`);
          return prev;
        }
        next.add(courseId);
      }
      return next;
    });
  };

  const requiredSelectiveGroups = selectiveGroups.filter((g) => g.required);
  const missingRequiredGroups = requiredSelectiveGroups.filter(
    (g) => !selectedSelective[g.selective_group_id]
  );
  const openExceedsMax = selectedOpenElectives.size > maxOpen;

  const blockingIssues = useMemo(() => {
    const issues: string[] = [];
    for (const g of missingRequiredGroups) {
      issues.push(g.group_name);
    }
    if (openExceedsMax) {
      issues.push(
        `Open electives exceed maximum allowed (${selectedOpenElectives.size}/${maxOpen})`
      );
    }
    return issues;
  }, [missingRequiredGroups, openExceedsMax, selectedOpenElectives.size, maxOpen]);

  const submitDisabled = blockingIssues.length > 0 || submitting;

  const handleSubmit = async () => {
    if (blockingIssues.length > 0) {
      toast.error('Please resolve the issues before submitting.');
      return;
    }

    const allCourseIds = [
      ...Object.values(selectedSelective),
      ...Array.from(selectedOpenElectives),
      ...Object.values(selectedElectiveGroups),
    ].filter(Boolean);

    setSubmitting(true);
    try {
      const payload: any = {
        course_ids: allCourseIds,
        batch_id: selectedBatchId,
        semester_no: Number(selectedSemesterNo),
      };
      const res = await electivesApi.enrollElectives(payload);
      const d = res.data;
      if (d.errors && d.errors.length) {
        d.errors.forEach((m: string) => toast.error(m));
      } else {
        toast.success('Selections saved successfully!');
      }
      await loadElectives();
    } catch (e: any) {
      const msgs = e?.response?.data?.errors;
      if (Array.isArray(msgs) && msgs.length) msgs.forEach((m: string) => toast.error(m));
      else toast.error(e?.response?.data?.error || e?.message || 'Failed to save selections');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    loadElectives();
  };

  const SacTag: React.FC<{ courseId: string }> = ({ courseId }) => {
    const en = enrolledByCourseMap[courseId];
    if (!en || !en.enrolled_by_id || !en.enrolled_by_name) return null;
    return (
      <span className="inline-flex items-center text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
        <span className="mr-1">📌</span>
        Assigned by {en.enrolled_by_name}
      </span>
    );
  };

  const formatTimestamp = (ts?: string | null) => {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  if (batchesLoading && !batches.length) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin h-6 w-6 text-indigo-600 mr-2" />
        <span className="text-gray-600">Loading student profile...</span>
      </div>
    );
  }

  if (!studentBatchId && studentBatchIds.length === 0 && !batches.length) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
        <div>
          <p className="font-medium text-red-800">No Batch Assigned</p>
          <p className="text-sm text-red-700 mt-1">
            Your student profile does not have an assigned batch. Please contact the Coordinator
            Office.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {studentBatchIds.length > 1 || batches.length > 1 ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Batch</label>
              <select
                value={selectedBatchId}
                onChange={(e) => {
                  setSelectedBatchId(e.target.value);
                  setSelectedSemesterNo('');
                  setData(null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select Batch</option>
                {batches.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.custom_id || b.name || b.id} &middot; {b.program_name || ''}
                  </option>
                ))}
              </select>
            </div>
          ) : batches.length === 1 ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Batch</label>
              <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-800 text-sm">
                {(batches[0] as any).custom_id || batches[0].name || batches[0].id} &middot;{' '}
                {batches[0].program_name || ''}
              </div>
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Semester</label>
            <select
              value={selectedSemesterNo}
              onChange={(e) =>
                setSelectedSemesterNo(e.target.value ? Number(e.target.value) : '')
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={!selectedBatchId}
            >
              <option value="">Select Semester</option>
              {Array.from({ length: programSemesters }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  Semester {n}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={loadElectives}
              disabled={!selectedBatchId || !selectedSemesterNo || loading}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="animate-spin h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin h-6 w-6 text-indigo-600 mr-2" />
          <span className="text-gray-600">Loading elective courses...</span>
        </div>
      )}

      {error && !loading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-800">Could not load elective selection</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={loadElectives}
            className="text-sm px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {window?.status === 'NOT_OPENED' && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
              <p className="text-gray-500 italic text-base">
                Elective selection is not open yet. Check back later.
              </p>
              {data?.batch_custom_id && (
                <p className="text-xs text-gray-400 mt-3">
                  {data.batch_custom_id} &middot; Semester {data.semester_number}
                </p>
              )}
            </div>
          )}

          {(window?.status === 'OPEN' || window?.status === 'LOCKED' || !window) && (
            <>
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <BookOpen className="h-6 w-6 text-indigo-600" />
                    Elective Course Selection
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {data?.batch_custom_id} &middot; Semester {data?.semester_number}
                  </p>
                  {window?.status === 'OPEN' && window?.opened_by_name && (
                    <p className="text-xs text-gray-500 mt-1">
                      Opened by {window.opened_by_name}
                      {window?.opened_at ? ` on ${formatTimestamp(window.opened_at)}` : ''}
                    </p>
                  )}
                  {window?.status === 'LOCKED' && window?.closed_by_name && (
                    <p className="text-xs text-gray-500 mt-1">
                      Closed by {window.closed_by_name}
                      {window?.closed_at ? ` on ${formatTimestamp(window.closed_at)}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {window?.status === 'OPEN' ? (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
                      ● Selection Open &middot; Up to {maxOpen} elective
                      {maxOpen === 1 ? '' : 's'}
                    </span>
                  ) : window?.status === 'LOCKED' ? (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                      <Lock className="w-3.5 h-3.5 mr-1.5" />
                      🔒 Selections Locked
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      Not Opened
                    </span>
                  )}
                </div>
              </div>

              {isLocked && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <Lock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-amber-800">
                      🔒 Your selections are locked.
                    </p>
                    <p className="text-sm text-amber-700 mt-0.5">
                      The elective selection window for this semester has been closed and locked by
                      the coordinator. Your selections below are final.
                    </p>
                  </div>
                </div>
              )}

              {selectiveGroups.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Required Selections (Choose Exactly One Per Group)
                    </h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      Required
                    </span>
                  </div>

                  {selectiveGroups.map((group) => {
                    const selected = selectedSelective[group.selective_group_id];
                    const showError = group.required && !selected && isWindowOpen && !isLocked;
                    const hasCourses = group.courses && group.courses.length > 0;

                    return (
                      <div
                        key={group.selective_group_id}
                        className={`bg-white border rounded-xl shadow-sm ${
                          showError ? 'border-red-300' : 'border-gray-200'
                        }`}
                      >
                        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 rounded-t-xl flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-gray-900">{group.group_name}</h4>
                            {group.required && (
                              <span className="inline-flex items-center text-xs font-medium text-white bg-red-500 px-2 py-0.5 rounded">
                                Required *
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {selected && (
                              <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Selected
                              </span>
                            )}
                            {isLocked && (
                              <span className="inline-flex items-center text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                <Lock className="w-3 h-3 mr-1" />
                                Locked
                              </span>
                            )}
                          </div>
                        </div>

                        {!hasCourses ? (
                          <div className="p-5">
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                              <div>
                                <p className="font-medium text-red-800">
                                  No eligible options available
                                </p>
                                <p className="text-sm text-red-700 mt-0.5">
                                  No eligible options available for you in this group. Please
                                  contact the Coordinator Office for assistance.
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {group.courses.map((course) => {
                              const isChecked = selected === course.id;
                              return (
                                <label
                                  key={course.id}
                                  className={`flex items-start gap-3 px-5 py-4 transition-colors ${
                                    isLocked || !isWindowOpen
                                      ? 'cursor-default opacity-90'
                                      : 'cursor-pointer hover:bg-indigo-50/30'
                                  } ${isChecked ? 'bg-indigo-50' : ''}`}
                                >
                                  <input
                                    type="radio"
                                    name={`selective-${group.selective_group_id}`}
                                    value={course.id}
                                    checked={isChecked}
                                    disabled={isLocked || !isWindowOpen}
                                    onChange={() =>
                                      handleSelectiveSelect(group.selective_group_id, course.id)
                                    }
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 mt-0.5"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-gray-900">
                                        {course.code} — {course.name}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        ({course.credit_hours}cr)
                                      </span>
                                      <SacTag courseId={course.id} />
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {showError && (
                          <div className="px-5 pb-4">
                            <p className="text-sm text-red-600 flex items-center gap-1.5">
                              <span>⚠</span>
                              You must select one course for this group
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {openElectives.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                  <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 rounded-t-xl flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                        Optional Electives (You may select up to {maxOpen})
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                        <Info className="w-3 h-3" />
                        Selecting zero electives is perfectly valid.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${
                          selectedOpenElectives.size > maxOpen
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {selectedOpenElectives.size} / {maxOpen} selected
                      </span>
                      {isLocked && (
                        <span className="inline-flex items-center text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          <Lock className="w-3 h-3 mr-1" />
                          Locked
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {openElectives.map((course) => {
                      const checked = selectedOpenElectives.has(course.id);
                      const disabled =
                        isLocked ||
                        !isWindowOpen ||
                        (!checked && selectedOpenElectives.size >= maxOpen);
                      return (
                        <label
                          key={course.id}
                          className={`flex items-start gap-3 px-5 py-4 transition-colors ${
                            isLocked || !isWindowOpen || disabled
                              ? 'cursor-default opacity-90'
                              : 'cursor-pointer hover:bg-emerald-50/30'
                          } ${checked ? 'bg-emerald-50' : ''}`}
                        >
                          <input
                            type="checkbox"
                            value={course.id}
                            checked={checked}
                            disabled={disabled}
                            onChange={() => handleOpenToggle(course.id)}
                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 rounded mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-900">
                                {course.code} — {course.name}
                              </span>
                              <span className="text-xs text-gray-500">
                                ({course.credit_hours}cr)
                              </span>
                              <SacTag courseId={course.id} />
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {electiveGroups.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Legacy Grouped Electives (Choose One Per Group)
                  </h3>

                  {electiveGroups.map((group) => {
                    const selected = selectedElectiveGroups[group.elective_group_id];
                    return (
                      <div
                        key={group.elective_group_id}
                        className="bg-white border border-gray-200 rounded-xl shadow-sm"
                      >
                        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 rounded-t-xl flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <h4 className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                              {group.group_name}
                              <span className="text-xs font-normal text-gray-500">
                                (Choose one &mdash; not required)
                              </span>
                            </h4>
                          </div>
                          <div className="flex items-center gap-2">
                            {selected && (
                              <span className="inline-flex items-center text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Selected
                              </span>
                            )}
                            {isLocked && (
                              <span className="inline-flex items-center text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                <Lock className="w-3 h-3 mr-1" />
                                Locked
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {group.courses.map((course) => {
                            const isChecked = selected === course.id;
                            return (
                              <label
                                key={course.id}
                                className={`flex items-start gap-3 px-5 py-4 transition-colors ${
                                  isLocked || !isWindowOpen
                                    ? 'cursor-default opacity-90'
                                    : 'cursor-pointer hover:bg-indigo-50/30'
                                } ${isChecked ? 'bg-indigo-50' : ''}`}
                              >
                                <input
                                  type="radio"
                                  name={`elective-${group.elective_group_id}`}
                                  value={course.id}
                                  checked={isChecked}
                                  disabled={isLocked || !isWindowOpen}
                                  onChange={() =>
                                    handleElectiveGroupSelect(group.elective_group_id, course.id)
                                  }
                                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-gray-900">
                                      {course.code} — {course.name}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      ({course.credit_hours}cr)
                                    </span>
                                    <SacTag courseId={course.id} />
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!selectiveGroups.length &&
                !openElectives.length &&
                !electiveGroups.length && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                    <BookOpen className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-gray-800">No Electives Configured</h3>
                    <p className="text-gray-600 mt-1">
                      There are no elective courses configured for your batch and semester yet.
                    </p>
                  </div>
                )}

              {!isLocked && isWindowOpen && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                  <div className="flex-1">
                    {blockingIssues.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm text-red-700 font-medium">
                          ❌ Please select one option from:{' '}
                          {blockingIssues.filter((x) => !x.startsWith('Open')).join(', ') ||
                            'Complete all required selections'}
                          {missingRequiredGroups.length > 0 &&
                          !blockingIssues.filter((x) => !x.startsWith('Open')).length
                            ? missingRequiredGroups.map((g) => g.group_name).join(', ')
                            : ''}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleReset}
                      disabled={submitting || loading}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reset to Saved
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitDisabled}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {submitting && <Loader2 className="animate-spin h-4 w-4" />}
                      Save Selections
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default StudentElectiveSelection;
