import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { api } from '../../api/api';
import { curriculumService } from '../../api/curriculumService';
import { useAuth } from '../../context/AuthContext';
import { createRetake } from './retakeApi';
import type {
  BatchOption,
  CreateRetakePayload,
  CourseOption,
  StudentOption,
  TeacherOption,
} from './types';

type FormState = CreateRetakePayload;

const inputClassName =
  'w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all';

const normalizeList = (payload: any) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const parseSemesterNo = (course: any): number | undefined => {
  const semester = course?.semester_no ?? course?.semester_number ?? course?.semester ?? course?.semesterId ?? course?.semester_id;
  const parsed = Number(semester);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const AssignRetakeForm: React.FC<{ onCreated?: () => void }> = ({ onCreated }) => {
  const { currentUser, loading: authLoading } = useAuth();
  const role = currentUser?.effective_role || currentUser?.active_role || currentUser?.role;
  const canAssign = role === 'SAC';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [form, setForm] = useState<FormState>({
    student: '',
    failed_course: '',
    failed_batch: '',
    current_batch: '',
    retake_teacher: '',
  });

  // Load batches and teachers initially
  useEffect(() => {
    const loadInitialOptions = async () => {
      try {
        const [batchRes, teacherRes] = await Promise.all([
          api.get('batches/all/'),
          api.get('instructors/'),
        ]);

        console.log("==== AssignRetakeForm INITIAL DATA ====");
        console.log("batchRes.data (raw):", batchRes.data);
        console.log("================================");
        const batchRows = normalizeList(batchRes.data);
        const teacherRows = normalizeList(teacherRes.data);

        console.log("AssignRetakeForm: batchRows:", batchRows);
        console.log("AssignRetakeForm: teacherRows:", teacherRows);

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
              return teacherRole === 'instructor' || teacherRole === 'tvf' || teacherRole === 'Teacher';
            })
            .map((teacher: any) => ({
              id: String(teacher.user || teacher.id),
              name: teacher.name || teacher.user_name || teacher.user?.full_name || 'Teacher',
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

  // Load students when selectedBatchId changes
  useEffect(() => {
    if (!selectedBatchId) {
      setStudents([]);
      return;
    }

    const loadStudentsForBatch = async () => {
      try {
        const studentRes = await api.get('students/', { 
          params: { 
            role: 'student', 
            page_size: 200,
            batch: selectedBatchId // Filter by selected batch
          } 
        });

        console.log("==== AssignRetakeForm STUDENTS FOR BATCH ====");
        console.log("studentRes.data (raw):", studentRes.data);
        console.log("================================");
        const studentRows = normalizeList(studentRes.data);

        console.log("AssignRetakeForm: studentRows for batch:", studentRows);

        setStudents(
          studentRows.map((student: any) => ({
            id: String(student.student_id || student.id),
            name: student.name || student.full_name || 'Unnamed Student',
            registration_number: student.registration_number,
            batch_id: student.batch_id || student.user?.batch?.id || student.batch, // Also check student.batch!
            batch_name: student.batch_name || student.user?.batch?.name || student.batch?.name,
          }))
        );
      } catch (error) {
        console.error('Failed to load students for batch', error);
        toast.error('Failed to load students');
      }
    };

    loadStudentsForBatch();
  }, [selectedBatchId]);

  const selectedBatch = useMemo(
    () => batches.find((batch) => String(batch.id) === selectedBatchId) || null,
    [batches, selectedBatchId]
  );

  const filteredStudents = useMemo(() => {
    console.log("AssignRetakeForm: selectedBatchId:", selectedBatchId);
    console.log("AssignRetakeForm: selectedBatch:", selectedBatch);
    console.log("AssignRetakeForm: all batches:", batches);
    console.log("AssignRetakeForm: students:", students);

    if (!selectedBatchId) return [];

    const query = studentSearch.trim().toLowerCase();
    const batchStudents = students.filter((student) => {
      const studentBatchId = String(student.batch_id || '');
      const matches = studentBatchId === selectedBatchId;
      console.log(`  Checking student: ${student.name}, studentBatchId: ${studentBatchId}, matches: ${matches}`);
      return matches;
    });
    console.log("AssignRetakeForm: batchStudents:", batchStudents);

    if (!query) return batchStudents;

    const filtered = batchStudents.filter((student) => {
      return (
        student.name.toLowerCase().includes(query) ||
        student.registration_number?.toLowerCase().includes(query) ||
        student.batch_name?.toLowerCase().includes(query)
      );
    });
    console.log("AssignRetakeForm: filtered after search:", filtered);
    return filtered;
  }, [selectedBatchId, selectedBatch, batches, studentSearch, students]);

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
          const versionResponse = await curriculumService.getVersion(Number(selectedBatch.curriculum_version_id));
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
          const response = await api.get('courses/', { params: { batch_id: selectedBatchId } });
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
            ? courseRows.filter((course) => typeof course.semester_no !== 'number' || course.semester_no < currentSemester)
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

  const handleStudentChange = (studentId: string) => {
    setForm((prev) => ({
      ...prev,
      student: studentId,
      failed_course: '',
    }));
  };

  const handleBatchChange = (batchId: string) => {
    setSelectedBatchId(batchId);
    setStudentSearch('');
    setCourses([]);
    setForm((prev) => ({
      ...prev,
      current_batch: batchId,
      failed_batch: batchId,
      student: '',
      failed_course: '',
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.student || !form.failed_course || !selectedBatchId) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateRetakePayload = {
        student: form.student,
        failed_course: form.failed_course,
        failed_batch: selectedBatchId,
        current_batch: selectedBatchId,
        retake_teacher: form.retake_teacher || null,
      };

      const created = await createRetake(payload);
      toast.success(
        `Retake assigned successfully${created.attempt_number ? ` (Attempt #${created.attempt_number})` : ''}`
      );
      setForm({
        student: '',
        failed_course: '',
        failed_batch: '',
        current_batch: '',
        retake_teacher: '',
      });
      setSelectedBatchId('');
      setStudentSearch('');
      setCourses([]);
      onCreated?.();
    } catch (error: any) {
      console.error('Failed to create retake', error);
      toast.error(error?.response?.data?.detail || error?.response?.data?.error || 'Failed to assign retake');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500">
        Loading auth state...
      </div>
    );
  }

  if (!canAssign) {
    // TODO: verify this matches the existing ProtectedRoute pattern used elsewhere in the project.
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
  const hasRetakeEligibleSemester = !selectedBatch?.current_semester || currentSemester > 1;

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div>
        <h3 className="text-2xl font-black text-gray-900">Assign Course Retake</h3>
        <p className="mt-1 text-sm font-medium text-gray-500">
          Pick the batch first, then choose a student and select the course manually.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-400">Batch</label>
        <select
          value={selectedBatchId}
          onChange={(event) => handleBatchChange(event.target.value)}
          className={inputClassName}
        >
          <option value="">Select batch</option>
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.name}
              {typeof batch.current_semester === 'number' ? ` - Semester ${batch.current_semester}` : ''}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs font-medium text-gray-400">
          This batch is used for both batch fields in the retake payload.
          {selectedBatch?.current_semester ? ` Current semester: ${selectedBatch.current_semester}.` : ''}
        </p>
        {selectedBatch?.current_semester && selectedBatch.current_semester > 1 && (
          <p className="mt-1 text-xs font-medium text-indigo-500">
            Retake-eligible courses are limited to semesters 1 to {selectedBatch.current_semester - 1}.
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-400">Search Student</label>
        <input
          type="text"
          value={studentSearch}
          onChange={(event) => setStudentSearch(event.target.value)}
          placeholder={selectedBatchId ? 'Search by name or registration number' : 'Select a batch first'}
          disabled={!selectedBatchId}
          className={inputClassName}
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-400">Student</label>
        <select
          value={form.student}
          onChange={(event) => handleStudentChange(event.target.value)}
          disabled={!selectedBatchId}
          className={inputClassName}
        >
          <option value="">{selectedBatchId ? 'Select student' : 'Select batch first'}</option>
          {filteredStudents.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}
              {student.registration_number ? ` (${student.registration_number})` : ''}
            </option>
          ))}
        </select>
        {!selectedBatchId ? (
          <p className="mt-2 text-xs font-medium text-gray-400">Choose a batch to load students.</p>
        ) : (
          <p className="mt-2 text-xs font-medium text-gray-400">
            {filteredStudents.length} student{filteredStudents.length === 1 ? '' : 's'} available in this batch.
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-400">Course</label>
        <select
          value={form.failed_course}
          onChange={(event) => setForm((prev) => ({ ...prev, failed_course: event.target.value }))}
          disabled={!selectedBatchId || coursesLoading || !hasRetakeEligibleSemester}
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
              {typeof course.semester_no === 'number' ? ` (Sem ${course.semester_no})` : ''}
            </option>
          ))}
        </select>
        {selectedBatchId && !coursesLoading && selectedBatch?.current_semester === 1 && (
          <p className="mt-2 text-xs font-medium text-amber-600">
            Retake is not available for Semester 1 batches.
          </p>
        )}
        {selectedBatchId && !coursesLoading && hasRetakeEligibleSemester && eligibleCourses.length === 0 && (
          <p className="mt-2 text-xs font-medium text-amber-600">
            No retake-eligible courses were found for the selected batch.
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-400">Retake Teacher</label>
          <select
            value={form.retake_teacher || ''}
            onChange={(event) => setForm((prev) => ({ ...prev, retake_teacher: event.target.value }))}
            className={inputClassName}
          >
            <option value="">Unassigned</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-xs font-medium text-gray-500">
            Batch is synced internally as both current batch and failed batch.
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || !selectedBatchId}
          className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? 'Assigning...' : 'Assign Retake'}
        </button>
      </div>
    </form>
  );
};

export default AssignRetakeForm;
