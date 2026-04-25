import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, CheckCircle2, Clock3, RefreshCw, Send, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { datesheetService, DateSheetApiRecord, DateSheetEligibilityRecord } from '../../../api/datesheetService';
import { api } from '../../../api/api';

type RoleType = 'coordinator' | 'hod' | 'student';
type ExamType = 'Mid' | 'Final';

interface DateSheetModuleProps {
  role: RoleType;
}

interface PickerOption {
  id: number;
  name: string;
  code?: string;
  department?: number;
}

interface DraftItem {
  course: number | '';
  exam_date: string;
  start_time: string;
  end_time: string;
  exam_type: ExamType;
}

const statusClasses: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
};

const DateSheetModule: React.FC<DateSheetModuleProps> = ({ role }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [overrideLoading, setOverrideLoading] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [departments, setDepartments] = useState<PickerOption[]>([]);
  const [semesters, setSemesters] = useState<PickerOption[]>([]);
  const [courses, setCourses] = useState<PickerOption[]>([]);
  const [sheets, setSheets] = useState<DateSheetApiRecord[]>([]);
  const [eligibility, setEligibility] = useState<DateSheetEligibilityRecord[]>([]);

  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [semesterId, setSemesterId] = useState<number | ''>('');
  const [items, setItems] = useState<DraftItem[]>([
    { course: '', exam_date: '', start_time: '', end_time: '', exam_type: 'Mid' },
  ]);

  const [selectedSheet, setSelectedSheet] = useState<number | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [currentStudentRollNo, setCurrentStudentRollNo] = useState<string>('');

  const showCoordinatorForm = role === 'coordinator';
  const showReviewActions = role === 'hod';
  const showEligibilityGrid = role === 'hod' || role === 'student';
  const showFilters = role !== 'student';
  const showStudentColumn = role !== 'student';

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const fetchFilters = async () => {
    const [deptRes, semRes] = await Promise.all([
      datesheetService.listDepartments(),
      datesheetService.listSemesters(),
    ]);
    setDepartments(
      (deptRes.data || []).map((d: any) => ({
        id: d.department_id || d.id,
        name: d.name,
        code: d.code,
      })),
    );
    setSemesters(
      (semRes.data || []).map((s: any) => ({
        id: s.semester_id || s.id,
        name: s.name,
        code: s.semester_code,
        department: s.department || s.department_id,
      })),
    );
  };

  const fetchSheets = async () => {
    const params: any = {};
    if (departmentId) params.department = departmentId;
    if (semesterId) params.semester = semesterId;
    if (role === 'hod') params.status = 'pending';
    if (role === 'student') params.status = 'approved';
    const res = await datesheetService.list(params);
    setSheets(res.data || []);
  };

  const fetchEligibility = async () => {
    if (!showEligibilityGrid) return;
    const params: any = {};
    if (departmentId) params.department = departmentId;
    if (semesterId) params.semester = semesterId;
    if (role === 'hod') params.low_attendance = true;
    const res = await datesheetService.listEligibility(params);
    setEligibility(res.data || []);
  };

  const fetchCourses = async (semesterVal?: number | '') => {
    if (!semesterVal) {
      setCourses([]);
      return;
    }
    const res = await datesheetService.listCourses(Number(semesterVal));
    setCourses(
      (res.data || []).map((c: any) => ({
        id: c.course_id || c.id,
        name: c.name,
        code: c.code,
      })),
    );
  };

  const refreshAll = async () => {
    setLoading(true);
    resetMessages();
    try {
      await Promise.all([fetchSheets(), fetchEligibility()]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load DateSheet data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters().catch(() => {
      setError('Failed to load filters.');
    });
  }, []);

  useEffect(() => {
    if (role !== 'student') return;
    let cancelled = false;
    const fetchStudentProfile = async () => {
      try {
        const response = await api.get('students/profile/');
        const rollNo = String(response?.data?.student_id || '').trim();
        if (!cancelled) {
          setCurrentStudentRollNo(rollNo);
        }
      } catch (_err) {
        if (!cancelled) {
          setCurrentStudentRollNo('');
        }
      }
    };
    fetchStudentProfile();
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    refreshAll();
  }, [departmentId, semesterId, role]);

  useEffect(() => {
    fetchCourses(semesterId);
  }, [semesterId]);

  const addItemRow = () => {
    setItems((prev) => [...prev, { course: '', exam_date: '', start_time: '', end_time: '', exam_type: 'Mid' }]);
  };

  const updateItem = (index: number, key: keyof DraftItem, value: any) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const filteredSemesters = useMemo(
    () => (departmentId ? semesters.filter((s) => s.department === departmentId) : semesters),
    [departmentId, semesters],
  );

  const visibleEligibilityRows = useMemo(() => {
    if (role !== 'student') return eligibility;
    if (eligibility.length === 0) return [];
    if (!currentStudentRollNo) return [];
    const ownRollNo = currentStudentRollNo.toLowerCase();
    return eligibility.filter((row) => String(row.student_roll_no || '').trim().toLowerCase() === ownRollNo);
  }, [eligibility, role, currentStudentRollNo]);

  const createDraft = async () => {
    resetMessages();
    if (!departmentId || !semesterId) {
      setError('Please select department and semester.');
      return;
    }
    if (items.some((i) => !i.course || !i.exam_date || !i.start_time || !i.end_time)) {
      setError('Please complete all DateSheet item fields.');
      return;
    }

    setSaving(true);
    try {
      await datesheetService.create({
        department_id: Number(departmentId),
        semester_id: Number(semesterId),
        items: items.map((i) => ({
          course: Number(i.course),
          exam_date: i.exam_date,
          start_time: i.start_time,
          end_time: i.end_time,
          exam_type: i.exam_type,
        })),
      });
      setSuccess('DateSheet draft created successfully.');
      setItems([{ course: '', exam_date: '', start_time: '', end_time: '', exam_type: 'Mid' }]);
      await refreshAll();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to create DateSheet.');
    } finally {
      setSaving(false);
    }
  };

  const submitSheet = async (id: number) => {
    setSubmitting(id);
    resetMessages();
    try {
      await datesheetService.submit(id);
      setSuccess('DateSheet submitted for HOD approval.');
      await refreshAll();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to submit DateSheet.');
    } finally {
      setSubmitting(null);
    }
  };

  const approveSheet = async (id: number) => {
    setReviewing(id);
    resetMessages();
    try {
      await datesheetService.approve(id, reviewComment.trim());
      setReviewComment('');
      setSuccess('DateSheet approved successfully.');
      await refreshAll();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to approve DateSheet.');
    } finally {
      setReviewing(null);
    }
  };

  const rejectSheet = async (id: number) => {
    if (!rejectionReason.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    setReviewing(id);
    resetMessages();
    try {
      await datesheetService.reject(id, rejectionReason.trim());
      setRejectionReason('');
      setSuccess('DateSheet rejected successfully.');
      await refreshAll();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to reject DateSheet.');
    } finally {
      setReviewing(null);
    }
  };

  const applyOverride = async (eligibilityId: number) => {
    if (!overrideReason.trim()) {
      setError('Override reason is required.');
      return;
    }
    setOverrideLoading(eligibilityId);
    resetMessages();
    try {
      await datesheetService.overrideEligibility(eligibilityId, overrideReason.trim());
      setSuccess('Eligibility override applied.');
      setOverrideReason('');
      await fetchEligibility();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to apply override.');
    } finally {
      setOverrideLoading(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">DateSheet Management</h2>
            <p className="text-sm text-slate-500">Role-aware exam scheduling, approval, and attendance eligibility.</p>
          </div>
          <button onClick={refreshAll} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>
            <select
              value={semesterId}
              onChange={(e) => setSemesterId(e.target.value ? Number(e.target.value) : '')}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All Semesters</option>
              {filteredSemesters.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      {showCoordinatorForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900"><CalendarDays className="h-5 w-5 text-indigo-600" /> Create DateSheet Draft</h3>
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-6">
                <select value={item.course} onChange={(e) => updateItem(idx, 'course', e.target.value ? Number(e.target.value) : '')} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
                  <option value="">Course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                  ))}
                </select>
                <input type="date" value={item.exam_date} onChange={(e) => updateItem(idx, 'exam_date', e.target.value)} className="rounded-md border border-slate-300 px-2 py-2 text-sm" />
                <input type="time" value={item.start_time} onChange={(e) => updateItem(idx, 'start_time', e.target.value)} className="rounded-md border border-slate-300 px-2 py-2 text-sm" />
                <input type="time" value={item.end_time} onChange={(e) => updateItem(idx, 'end_time', e.target.value)} className="rounded-md border border-slate-300 px-2 py-2 text-sm" />
                <select value={item.exam_type} onChange={(e) => updateItem(idx, 'exam_type', e.target.value as ExamType)} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
                  <option value="Mid">Mid</option>
                  <option value="Final">Final</option>
                </select>
                <button onClick={() => removeItem(idx)} className="rounded-md border border-rose-200 px-2 py-2 text-sm text-rose-600 hover:bg-rose-50">Remove</button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={addItemRow} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">Add Subject</button>
            <button disabled={saving} onClick={createDraft} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900"><Clock3 className="h-5 w-5 text-blue-600" /> DateSheets</h3>
        {loading ? (
          <div className="py-10 text-center text-slate-500">Loading DateSheets...</div>
        ) : sheets.length === 0 ? (
          <div className="py-10 text-center text-slate-500">No DateSheets found for selected filters.</div>
        ) : (
          <div className="space-y-4">
            {sheets.map((sheet) => (
              <div key={sheet.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{sheet.department.name} - {sheet.semester.name}</p>
                    <p className="text-xs text-slate-500">Created by {sheet.created_by_name || 'N/A'} • {new Date(sheet.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses[sheet.status] || 'bg-slate-100 text-slate-700'}`}>{sheet.status_label}</span>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-2 py-2">Course</th>
                        <th className="px-2 py-2">Date</th>
                        <th className="px-2 py-2">Time</th>
                        <th className="px-2 py-2">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.items.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-2 py-2">{item.course_code} - {item.course_name}</td>
                          <td className="px-2 py-2">{item.exam_date}</td>
                          <td className="px-2 py-2">{item.start_time} - {item.end_time}</td>
                          <td className="px-2 py-2">{item.exam_type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {showCoordinatorForm && sheet.status === 'draft' && (
                  <div className="mt-3">
                    <button
                      onClick={() => submitSheet(sheet.id)}
                      disabled={submitting === sheet.id}
                      className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      <Send className="h-4 w-4" /> {submitting === sheet.id ? 'Submitting...' : 'Submit for Approval'}
                    </button>
                  </div>
                )}

                {showReviewActions && sheet.status === 'pending' && (
                  <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                    <input value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Approval comment (optional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <input value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Rejection reason (required for reject)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <div className="md:col-span-2 flex flex-wrap gap-2">
                      <button onClick={() => approveSheet(sheet.id)} disabled={reviewing === sheet.id} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
                        <CheckCircle2 className="h-4 w-4" /> Approve
                      </button>
                      <button onClick={() => rejectSheet(sheet.id)} disabled={reviewing === sheet.id} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60">
                        <XCircle className="h-4 w-4" /> Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showEligibilityGrid && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            {role === 'hod' ? <ShieldAlert className="h-5 w-5 text-rose-600" /> : <ShieldCheck className="h-5 w-5 text-emerald-600" />}
            {role === 'hod' ? 'Low Attendance & Override' : 'Subject Eligibility'}
          </h3>
          {visibleEligibilityRows.length === 0 ? (
            <div className="py-8 text-center text-slate-500">No eligibility records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    {showStudentColumn && <th className="px-2 py-2">Student</th>}
                    <th className="px-2 py-2">Course</th>
                    <th className="px-2 py-2">Attendance</th>
                    <th className="px-2 py-2">Status</th>
                    {role === 'hod' && <th className="px-2 py-2">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {visibleEligibilityRows.map((row) => {
                    const statusText = row.eligibility_status || (row.overridden_by_hod ? 'Eligible (Overridden)' : row.is_eligible ? 'Eligible' : 'Not Eligible');
                    return (
                      <tr key={row.id} className="border-t border-slate-100">
                        {showStudentColumn && <td className="px-2 py-2">{row.student_name} ({row.student_roll_no})</td>}
                        <td className="px-2 py-2">{row.course_code} - {row.course_name}</td>
                        <td className="px-2 py-2">{row.attendance_percentage}%</td>
                        <td className="px-2 py-2">
                          <span className={`rounded-full px-2 py-1 text-xs ${statusText.includes('Overridden') ? 'bg-indigo-100 text-indigo-700' : statusText === 'Eligible' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {statusText}
                          </span>
                          {row.hod_reason ? <div className="mt-1 text-xs text-slate-500">Reason: {row.hod_reason}</div> : null}
                        </td>
                        {role === 'hod' && (
                          <td className="px-2 py-2">
                            {!row.is_eligible && !row.overridden_by_hod ? (
                              <div className="flex gap-2">
                                {selectedSheet === row.id ? (
                                  <>
                                    <input
                                      value={overrideReason}
                                      onChange={(e) => setOverrideReason(e.target.value)}
                                      placeholder="Override justification"
                                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                                    />
                                    <button
                                      onClick={() => applyOverride(row.id)}
                                      disabled={overrideLoading === row.id}
                                      className="rounded-md bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-60"
                                    >
                                      {overrideLoading === row.id ? 'Saving...' : 'Allow'}
                                    </button>
                                  </>
                                ) : (
                                  <button onClick={() => setSelectedSheet(row.id)} className="rounded-md border border-indigo-200 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-50">
                                    Override
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">No action needed</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default DateSheetModule;
