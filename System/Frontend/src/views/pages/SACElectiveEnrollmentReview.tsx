import React, { useEffect, useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import {
  Lock,
  Unlock,
  BookOpen,
  Users,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Edit2,
  Save,
  Search,
} from 'lucide-react';
import { BatchFlat } from '../../api/batchService';
import electivesApi, {
  SACElectiveEnrollmentsResponse,
  StudentElectiveEnrollment,
  ElectiveCourseOption,
  GroupedElectiveCoursesResponse,
  WindowLockError,
} from '../../api/electivesService';
import academicStructureService from '../../api/academicStructureService';
import { coordinatorService } from '../../api/coordinatorService';

type TabKey = 'selective' | 'optional' | 'raw';

interface OverrideModalState {
  open: boolean;
  studentId: string;
  studentName: string;
  studentRegistrationNumber: string;
  context:
    | { type: 'selective'; selectiveGroupId: string; selectiveGroupName: string; currentEnrollment?: StudentElectiveEnrollment }
    | { type: 'standalone'; currentSelections: StudentElectiveEnrollment[] };
}

interface LockErrorDialogState {
  open: boolean;
  error: WindowLockError | null;
}

const SACElectiveEnrollmentReview: React.FC = () => {
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [batches, setBatches] = useState<BatchFlat[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [programSemesters, setProgramSemesters] = useState<number>(8);

  const [batchId, setBatchId] = useState<string>('');
  const [semesterNo, setSemesterNo] = useState<number | ''>('');

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<SACElectiveEnrollmentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('selective');
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [showLockElectiveConfirm, setShowLockElectiveConfirm] = useState(false);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openMaxElectives, setOpenMaxElectives] = useState<number>(1);
  const [expandedIncompleteBanner, setExpandedIncompleteBanner] = useState(true);
  const [expandedGroupIncomplete, setExpandedGroupIncomplete] = useState<Record<string, boolean>>({});
  const [rawSearchFilter, setRawSearchFilter] = useState('');

  const [overrideModal, setOverrideModal] = useState<OverrideModalState>({
    open: false,
    studentId: '',
    studentName: '',
    studentRegistrationNumber: '',
    context: { type: 'selective', selectiveGroupId: '', selectiveGroupName: '' },
  });
  const [overrideChoices, setOverrideChoices] = useState<GroupedElectiveCoursesResponse | null>(null);
  const [overrideChoicesLoading, setOverrideChoicesLoading] = useState(false);
  const [overrideSelectedStandalone, setOverrideSelectedStandalone] = useState<Record<string, boolean>>({});
  const [overrideSelectedSelective, setOverrideSelectedSelective] = useState<string>('');
  const [overrideSaving, setOverrideSaving] = useState(false);

  interface BulkOverrideModalState {
    open: boolean;
    selectiveGroupId: string;
    selectiveGroupName: string;
    courses: ElectiveCourseOption[];
    selectedCourseId: string;
  }
  const [bulkOverrideModal, setBulkOverrideModal] = useState<BulkOverrideModalState>({
    open: false,
    selectiveGroupId: '',
    selectiveGroupName: '',
    courses: [],
    selectedCourseId: '',
  });
  const [bulkOverrideLoading, setBulkOverrideLoading] = useState(false);
  const [bulkOverrideSaving, setBulkOverrideSaving] = useState(false);

  const [lockErrorDialog, setLockErrorDialog] = useState<LockErrorDialogState>({ open: false, error: null });

  // ─── Load coordinator's assigned programs (backend already scopes to coordinator) ───
  useEffect(() => {
    (async () => {
      try {
        const res = await coordinatorService.getPrograms();
        const list = Array.isArray(res.data)
          ? res.data
          : (res.data as any)?.results || [];
        const programList = (list || []).filter(
          (p: any) => p.is_active !== false
        );
        setPrograms(programList);

        // Auto-select if only one program assigned
        if (programList.length === 1) {
          setSelectedProgram(String(programList[0].id));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setProgramsLoading(false);
      }
    })();
  }, []);

  // ─── Load batches for the selected program ───
  useEffect(() => {
    if (!selectedProgram) {
      setBatches([]);
      return;
    }
    (async () => {
      setBatchesLoading(true);
      try {
        const res = await coordinatorService.getBatchesByProgram(selectedProgram);
        const list = Array.isArray(res.data)
          ? res.data
          : (res.data as any)?.data || (res.data as any)?.results || [];
        setBatches(
          (list || []).filter((b: any) => b.is_active !== false)
        );
      } catch (e) {
        console.error(e);
      } finally {
        setBatchesLoading(false);
      }
    })();
  }, [selectedProgram]);

  useEffect(() => {
    if (!batchId) return;
    (async () => {
      const b = batches.find((x: any) => x.id === batchId);
      const programId: any = (b as any)?.program_id || (b as any)?.program?.id;
      if (programId) {
        try {
          const p = await academicStructureService.getProgramDetail(programId);
          setProgramSemesters(p.data?.total_semesters || 8);
        } catch {
          /* ignore */
        }
      }
      if (b) {
        const cs: any = (b as any).current_semester;
        if (cs) setSemesterNo(Number(cs));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  useEffect(() => {
    if (batchId && semesterNo) {
      loadReview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, semesterNo]);

  const loadReview = async () => {
    if (!batchId || !semesterNo) return;
    setLoading(true);
    setError(null);
    try {
      const res = await electivesApi.getSACEnrollments({
        batch: batchId,
        semester: String(semesterNo),
      });
      const responseData = res.data;
      const sortStudents = <T extends Record<string, any>>(
        students: T[],
        regKey: string = 'registration_number',
        customKey: string = 'custom_id'
      ): T[] =>
        [...students].sort((a, b) => {
          const an = a[regKey] || a[customKey] || '';
          const bn = b[regKey] || b[customKey] || '';
          return an.localeCompare(bn);
        });

      if (responseData?.incomplete_summary?.students_missing_selective_picks) {
        responseData.incomplete_summary.students_missing_selective_picks =
          sortStudents(responseData.incomplete_summary.students_missing_selective_picks);
      }
      if (responseData?.selective_group_enrollments) {
        responseData.selective_group_enrollments = responseData.selective_group_enrollments.map((g) => ({
          ...g,
          enrollments: sortStudents(g.enrollments, 'student_registration_number', 'student_custom_id'),
          incomplete_students: sortStudents(g.incomplete_students),
        }));
      }
      if (responseData?.elective_group_enrollments) {
        responseData.elective_group_enrollments = responseData.elective_group_enrollments.map((g) => ({
          ...g,
          enrollments: sortStudents(g.enrollments, 'student_registration_number', 'student_custom_id'),
        }));
      }
      if (responseData?.open_elective_enrollments) {
        responseData.open_elective_enrollments =
          sortStudents(responseData.open_elective_enrollments, 'student_registration_number', 'student_custom_id');
      }
      if (responseData?.all_enrollments) {
        responseData.all_enrollments =
          sortStudents(responseData.all_enrollments, 'student_registration_number', 'student_custom_id');
      }
      setData(responseData);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load enrollments');
    } finally {
      setLoading(false);
    }
  };

  const window = data?.window;
  const incompleteStudents = data?.incomplete_summary?.students_missing_selective_picks || [];
  const totalStudents = data?.incomplete_summary?.total_students_in_batch || 0;
  const hasIncomplete = incompleteStudents.length > 0;

  const handleOpenWindow = async () => {
    if (!batchId || !semesterNo) return;
    setSubmitting(true);
    try {
      await electivesApi.openSelectionWindow({
        batch_id: batchId,
        semester_no: Number(semesterNo),
        max_electives_allowed: Number(openMaxElectives),
      });
      toast.success('Elective selection window opened');
      setShowOpenModal(false);
      await loadReview();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to open window');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLockWindow = async () => {
    if (!batchId || !semesterNo) return;
    if (hasIncomplete) {
      toast.error(`Cannot lock — ${incompleteStudents.length} students have incomplete required selections`);
      return;
    }
    setSubmitting(true);
    try {
      const result = await electivesApi.lockSelectionWindow({
        batch_id: batchId,
        semester_no: Number(semesterNo),
      });
      if ('error' in result) {
        setLockErrorDialog({ open: true, error: result });
        setShowLockConfirm(false);
      } else {
        const locked = result.locked_enrollments_count ?? 0;
        toast.success(`Locked! ${locked} enrollments frozen.`);
        setShowLockConfirm(false);
        await loadReview();
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to lock');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLockElectiveOnly = async () => {
    if (!batchId || !semesterNo) return;
    setSubmitting(true);
    try {
      const result = await electivesApi.lockElectiveEnrollmentsOnly({
        batch_id: batchId,
        semester_no: Number(semesterNo),
      });
      const locked = (result as any).locked_enrollments_count ?? 0;
      toast.success(`${locked} elective enrollment(s) locked.`);
      setShowLockElectiveConfirm(false);
      await loadReview();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to lock electives');
    } finally {
      setSubmitting(false);
    }
  };

  const openOverrideForSelective = (
    studentId: string,
    studentName: string,
    registrationNumber: string,
    selectiveGroupId: string,
    selectiveGroupName: string,
    currentEnrollment?: StudentElectiveEnrollment
  ) => {
    setOverrideModal({
      open: true,
      studentId,
      studentName,
      studentRegistrationNumber: registrationNumber,
      context: {
        type: 'selective',
        selectiveGroupId,
        selectiveGroupName,
        currentEnrollment,
      },
    });
    setOverrideSelectedSelective(currentEnrollment?.course_id || '');
    setOverrideChoices(null);
    loadOverrideChoices(studentId);
  };

  const openOverrideForStandalone = (
    studentId: string,
    studentName: string,
    registrationNumber: string,
    currentSelections: StudentElectiveEnrollment[]
  ) => {
    setOverrideModal({
      open: true,
      studentId,
      studentName,
      studentRegistrationNumber: registrationNumber,
      context: {
        type: 'standalone',
        currentSelections,
      },
    });
    const initial: Record<string, boolean> = {};
    currentSelections.forEach((e) => {
      initial[e.course_id] = true;
    });
    setOverrideSelectedStandalone(initial);
    setOverrideChoices(null);
    loadOverrideChoices(studentId);
  };

  const loadOverrideChoices = async (studentId: string) => {
    if (!batchId || !semesterNo) return;
    setOverrideChoicesLoading(true);
    try {
      const res = await electivesApi.getCourseChoices({
        batch: batchId,
        semester: String(semesterNo),
        student: studentId,
      });
      setOverrideChoices(res.data);
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to load course choices');
    } finally {
      setOverrideChoicesLoading(false);
    }
  };

  const closeOverrideModal = () => {
    setOverrideModal((prev) => ({ ...prev, open: false }));
    setOverrideChoices(null);
    setOverrideSelectedSelective('');
    setOverrideSelectedStandalone({});
  };

  const openBulkOverride = async (groupId: string, groupName: string) => {
    setBulkOverrideModal({
      open: true,
      selectiveGroupId: groupId,
      selectiveGroupName: groupName,
      courses: [],
      selectedCourseId: '',
    });
    setBulkOverrideLoading(true);
    try {
      const res = await electivesApi.getCourseChoices({
        batch: batchId,
        semester: String(semesterNo),
      });
      const sg = (res.data?.selective_groups || []).find((g) => g.selective_group_id === groupId);
      const courses = sg?.courses || [];
      setBulkOverrideModal((prev) => ({
        ...prev,
        courses,
        selectedCourseId: courses.length > 0 ? courses[0].id : '',
      }));
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to load group courses');
    } finally {
      setBulkOverrideLoading(false);
    }
  };

  const closeBulkOverrideModal = () => {
    setBulkOverrideModal((prev) => ({ ...prev, open: false }));
  };

  const handleBulkOverride = async () => {
    if (!batchId || !semesterNo || !bulkOverrideModal.selectedCourseId) {
      toast.error('Please select a course to assign');
      return;
    }
    const group = (data?.selective_group_enrollments || []).find(
      (g) => g.selective_group_id === bulkOverrideModal.selectiveGroupId
    );
    if (!group) {
      toast.error('Selective group not found');
      return;
    }
    const incomplete = group.incomplete_students;
    if (incomplete.length === 0) {
      toast('No students need assignment');
      closeBulkOverrideModal();
      return;
    }
    setBulkOverrideSaving(true);
    try {
      let successCount = 0;
      let errorCount = 0;
      for (const student of incomplete) {
        try {
          await electivesApi.sacAssign({
            student_id: student.student_id,
            course_id: bulkOverrideModal.selectedCourseId,
            batch_id: batchId,
            semester_no: Number(semesterNo),
            action: 'add',
          });
          successCount++;
        } catch {
          errorCount++;
        }
      }
      if (successCount > 0) {
        toast.success(`${successCount} student(s) assigned to ${bulkOverrideModal.selectedCourseId ? 'course' : ''}`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} assignment(s) failed`);
      }
      closeBulkOverrideModal();
      await loadReview();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to bulk assign');
    } finally {
      setBulkOverrideSaving(false);
    }
  };

  const handleOverrideSave = async () => {
    if (!batchId || !semesterNo || overrideModal.context.type === 'selective' && !overrideSelectedSelective) {
      toast.error('Please make a selection');
      return;
    }
    setOverrideSaving(true);
    try {
      if (overrideModal.context.type === 'selective') {
        const ctx = overrideModal.context;
        if (ctx.currentEnrollment && ctx.currentEnrollment.course_id === overrideSelectedSelective) {
          toast.success('No changes made');
          closeOverrideModal();
          return;
        }
        await electivesApi.sacAssign({
          student_id: overrideModal.studentId,
          course_id: overrideSelectedSelective,
          batch_id: batchId,
          semester_no: Number(semesterNo),
          action: 'add',
        });
        toast.success('SAC assignment saved');
      } else {
        const ctx = overrideModal.context;
        const openElectives = overrideChoices?.open_electives || [];
        const currentIds = new Set(ctx.currentSelections.map((e) => e.course_id));
        const desiredIds = new Set(
          openElectives.filter((c) => overrideSelectedStandalone[c.id]).map((c) => c.id)
        );
        const toRemove = Array.from(currentIds).filter((id) => !desiredIds.has(id));
        const toAdd = Array.from(desiredIds).filter((id) => !currentIds.has(id));
        let successCount = 0;
        let errorCount = 0;
        for (const courseId of toRemove) {
          try {
            await electivesApi.sacAssign({
              student_id: overrideModal.studentId,
              course_id: courseId,
              batch_id: batchId,
              semester_no: Number(semesterNo),
              action: 'remove',
            });
            successCount++;
          } catch {
            errorCount++;
          }
        }
        for (const courseId of toAdd) {
          try {
            await electivesApi.sacAssign({
              student_id: overrideModal.studentId,
              course_id: courseId,
              batch_id: batchId,
              semester_no: Number(semesterNo),
              action: 'add',
            });
            successCount++;
          } catch {
            errorCount++;
          }
        }
        if (successCount > 0) toast.success(`${successCount} change(s) applied`);
        if (errorCount > 0) toast.error(`${errorCount} change(s) failed`);
      }
      closeOverrideModal();
      await loadReview();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to save assignment');
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleRemoveEnrollment = async (enrollment: StudentElectiveEnrollment) => {
    if (!batchId || !semesterNo) return;
    if (!globalThis.confirm(`Remove enrollment for ${enrollment.student_name} — ${enrollment.course_code}?`)) return;
    try {
      await electivesApi.sacAssign({
        student_id: enrollment.student_id,
        course_id: enrollment.course_id,
        batch_id: batchId,
        semester_no: Number(semesterNo),
        action: 'remove',
      });
      toast.success('Enrollment removed');
      await loadReview();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to remove enrollment');
    }
  };

  const toggleGroupIncomplete = (id: string) => {
    setExpandedGroupIncomplete((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const windowStatusBadge = useMemo(() => {
    if (!window || window.status === 'NOT_OPENED') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-1.5" />
          Not Opened
        </span>
      );
    }
    if (window.status === 'OPEN') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
          Open
          {window.opened_at && (
            <span className="ml-1.5 text-emerald-600">
              (since {new Date(window.opened_at).toLocaleString()}
              {window.opened_by_name ? ` by ${window.opened_by_name}` : ''})
            </span>
          )}
        </span>
      );
    }
    if (window.status === 'LOCKED') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          <Lock className="w-3 h-3 mr-1" />
          Locked
          {window.closed_at && (
            <span className="ml-1.5 text-amber-700">
              (at {new Date(window.closed_at).toLocaleString()}
              {window.closed_by_name ? ` by ${window.closed_by_name}` : ''})
            </span>
          )}
        </span>
      );
    }
    return null;
  }, [window]);

  const filteredRawEnrollments = useMemo(() => {
    const all = data?.all_enrollments || [];
    if (!rawSearchFilter.trim()) return all;
    const q = rawSearchFilter.trim().toLowerCase();
    return all.filter(
      (e) =>
        e.student_name.toLowerCase().includes(q) ||
        (e.student_registration_number || '').toLowerCase().includes(q) ||
        (e.student_custom_id || '').toLowerCase().includes(q) ||
        e.course_code.toLowerCase().includes(q) ||
        e.course_name.toLowerCase().includes(q)
    );
  }, [data, rawSearchFilter]);

  const openOverrideForFirstIncompleteGroup = (student: (typeof incompleteStudents)[number]) => {
    if (!student.missing_groups || student.missing_groups.length === 0) return;
    const first = student.missing_groups[0];
    openOverrideForSelective(
      student.student_id,
      student.name,
      student.registration_number || student.custom_id,
      first.selective_group_id,
      first.group_name
    );
  };

  const canLock = window?.status === 'OPEN' && !hasIncomplete;
  const lockDisabledReason =
    window?.status === 'OPEN' && hasIncomplete
      ? `⚠ Cannot lock — ${incompleteStudents.length} students have incomplete required selections (see below)`
      : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-600" />
             Elective Enrollment Review
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Review student selections, manage the selection window, override picks, and verify completeness before locking.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Program dropdown — only for coordinators with multiple programs */}
          {programs.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Program *</label>
              <select
                value={selectedProgram}
                onChange={(e) => {
                  setSelectedProgram(e.target.value);
                  setBatchId('');
                  setSemesterNo('');
                  setData(null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                disabled={programsLoading}
              >
                <option value="">{programsLoading ? 'Loading programs...' : 'Select Program'}</option>
                {programs.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.program_name || p.id}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className={programs.length > 1 ? "md:col-span-3" : ""}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch *</label>
            <select
              value={batchId}
              onChange={(e) => {
                setBatchId(e.target.value);
                setSemesterNo('');
                setData(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
              disabled={batchesLoading || (programs.length > 1 && !selectedProgram)}
            >
              <option value="">{batchesLoading ? 'Loading batches...' : !selectedProgram ? 'Select Program First' : 'Select Batch'}</option>
              {batches.map((b: any) => (
                <option key={b.id} value={b.id}>
                   {b.name || b.custom_id || b.id} &middot; {b.program_name || ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Semester *</label>
            <select
              value={semesterNo}
              onChange={(e) => setSemesterNo(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
              disabled={!batchId}
            >
              <option value="">Select Semester</option>
              {Array.from({ length: programSemesters }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  Semester {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">Window Status</span>
            <div>{windowStatusBadge}</div>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={loadReview}
              disabled={!batchId || !semesterNo || loading}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="animate-spin h-4 w-4" />}
              Refresh
            </button>
            {(!window || window.status === 'NOT_OPENED') && (
              <button
                onClick={() => {
                  setOpenMaxElectives(window?.max_electives_allowed ?? 1);
                  setShowOpenModal(true);
                }}
                disabled={submitting || !batchId || !semesterNo}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Unlock className="h-4 w-4" />
                Open Window
              </button>
            )}
             {window?.status === 'OPEN' && (
               <div className="flex flex-col gap-1">
                 <button
                   onClick={() => setShowLockConfirm(true)}
                   disabled={!canLock || submitting}
                   className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 transition-colors ${
                     canLock
                       ? 'bg-amber-600 hover:bg-amber-700 disabled:opacity-50'
                       : 'bg-gray-300 cursor-not-allowed'
                   }`}
                 >
                   <Lock className="h-4 w-4" />
                   {canLock ? 'Lock Selections' : 'Lock Disabled'}
                 </button>
                 {lockDisabledReason && (
                   <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 max-w-xs break-words">
                     {lockDisabledReason}
                   </span>
                 )}
                 {canLock && (
                   <span className="text-xs font-medium text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-200 max-w-xs break-words">
                     Lock all selections permanently (cannot reopen)
                   </span>
                 )}
               </div>
             )}

      {bulkOverrideModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  Bulk Override — {bulkOverrideModal.selectiveGroupName}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Assign all students with missing picks to a single course.
                </p>
              </div>
              <button
                onClick={closeBulkOverrideModal}
                className="text-gray-400 hover:text-gray-600 shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {bulkOverrideLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">Loading group courses...</p>
                </div>
              ) : bulkOverrideModal.courses.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  No courses found in this selective group.
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select course for all students
                  </label>
                  <select
                    value={bulkOverrideModal.selectedCourseId}
                    onChange={(e) =>
                      setBulkOverrideModal((prev) => ({
                        ...prev,
                        selectedCourseId: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {bulkOverrideModal.courses.map((course, idx) => (
                      <option key={course.id} value={course.id}>
                        Sub {idx + 1} — {course.code}: {course.name}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-gray-500 mt-1">
                    This will assign the selected course to{' '}
                    {(() => {
                      const group = (data?.selective_group_enrollments || []).find(
                        (g) => g.selective_group_id === bulkOverrideModal.selectiveGroupId
                      );
                      return group?.incomplete_students.length || 0;
                    })()}{' '}
                    student(s) who have not yet selected.
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
              <button
                onClick={closeBulkOverrideModal}
                disabled={bulkOverrideSaving}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkOverride}
                disabled={
                  bulkOverrideSaving ||
                  bulkOverrideLoading ||
                  !bulkOverrideModal.selectedCourseId
                }
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {bulkOverrideSaving && <Loader2 className="animate-spin h-4 w-4" />}
                <Save className="h-4 w-4" />
                Apply to All Incomplete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl font-bold text-gray-600">Loading enrollments...</p>
        </div>
      )}

      {!loading && data && (
        <div className="space-y-6">
          {hasIncomplete ? (
            <div className="sticky top-0 z-20 border border-red-200 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-red-50 px-5 py-4">
                <div
                  className="flex items-start justify-between gap-3 cursor-pointer"
                  onClick={() => setExpandedIncompleteBanner((v) => !v)}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-red-900">
                        ⚠ {incompleteStudents.length} students are missing required selective picks — locking is blocked.
                      </p>
                      <p className="text-sm text-red-700 mt-0.5">
                        {totalStudents > 0
                          ? `${totalStudents - incompleteStudents.length} / ${totalStudents} students complete`
                          : 'Expand below to review each student and their missing groups.'}
                      </p>
                    </div>
                  </div>
                  <button className="text-red-600 hover:text-red-800 shrink-0">
                    {expandedIncompleteBanner ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                </div>
                {expandedIncompleteBanner && (
                  <div className="mt-4 space-y-2 max-h-72 overflow-y-auto pr-1">
                    {incompleteStudents.map((s) => (
                      <div
                        key={s.student_id}
                        className="flex items-center justify-between gap-3 bg-white border border-red-100 rounded-lg px-4 py-2.5"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm">
                            • {s.name}{' '}
                            <span className="font-mono text-xs text-gray-500">
                              ({s.registration_number || s.custom_id})
                            </span>
                          </p>
                          <p className="text-xs text-red-700 mt-0.5">
                            missing: {s.missing_groups.map((g) => g.group_name).join(', ')}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openOverrideForFirstIncompleteGroup(s);
                          }}
                          className="shrink-0 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-semibold flex items-center gap-1"
                        >
                          <Edit2 className="h-3 w-3" />
                          Override now
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            data.window && (
              <div className="sticky top-0 z-20 bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm px-5 py-3 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <p className="font-semibold text-emerald-900">
                  ✓ All required selections complete — ready to lock.
                </p>
                {totalStudents > 0 && (
                  <span className="text-sm text-emerald-700">
                    ({totalStudents} students)
                  </span>
                )}
              </div>
            )
          )}

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="border-b border-gray-200 bg-gray-50 px-2">
              <nav className="flex gap-1">
                {[
                  { key: 'selective' as TabKey, label: 'Required Selective Groups', icon: BookOpen },
                  { key: 'optional' as TabKey, label: 'Optional Electives', icon: Plus },
                  { key: 'raw' as TabKey, label: 'Raw Enrollments Table', icon: Users },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === key
                        ? 'border-indigo-600 text-indigo-700 bg-white'
                        : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-5 space-y-5">
              {activeTab === 'selective' && (
                <div className="space-y-5">
                  {(data.selective_group_enrollments || []).length === 0 && (
                    <div className="text-center py-10 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                      <BookOpen className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No selective groups configured for this semester.</p>
                    </div>
                  )}
                  {(data.selective_group_enrollments || []).map((group) => {
                    const enrolledCount = group.enrollments.length;
                    const incompleteCount = group.incomplete_students.length;
                    const total = enrolledCount + incompleteCount;
                    const isComplete = incompleteCount === 0;
                    const expanded = expandedGroupIncomplete[group.selective_group_id] !== false;
                    return (
                      <div
                        key={group.selective_group_id}
                        className="border border-gray-200 rounded-xl overflow-hidden"
                      >
                        <div className="px-5 py-4 bg-indigo-50/40 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <BookOpen className="h-5 w-5 text-indigo-600" />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-gray-900">{group.group_name}</p>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                  <span className="mr-0.5">*</span> Required Selective
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {enrolledCount} enrolled / {total} students
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isComplete ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                ✓ Complete
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                ⚠ {incompleteCount} incomplete
                              </span>
                            )}
                          </div>
                        </div>

                         {!isComplete && (
                           <div className="border-b border-gray-200">
                             <div className="flex items-center justify-between px-5 py-3 bg-red-50">
                               <button
                                 type="button"
                                 onClick={() => toggleGroupIncomplete(group.selective_group_id)}
                                 className="flex-1 flex items-center justify-between text-left font-semibold text-red-900 text-sm gap-2 hover:bg-red-50/70 transition-colors"
                               >
                                 <span className="flex items-center gap-2">
                                   <AlertTriangle className="h-4 w-4 text-red-600" />
                                   Students missing pick ({incompleteCount})
                                 </span>
                                 {expanded ? <ChevronUp className="h-4 w-4 text-red-600" /> : <ChevronDown className="h-4 w-4 text-red-600" />}
                               </button>
                               <button
                                 type="button"
                                 onClick={() => openBulkOverride(group.selective_group_id, group.group_name)}
                                 className="shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center gap-1"
                               >
                                 <Users className="h-3 w-3" />
                                 Bulk Override All
                               </button>
                             </div>
                             {expanded && (
                              <div className="overflow-x-auto border-t border-red-100">
                                <table className="w-full divide-y divide-gray-200">
                                  <thead className="bg-red-50/50">
                                    <tr>
                                      <th className="px-4 py-2.5 text-left text-xs font-bold text-red-800 uppercase tracking-wider">
                                        Registration #
                                      </th>
                                      <th className="px-4 py-2.5 text-left text-xs font-bold text-red-800 uppercase tracking-wider">
                                        Student Name
                                      </th>
                                      <th className="px-4 py-2.5 text-right text-xs font-bold text-red-800 uppercase tracking-wider">
                                        Action
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-100">
                                    {group.incomplete_students.map((s) => (
                                      <tr key={s.student_id} className="hover:bg-red-50/30">
                                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-mono text-gray-800">
                                          {s.registration_number || s.custom_id}
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-900 font-medium">
                                          {s.name}
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-right">
                                          <button
                                            onClick={() =>
                                              openOverrideForSelective(
                                                s.student_id,
                                                s.name,
                                                s.registration_number || s.custom_id,
                                                group.selective_group_id,
                                                group.group_name
                                              )
                                            }
                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center gap-1 inline-flex"
                                          >
                                            <Edit2 className="h-3 w-3" />
                                            Override
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}

                        {enrolledCount > 0 && (
                           <div className="overflow-x-auto">
                             <table className="w-full divide-y divide-gray-200">
                               <thead className="bg-gray-50">
                                 <tr>
                                   <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                     Sub
                                   </th>
                                   <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                     Registration #
                                   </th>
                                   <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                     Student Name
                                   </th>
                                   <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                     Selected Course
                                   </th>
                                   <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                     Type
                                   </th>
                                   <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                     Locked
                                   </th>
                                   <th className="px-4 py-2.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                                     Action
                                   </th>
                                 </tr>
                               </thead>
                               <tbody className="bg-white divide-y divide-gray-100">
                  {(() => {
                    const _courseOrder: Record<string, number> = {};
                    let _subIdx = 0;
                    group.enrollments.forEach((e2) => {
                      if (!_courseOrder[e2.course_id]) {
                        _subIdx++;
                        _courseOrder[e2.course_id] = _subIdx;
                      }
                    });
                    return group.enrollments.map((e) => {
                      const subNum = _courseOrder[e.course_id] || 1;
                      return (
                                   <tr key={e.id} className="hover:bg-gray-50/50">
                                     <td className="px-4 py-2.5 whitespace-nowrap">
                                       <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                                         Sub {subNum}
                                       </span>
                                     </td>
                                     <td className="px-4 py-2.5 whitespace-nowrap text-sm font-mono text-gray-800">
                                       {e.student_registration_number || e.student_custom_id}
                                     </td>
                                     <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-900 font-medium">
                                       {e.student_name}
                                     </td>
                                     <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-800">
                                       <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded mr-1.5">
                                         {e.course_code}
                                       </span>
                                       {e.course_name}
                                     </td>
                                     <td className="px-4 py-2.5 whitespace-nowrap">
                                       {e.enrolled_by_name ? (
                                         <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
                                           📌 SAC Assigned
                                         </span>
                                       ) : (
                                         <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                           Student Picked
                                         </span>
                                       )}
                                     </td>
                                     <td className="px-4 py-2.5 whitespace-nowrap">
                                       {e.is_locked ? (
                                         <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                           <Lock className="w-3 h-3 mr-1" />
                                           Yes
                                         </span>
                                       ) : (
                                         <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                           No
                                         </span>
                                       )}
                                     </td>
                                     <td className="px-4 py-2.5 whitespace-nowrap text-right">
                                       <button
                                         onClick={() =>
                                           openOverrideForSelective(
                                             e.student_id,
                                             e.student_name,
                                             e.student_registration_number || e.student_custom_id,
                                             group.selective_group_id,
                                             group.group_name,
                                             e
                                           )
                                         }
                                         className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center gap-1 inline-flex"
                                       >
                                         <Edit2 className="h-3 w-3" />
                                         Change Selection
                                       </button>
                                     </td>
                                      </tr>
                    );
                  });
                })()}
                                  </tbody>
                             </table>
                           </div>
                         )}
                      </div>
                    );
                  })}
                </div>
              )}

               {activeTab === 'optional' && (
                 <div className="space-y-5">
                   {window?.status === 'OPEN' && (
                     <div className="flex justify-between items-center">
                       <button
                         onClick={() => setShowLockElectiveConfirm(true)}
                         disabled={submitting}
                         className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
                       >
                         <Lock className="h-4 w-4" />
                         {submitting ? 'Locking...' : 'Lock Electives Only'}
                       </button>
                       <p className="text-xs text-gray-500 max-w-md">
                         Locking here freezes only open/standalone elective enrollments for this
                         semester; selective-group picks remain editable until the full window is locked.
                       </p>
                     </div>
                   )}
                   <div className="border border-gray-200 rounded-xl overflow-hidden">
                     <div className="px-5 py-3 bg-emerald-50/40 flex items-center gap-3 border-b border-gray-200">
                       <BookOpen className="h-5 w-5 text-emerald-600" />
                       <div>
                         <p className="font-semibold text-gray-900">Open / Standalone Electives</p>
                         <p className="text-xs text-gray-500">
                           {(data.open_elective_enrollments || []).length} total selections
                           {window?.max_electives_allowed
                             ? ` · Max ${window.max_electives_allowed} per student`
                             : ''}
                         </p>
                       </div>
                     </div>
                     {(data.open_elective_enrollments || []).length === 0 ? (
                      <div className="px-5 py-8 text-center text-sm text-gray-500 bg-gray-50/30">
                        No open elective enrollments yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                Registration #
                              </th>
                              <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                Name
                              </th>
                              <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                Course
                              </th>
                              <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                Type
                              </th>
                              <th className="px-4 py-2.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                            {(data.open_elective_enrollments || []).map((e) => {
                              const studentOpenEnrollments = (data.open_elective_enrollments || []).filter(
                                (oe) => oe.student_id === e.student_id
                              );
                              return (
                                <tr key={e.id} className="hover:bg-gray-50/50">
                                  <td className="px-4 py-2.5 whitespace-nowrap text-sm font-mono text-gray-800">
                                    {e.student_registration_number || e.student_custom_id}
                                  </td>
                                  <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-900 font-medium">
                                    {e.student_name}
                                  </td>
                                  <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-800">
                                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded mr-1.5">
                                      {e.course_code}
                                    </span>
                                    {e.course_name}
                                  </td>
                                  <td className="px-4 py-2.5 whitespace-nowrap">
                                    {e.enrolled_by_name ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                        📌 SAC
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                        Student
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                                    <div className="inline-flex gap-1.5 justify-end">
                                      <button
                                        onClick={() =>
                                          openOverrideForStandalone(
                                            e.student_id,
                                            e.student_name,
                                            e.student_registration_number || e.student_custom_id,
                                            studentOpenEnrollments
                                          )
                                        }
                                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center gap-1 inline-flex"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                        Override
                                      </button>
                                      <button
                                        onClick={() => handleRemoveEnrollment(e)}
                                        className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-semibold flex items-center gap-1 inline-flex"
                                      >
                                        <X className="h-3 w-3" />
                                        Remove
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {(data.elective_group_enrollments || []).length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Legacy Grouped Electives
                      </h3>
                      {(data.elective_group_enrollments || []).map((group) => (
                        <div
                          key={group.elective_group_id}
                          className="border border-gray-200 rounded-xl overflow-hidden"
                        >
                          <div className="px-5 py-3 bg-purple-50/40 flex items-center justify-between gap-3 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                              <BookOpen className="h-5 w-5 text-purple-600" />
                              <div>
                                <p className="font-semibold text-gray-900">{group.group_name}</p>
                                <p className="text-xs text-gray-500">
                                  {group.enrollments.length} selection
                                  {group.enrollments.length === 1 ? '' : 's'}
                                </p>
                              </div>
                            </div>
                          </div>
                          {group.enrollments.length === 0 ? (
                            <div className="px-5 py-6 text-center text-sm text-gray-500 bg-gray-50/30">
                              No enrollments in this group.
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                      Registration #
                                    </th>
                                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                      Name
                                    </th>
                                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                      Course
                                    </th>
                                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                      Type
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                  {group.enrollments.map((e) => (
                                    <tr key={e.id} className="hover:bg-gray-50/50">
                                      <td className="px-4 py-2.5 whitespace-nowrap text-sm font-mono text-gray-800">
                                        {e.student_registration_number || e.student_custom_id}
                                      </td>
                                      <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-900 font-medium">
                                        {e.student_name}
                                      </td>
                                      <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-800">
                                        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded mr-1.5">
                                          {e.course_code}
                                        </span>
                                        {e.course_name}
                                      </td>
                                      <td className="px-4 py-2.5 whitespace-nowrap">
                                        {e.enrolled_by_name ? (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                            📌 SAC
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                            Student
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'raw' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 justify-between flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Showing {filteredRawEnrollments.length} / {(data.all_enrollments || []).length} enrollments
                      </span>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by name, reg #, course..."
                        value={rawSearchFilter}
                        onChange={(e) => setRawSearchFilter(e.target.value)}
                        className="pl-9 pr-4 py-2 w-72 max-w-full border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Registration #
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Student Name
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Course
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Type
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Group
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Locked
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Assigned By
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Enrolled At
                            </th>
                            <th className="px-4 py-2.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {filteredRawEnrollments.length === 0 ? (
                            <tr>
                              <td
                                colSpan={9}
                                className="px-4 py-10 text-center text-sm text-gray-500 bg-gray-50/30"
                              >
                                No enrollments match your search.
                              </td>
                            </tr>
                          ) : (
                            filteredRawEnrollments.map((e) => (
                              <tr key={e.id} className="hover:bg-gray-50/50">
                                <td className="px-4 py-2.5 whitespace-nowrap text-sm font-mono text-gray-800">
                                  {e.student_registration_number || e.student_custom_id}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-900 font-medium">
                                  {e.student_name}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-800">
                                  <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded mr-1.5">
                                    {e.course_code}
                                  </span>
                                  {e.course_name}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                      e.course_offering_type === 'SELECTIVE'
                                        ? 'bg-red-50 text-red-700'
                                        : e.course_offering_type === 'ELECTIVE'
                                          ? 'bg-emerald-50 text-emerald-700'
                                          : 'bg-gray-100 text-gray-700'
                                    }`}
                                  >
                                    {e.course_offering_type || '—'}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-600">
                                  {e.selective_group_name ? (
                                    <span className="text-red-700">Sel: {e.selective_group_name}</span>
                                  ) : e.elective_group_name ? (
                                    <span className="text-purple-700">Elec: {e.elective_group_name}</span>
                                  ) : (
                                    <span className="text-emerald-700">Open</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap">
                                  {e.is_locked ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                      <Lock className="w-3 h-3 mr-1" />
                                      Yes
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                      No
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-600">
                                  {e.enrolled_by_name || 'Student'}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500">
                                  {new Date(e.enrolled_at).toLocaleString()}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap text-right">
                                  <div className="inline-flex gap-1.5 justify-end">
                                    {e.selective_group_id ? (
                                      <button
                                        onClick={() =>
                                          openOverrideForSelective(
                                            e.student_id,
                                            e.student_name,
                                            e.student_registration_number || e.student_custom_id,
                                            e.selective_group_id!,
                                            e.selective_group_name || 'Selective Group',
                                            e
                                          )
                                        }
                                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center gap-1 inline-flex"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                        Change
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          const studentOpen = (data.open_elective_enrollments || []).filter(
                                            (oe) => oe.student_id === e.student_id
                                          );
                                          openOverrideForStandalone(
                                            e.student_id,
                                            e.student_name,
                                            e.student_registration_number || e.student_custom_id,
                                            studentOpen
                                          );
                                        }}
                                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center gap-1 inline-flex"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                        Change
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleRemoveEnrollment(e)}
                                      className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-semibold flex items-center gap-1 inline-flex"
                                    >
                                      <X className="h-3 w-3" />
                                      Remove
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showOpenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Open Elective Selection Window</h3>
            <p className="text-sm text-gray-600 mb-4">
              Students will be able to submit their elective choices. Once locked, the window cannot be reopened.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Max Open Electives Allowed
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={openMaxElectives}
                onChange={(e) => setOpenMaxElectives(Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Applies only to standalone/open electives. Required selective groups always require exactly one pick per group.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowOpenModal(false)}
                disabled={submitting}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleOpenWindow}
                disabled={submitting}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="animate-spin h-4 w-4" />}
                <Unlock className="h-4 w-4" />
                Open Window
              </button>
            </div>
          </div>
        </div>
      )}

      {showLockConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Lock Selections Permanently?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  This action is <strong>irreversible</strong>. The window will be closed, and all active
                  enrollments for this batch and semester will be marked as locked. Students will no longer be
                  able to change their choices.
                </p>
                {hasIncomplete && (
                  <p className="text-sm font-semibold text-red-700 mt-2 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    ⚠ Warning: {incompleteStudents.length} students still have incomplete picks. Locking now
                    will freeze the current state.
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowLockConfirm(false)}
                disabled={submitting}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleLockWindow}
                disabled={submitting}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="animate-spin h-4 w-4" />}
                <Lock className="h-4 w-4" />
                Yes, Lock Selections
              </button>
            </div>
          </div>
        </div>
      )}

      {showLockElectiveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Lock className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Lock Elective Enrollments Only?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  This will freeze all open/standalone elective selections for this batch and semester.
                  Selective-group picks will remain editable. Students will no longer be able to change
                  their elective choices, but the window stays open for selective adjustments.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowLockElectiveConfirm(false)}
                disabled={submitting}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleLockElectiveOnly}
                disabled={submitting}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="animate-spin h-4 w-4" />}
                <Lock className="h-4 w-4" />
                Yes, Lock Electives
              </button>
            </div>
          </div>
        </div>
      )}

      {lockErrorDialog.open && lockErrorDialog.error && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg shrink-0">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">
                  Cannot Lock — Incomplete Required Selections
                </h3>
                <p className="text-sm text-gray-600 mt-1">{lockErrorDialog.error.error}</p>
              </div>
              <button
                onClick={() => setLockErrorDialog({ open: false, error: null })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto border border-red-100 rounded-lg bg-red-50/30 p-4 space-y-2">
              {(lockErrorDialog.error.incomplete_picks || []).length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-4">No details available.</p>
              ) : (
                (lockErrorDialog.error.incomplete_picks || []).map((s) => (
                  <div
                    key={s.student_id}
                    className="bg-white border border-red-100 rounded-lg px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">
                        {s.name}{' '}
                        <span className="font-mono text-xs text-gray-500">
                          ({s.registration_number || s.custom_id})
                        </span>
                      </p>
                      <p className="text-xs text-red-700 mt-0.5">
                        Missing: {s.missing_groups.map((g) => g.group_name).join(', ')}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setLockErrorDialog({ open: false, error: null });
                        setShowLockConfirm(false);
                        if (s.missing_groups.length > 0) {
                          openOverrideForSelective(
                            s.student_id,
                            s.name,
                            s.registration_number || s.custom_id,
                            s.missing_groups[0].selective_group_id,
                            s.missing_groups[0].group_name
                          );
                        }
                      }}
                      className="shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center gap-1"
                    >
                      <Edit2 className="h-3 w-3" />
                      Fix
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
              <button
                onClick={() => setLockErrorDialog({ open: false, error: null })}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {overrideModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Override Selection — {overrideModal.studentName}{' '}
                  <span className="font-mono text-sm text-gray-500">
                    ({overrideModal.studentRegistrationNumber})
                  </span>
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {overrideModal.context.type === 'selective'
                    ? `Required Selective Group: ${overrideModal.context.selectiveGroupName}`
                    : `Standalone / Open Electives (Max ${window?.max_electives_allowed ?? 'N/A'} per student)`}
                </p>
              </div>
              <button
                onClick={closeOverrideModal}
                className="text-gray-400 hover:text-gray-600 shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {overrideChoicesLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">Loading eligible course options...</p>
                </div>
              ) : overrideModal.context.type === 'selective' ? (
                <div className="space-y-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                    <p className="text-sm font-semibold text-red-800 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      Required — pick one
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 italic px-1">
                    Note: Options may be restricted for this student based on eligibility rules.
                  </p>
                   {(() => {
                     const ctx = overrideModal.context as Extract<typeof overrideModal.context, { type: 'selective' }>;
                     const matchedGroup = (overrideChoices?.selective_groups || []).find(
                       (g) => g.selective_group_id === ctx.selectiveGroupId
                     );
                    const courses = matchedGroup?.courses || [];
                    if (courses.length === 0) {
                      return (
                        <div className="border border-amber-200 bg-amber-50 rounded-lg px-4 py-6 text-center">
                          <AlertTriangle className="h-6 w-6 text-amber-600 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-amber-800">
                            No eligible options for this student in the group.
                          </p>
                          <p className="text-xs text-amber-700 mt-1">
                            Contact admin to review eligibility rules or course offerings.
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-2 border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                        {courses.map((course: ElectiveCourseOption) => {
                          const checked = overrideSelectedSelective === course.id;
                          return (
                            <label
                              key={course.id}
                              className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                                checked ? 'bg-indigo-50' : 'bg-white hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name="selective-course"
                                className="mt-1 text-indigo-600 focus:ring-indigo-500"
                                checked={checked}
                                onChange={() => setOverrideSelectedSelective(course.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                                    {course.code}
                                  </span>
                                  <span className="font-semibold text-gray-900 text-sm">{course.name}</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {course.credit_hours} credit{course.credit_hours === 1 ? '' : 's'}
                                  {course.course_type ? ` · ${course.course_type}` : ''}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
                    <p className="text-sm font-semibold text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      Optional — select any combination of open electives
                    </p>
                    {window?.max_electives_allowed && (
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Cap: Max {window.max_electives_allowed} total electives per student
                      </p>
                    )}
                  </div>
                  {(() => {
                    const openCourses = overrideChoices?.open_electives || [];
                    if (openCourses.length === 0) {
                      return (
                        <div className="border border-gray-200 bg-gray-50 rounded-lg px-4 py-6 text-center">
                          <BookOpen className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-gray-700">
                            No open electives available for this semester.
                          </p>
                        </div>
                      );
                    }
                    const selectedCount = Object.values(overrideSelectedStandalone).filter(Boolean).length;
                    return (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-600 px-1">
                          Currently selected: {selectedCount}
                          {window?.max_electives_allowed ? ` / ${window.max_electives_allowed}` : ''}
                        </p>
                        <div className="space-y-2 border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                          {openCourses.map((course: ElectiveCourseOption) => {
                            const checked = !!overrideSelectedStandalone[course.id];
                            return (
                              <label
                                key={course.id}
                                className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                                  checked ? 'bg-emerald-50' : 'bg-white hover:bg-gray-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="mt-1 text-emerald-600 focus:ring-emerald-500 rounded"
                                  checked={checked}
                                  onChange={() =>
                                    setOverrideSelectedStandalone((prev) => ({
                                      ...prev,
                                      [course.id]: !prev[course.id],
                                    }))
                                  }
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                                      {course.code}
                                    </span>
                                    <span className="font-semibold text-gray-900 text-sm">{course.name}</span>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {course.credit_hours} credit{course.credit_hours === 1 ? '' : 's'}
                                    {course.course_type ? ` · ${course.course_type}` : ''}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
              <button
                onClick={closeOverrideModal}
                disabled={overrideSaving}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleOverrideSave}
                disabled={
                  overrideSaving ||
                  overrideChoicesLoading ||
                  (overrideModal.context.type === 'selective' && !overrideSelectedSelective)
                }
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {overrideSaving && <Loader2 className="animate-spin h-4 w-4" />}
                <Save className="h-4 w-4" />
                Save Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SACElectiveEnrollmentReview;
