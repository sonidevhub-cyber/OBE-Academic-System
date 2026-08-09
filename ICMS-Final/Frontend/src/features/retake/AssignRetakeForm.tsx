import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { CheckCircle2, XCircle, Loader2, Check, AlertCircle } from 'lucide-react';

import { api } from '../../api/api';
import { curriculumService } from '../../api/curriculumService';
import { useAuth } from '../../context/AuthContext';
import {
  bulkAssignRetakes,
  getFailedStudentsForBatchCourse,
  getPreviousInstructor,
} from './retakeApi';
import type {
  BatchOption,
  BulkRetakeAssignmentResponse,
  CourseOption,
  FailedStudentOption,
  PerStudentRetakeResult,
  TeacherOption,
} from './types';

const inputClassName =
  'w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all';

const labelClassName =
  'mb-2 block text-xs font-black uppercase tracking-widest text-gray-400';

const normalizeList = (payload: any) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const parseSemesterNo = (course: any): number | undefined => {
  const semester =
    course?.semester_no ??
    course?.semester_number ??
    course?.semester ??
    course?.semesterId ??
    course?.semester_id;
  const parsed = Number(semester);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const AssignRetakeForm: React.FC<{ onCreated?: () => void }> = ({ onCreated }) => {
  const { currentUser, loading: authLoading } = useAuth();
  const role = currentUser?.effective_role || currentUser?.active_role || currentUser?.role;
  const canAssign = role === 'SAC';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [previousInstructorNote, setPreviousInstructorNote] = useState<string | null>(null);
  const [previousInstructorFetched, setPreviousInstructorFetched] = useState(false);

  const [failedStudents, setFailedStudents] = useState<FailedStudentOption[]>([]);
  const [failedStudentsLoading, setFailedStudentsLoading] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  const [results, setResults] = useState<PerStudentRetakeResult[] | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  useEffect(() => {
    const loadInitialOptions = async () => {
      try {
        const [batchRes, teacherRes] = await Promise.all([
          api.get('batches/all/'),
          api.get('instructors/'),
        ]);

        const batchRows = normalizeList(batchRes.data);
        const teacherRows = normalizeList(teacherRes.data);

        setBatches(
          batchRows.map((batch: any) => ({
            id: String(batch.id),
            name: batch.name,
            current_semester: batch.current_semester,
            curriculum_version_id: batch.curriculum_version_id || batch.curriculum_version?.id,
          }))
        );

        setTeachers(
          teacherRows
            .filter((teacher: any) => {
              const teacherRole = teacher.role || teacher.user?.role;
              return (
                teacherRole === 'instructor' ||
                teacherRole === 'tvf' ||
                teacherRole === 'Teacher'
              );
            })
            .map((teacher: any) => ({
              id: String(teacher.user || teacher.id),
              name:
                teacher.name ||
                teacher.user_name ||
                teacher.user?.full_name ||
                'Teacher',
            }))
        );
      } catch (error) {
        console.error('Failed to load retake form data', error);
        toast.error('Failed to load retake form options');
      } finally {
        setLoading(false);
      }
    };

    loadInitialOptions();
  }, []);

  const selectedBatch = useMemo(
    () => batches.find((batch) => String(batch.id) === selectedBatchId) || null,
    [batches, selectedBatchId]
  );

  const selectedCourse = useMemo(
    () => courses.find((course) => String(course.id) === selectedCourseId) || null,
    [courses, selectedCourseId]
  );

  const selectedTeacher = useMemo(
    () => teachers.find((t) => String(t.id) === selectedTeacherId) || null,
    [teachers, selectedTeacherId]
  );

  const eligibleCourses = useMemo(() => {
    const currentSemester = Number(selectedBatch?.current_semester || 0);
    if (!currentSemester) return courses;

    return courses.filter((course) => {
      if (typeof course.semester_no !== 'number') return true;
      return course.semester_no < currentSemester;
    });
  }, [courses, selectedBatch?.current_semester]);

  useEffect(() => {
    const loadBatchCourses = async () => {
      if (!selectedBatchId || !selectedBatch) {
        setCourses([]);
        setCoursesLoading(false);
        return;
      }

      setCoursesLoading(true);
      try {
        const currentSemester = Number(selectedBatch.current_semester || 0);
        let courseRows: CourseOption[] = [];

        if (selectedBatch.curriculum_version_id) {
          const versionResponse = await curriculumService.getVersion(
            Number(selectedBatch.curriculum_version_id)
          );
          const versionData = versionResponse.data?.data || versionResponse.data;
          const groupedCourses = versionData?.courses_by_semester || {};

          courseRows = Object.values(groupedCourses)
            .flat()
            .map((course: any) => ({
              id: String(course.course || course.id),
              name: course.course_name || course.name || 'Unnamed Course',
              code: course.course_code || course.code || undefined,
              semester_no: parseSemesterNo(course),
            }));
        } else {
          const response = await api.get('courses/', {
            params: { batch_id: selectedBatchId },
          });
          const courseRowsRaw = normalizeList(response.data);
          courseRows = courseRowsRaw.map((course: any) => ({
            id: String(course.course_id || course.id),
            name: course.name || course.course_name || 'Unnamed Course',
            code: course.code || course.course_code || undefined,
            semester_no: parseSemesterNo(course),
          }));
        }

        const filteredRows =
          currentSemester > 1
            ? courseRows.filter(
                (course) =>
                  typeof course.semester_no !== 'number' ||
                  course.semester_no < currentSemester
              )
            : courseRows;

        setCourses(filteredRows);
      } catch (error) {
        console.error('Failed to load batch courses', error);
        toast.error('Failed to load courses for the selected batch');
        setCourses([]);
      } finally {
        setCoursesLoading(false);
      }
    };

    loadBatchCourses();
  }, [selectedBatch, selectedBatchId]);

  useEffect(() => {
    const loadFailedStudentsAndInstructor = async () => {
      if (!selectedBatchId || !selectedCourseId) {
        setFailedStudents([]);
        setFailedStudentsLoading(false);
        setPreviousInstructorNote(null);
        setPreviousInstructorFetched(false);
        return;
      }

      setFailedStudentsLoading(true);
      setPreviousInstructorFetched(false);

      try {
        const [studentsData, instructorData] = await Promise.all([
          getFailedStudentsForBatchCourse(selectedBatchId, selectedCourseId),
          getPreviousInstructor(selectedBatchId, selectedCourseId),
        ]);

        setFailedStudents(studentsData || []);

        if (instructorData.found && instructorData.teacher_id && instructorData.name) {
          const teacherExists = teachers.some(
            (t) => String(t.id) === String(instructorData.teacher_id)
          );
          if (teacherExists) {
            setSelectedTeacherId(String(instructorData.teacher_id));
            setPreviousInstructorNote(`Previously taught by ${instructorData.name}`);
          } else {
            setPreviousInstructorNote(
              `Previously taught by ${instructorData.name} (no longer available in list)`
            );
          }
        } else {
          setSelectedTeacherId('');
          setPreviousInstructorNote(null);
        }
        setPreviousInstructorFetched(true);
      } catch (error) {
        console.error('Failed to load failed students / previous instructor', error);
        toast.error('Failed to load eligible students');
        setFailedStudents([]);
      } finally {
        setFailedStudentsLoading(false);
      }
    };

    setSelectedStudentIds(new Set());
    setResults(null);
    loadFailedStudentsAndInstructor();
  }, [selectedBatchId, selectedCourseId, teachers]);

  const handleBatchChange = (batchId: string) => {
    setSelectedBatchId(batchId);
    setSelectedCourseId('');
    setSelectedTeacherId('');
    setPreviousInstructorNote(null);
    setPreviousInstructorFetched(false);
    setFailedStudents([]);
    setSelectedStudentIds(new Set());
    setResults(null);
  };

  const handleCourseChange = (courseId: string) => {
    setSelectedCourseId(courseId);
    setSelectedStudentIds(new Set());
    setResults(null);
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const toggleAllStudents = () => {
    if (selectedStudentIds.size === failedStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(failedStudents.map((s) => s.student_id)));
    }
  };

  const selectedStudentsForSummary = useMemo(() => {
    return failedStudents.filter((s) => selectedStudentIds.has(s.student_id));
  }, [failedStudents, selectedStudentIds]);

  const handleConfirmAssign = async () => {
    if (selectedStudentIds.size === 0) {
      toast.error('Please select at least one student');
      return;
    }
    setConfirmModalOpen(false);
    setSubmitting(true);
    try {
      const response: BulkRetakeAssignmentResponse = await bulkAssignRetakes({
        batch_id: selectedBatchId,
        course_id: selectedCourseId,
        teacher_id: selectedTeacherId || null,
        student_ids: Array.from(selectedStudentIds),
      });
      setResults(response.results);

      const { succeeded, failed, total } = response.summary;
      if (succeeded > 0 && failed === 0) {
        toast.success(`Retake assigned for all ${total} student(s)`);
      } else if (succeeded > 0 && failed > 0) {
        toast.success(`${succeeded} of ${total} retake(s) assigned; ${failed} failed`);
      } else {
        toast.error(`Failed to assign any retakes (${failed} error(s))`);
      }

      if (succeeded > 0) {
        onCreated?.();
      }
    } catch (error: any) {
      console.error('Failed to bulk assign retakes', error);
      toast.error(
        error?.response?.data?.detail ||
          error?.response?.data?.error ||
          'Failed to assign retakes'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getResultForStudent = (studentId: string): PerStudentRetakeResult | null => {
    if (!results) return null;
    return results.find((r) => r.student_id === studentId) || null;
  };

  if (authLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500">
        Loading auth state...
      </div>
    );
  }

  if (!canAssign) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 p-6 text-sm text-gray-500">
        Retake assignment is restricted to SAC users.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500">
        Loading retake form options...
      </div>
    );
  }

  const currentSemester = Number(selectedBatch?.current_semester || 0);
  const hasRetakeEligibleSemester =
    !selectedBatch?.current_semester || currentSemester > 1;
  const canSubmit = selectedStudentIds.size > 0 && !!selectedTeacherId && !submitting;

  return (
    <div className="space-y-5 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div>
        <h3 className="text-2xl font-black text-gray-900">Assign Course Retakes</h3>
        <p className="mt-1 text-sm font-medium text-gray-500">
          Subject-first bulk workflow: pick a batch and course, then multi-select all
          failed students together. The previous instructor is auto-suggested (editable).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={labelClassName}>1. Batch</label>
          <select
            value={selectedBatchId}
            onChange={(event) => handleBatchChange(event.target.value)}
            className={inputClassName}
          >
            <option value="">Select batch</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
                {typeof batch.current_semester === 'number'
                  ? ` - Semester ${batch.current_semester}`
                  : ''}
              </option>
            ))}
          </select>
          {selectedBatch?.current_semester && (
            <p className="mt-2 text-xs font-medium text-gray-400">
              Current semester: {selectedBatch.current_semester}. Retake-eligible
              courses: semesters 1 to {selectedBatch.current_semester - 1}.
            </p>
          )}
        </div>

        <div>
          <label className={labelClassName}>2. Subject / Course</label>
          <select
            value={selectedCourseId}
            onChange={(event) => handleCourseChange(event.target.value)}
            disabled={
              !selectedBatchId || coursesLoading || !hasRetakeEligibleSemester
            }
            className={inputClassName}
          >
            <option value="">
              {!selectedBatchId
                ? 'Select batch first'
                : coursesLoading
                  ? 'Loading courses...'
                  : !hasRetakeEligibleSemester
                    ? 'No retake courses available'
                    : 'Select course'}
            </option>
            {eligibleCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code ? `${course.code} - ${course.name}` : course.name}
                {typeof course.semester_no === 'number'
                  ? ` (Sem ${course.semester_no})`
                  : ''}
              </option>
            ))}
          </select>
          {selectedBatchId &&
            !coursesLoading &&
            selectedBatch?.current_semester === 1 && (
              <p className="mt-2 text-xs font-medium text-amber-600">
                Retake is not available for Semester 1 batches.
              </p>
            )}
        </div>
      </div>

      {selectedBatchId && selectedCourseId && (
        <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-black uppercase tracking-widest text-gray-500">
                3. Students who failed this subject
              </h4>
              <p className="mt-1 text-xs text-gray-500">
                Auto-detected from existing results. Multi-select for bulk assignment.
              </p>
            </div>
            {failedStudents.length > 0 && (
              <button
                type="button"
                onClick={toggleAllStudents}
                className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-300"
              >
                {selectedStudentIds.size === failedStudents.length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            )}
          </div>

          {failedStudentsLoading ? (
            <div className="flex items-center justify-center py-10 text-sm font-medium text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading failed students...
            </div>
          ) : failedStudents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
              <AlertCircle className="mx-auto mb-3 h-8 w-8 text-gray-300" />
              <p className="text-sm font-semibold text-gray-600">
                No failed students found for this batch + subject.
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Either all students passed, results are not finalized, or eligible
                students already have an active retake.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs font-black uppercase tracking-widest text-gray-400">
                    <th className="px-4 py-3 pr-3 w-12">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-3 py-3">Student</th>
                    <th className="px-3 py-3">Reg. No.</th>
                    <th className="px-3 py-3">Last %</th>
                    <th className="px-3 py-3">Grade</th>
                    <th className="px-3 py-3">Attempts</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {failedStudents.map((student) => {
                    const result = getResultForStudent(student.student_id);
                    const isChecked = selectedStudentIds.has(student.student_id);
                    return (
                      <tr
                        key={student.student_id}
                        className={`align-middle border-b border-gray-50 last:border-b-0 transition-colors ${
                          result
                            ? result.success
                              ? 'bg-green-50/60'
                              : 'bg-red-50/60'
                            : isChecked
                              ? 'bg-indigo-50/40'
                              : ''
                        }`}
                      >
                        <td className="px-4 py-3 pr-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleStudent(student.student_id)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-bold text-gray-900">{student.name}</div>
                          <div className="text-xs text-gray-500">
                            ID: {student.student_id.slice(0, 8)}...
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700">
                          {student.registration_number || '—'}
                        </td>
                        <td className="px-3 py-3">
                          {typeof student.last_percentage === 'number' ? (
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-bold ${
                                student.last_percentage < 40
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {student.last_percentage.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-gray-700">
                          {student.last_grade || '—'}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700">
                          {student.current_retake_attempts} / 3
                        </td>
                        <td className="px-3 py-3">
                          {result ? (
                            result.success ? (
                              <div className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-black text-green-700">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Assigned (#{result.attempt_number})
                              </div>
                            ) : (
                              <div
                                className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-black text-red-700"
                                title={result.error || ''}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Failed
                              </div>
                            )
                          ) : student.has_active_retake ? (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                              Has active retake
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
                              Eligible
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {results && results.length > 0 && (
            <div className="mt-4 space-y-2">
              {results
                .filter((r) => !r.success && r.error)
                .map((r) => {
                  const st = failedStudents.find((s) => s.student_id === r.student_id);
                  return (
                    <div
                      key={r.student_id}
                      className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                    >
                      <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div>
                        <span className="font-bold">
                          {st?.name || r.student_id.slice(0, 8)}:
                        </span>{' '}
                        {r.error}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {selectedBatchId && selectedCourseId && failedStudents.length > 0 && (
        <div>
          <label className={labelClassName}>
            4. Retake Teacher{' '}
            {previousInstructorNote && previousInstructorFetched && (
              <span className="ml-2 normal-case tracking-normal text-indigo-600 font-semibold text-xs">
                • {previousInstructorNote}
              </span>
            )}
          </label>
          <select
            value={selectedTeacherId}
            onChange={(event) => setSelectedTeacherId(event.target.value)}
            className={inputClassName}
          >
            <option value="">Select teacher</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          {selectedStudentIds.size > 0 ? (
            <span className="font-bold text-indigo-700">
              {selectedStudentIds.size} student{selectedStudentIds.size === 1 ? '' : 's'}{' '}
              selected
            </span>
          ) : (
            <span className="text-gray-400">No students selected</span>
          )}
          {selectedTeacher && (
            <span className="ml-3 text-gray-500">
              • Teacher: <span className="font-semibold">{selectedTeacher.name}</span>
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => setConfirmModalOpen(true)}
          className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Assigning...
            </span>
          ) : (
            <>Assign Retakes</>
          )}
        </button>
      </div>

      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h4 className="text-xl font-black text-gray-900">Confirm Retake Assignment</h4>
              <p className="mt-1 text-sm text-gray-500">
                Review the details before creating retake records.
              </p>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                  <div className="text-xs font-black uppercase tracking-wider text-gray-400">
                    Batch
                  </div>
                  <div className="mt-0.5 font-bold text-gray-800">
                    {selectedBatch?.name || '—'}
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                  <div className="text-xs font-black uppercase tracking-wider text-gray-400">
                    Subject
                  </div>
                  <div className="mt-0.5 font-bold text-gray-800">
                    {selectedCourse
                      ? selectedCourse.code
                        ? `${selectedCourse.code} - ${selectedCourse.name}`
                        : selectedCourse.name
                      : '—'}
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                  <div className="text-xs font-black uppercase tracking-wider text-gray-400">
                    Teacher
                  </div>
                  <div className="mt-0.5 font-bold text-gray-800">
                    {selectedTeacher?.name || 'Unassigned'}
                  </div>
                </div>
                <div className="rounded-xl bg-indigo-50 px-3 py-2.5">
                  <div className="text-xs font-black uppercase tracking-wider text-indigo-500">
                    Students
                  </div>
                  <div className="mt-0.5 font-black text-indigo-700">
                    {selectedStudentsForSummary.length}
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-black uppercase tracking-wider text-gray-400">
                  Selected students
                </div>
                <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-3">
                  {selectedStudentsForSummary.length === 0 ? (
                    <p className="text-xs text-gray-400">No students selected</p>
                  ) : (
                    selectedStudentsForSummary.map((s, idx) => (
                      <div
                        key={s.student_id}
                        className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-black text-white">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-gray-800">{s.name}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {s.registration_number || s.student_id.slice(0, 8)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                disabled={submitting}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAssign}
                disabled={submitting || selectedStudentsForSummary.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Confirm & Assign
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignRetakeForm;
