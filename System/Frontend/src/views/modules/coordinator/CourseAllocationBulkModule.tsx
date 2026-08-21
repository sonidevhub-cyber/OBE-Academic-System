import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, BookOpen, User, Calendar, CheckCircle, XCircle, ChevronRight, GraduationCap, Clock } from 'lucide-react';
import { coordinatorService } from '../../../api/coordinatorService';
import { useAllocations } from '../../../context/AllocationContext';
import { toast } from 'react-hot-toast';

const CourseAllocationBulkModule: React.FC = () => {
  const { fetchAllocations } = useAllocations();
  const [programs, setPrograms] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);

  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [selectedSemester, setSelectedSemester] = useState<any>(null);
  const [currentVersion, setCurrentVersion] = useState<any>(null);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const isSemesterReadOnly = ['RESULT_RECEIVED', 'FINALIZED'].includes(selectedSemester?.status);
  const canReassignInstructors = Boolean(selectedSemester?.permitted_actions?.can_reassign_instructors ?? true) && !isSemesterReadOnly;
  const canSaveAllocations = canReassignInstructors && courses.length > 0;

  const statusBadgeClass = (status?: string) => {
    switch (status) {
      case 'AWAITING_EXTERNAL_RESULT':
        return 'bg-amber-100 text-amber-800';
      case 'RESULT_RECEIVED':
        return 'bg-blue-100 text-blue-700';
      case 'FINALIZED':
        return 'bg-gray-200 text-gray-600';
      default:
        return 'bg-green-100 text-green-700';
    }
  };

  const formatStatus = (status?: string) => {
    if (!status) return 'ONGOING';
    return status.replace(/_/g, ' ');
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        console.log('Loading initial data for Course Allocation...');
        const [programsRes, instructorsRes] = await Promise.all([
          coordinatorService.getPrograms(),
          coordinatorService.getInstructors()
        ]);
        
        console.log('Programs Response:', programsRes.data);
        console.log('Instructors Response:', instructorsRes.data);
        
        // Handle different API response structures (direct list, wrapped in data, or paginated results)
        const getItems = (res: any) => {
          if (!res) return [];
          if (Array.isArray(res)) return res;
          if (res.data && Array.isArray(res.data)) return res.data;
          if (res.results && Array.isArray(res.results)) return res.results;
          return [];
        };

        const programsData = getItems(programsRes.data);
        const instructorsData = getItems(instructorsRes.data);
        
        console.log('Processed Programs:', programsData);
        console.log('Processed Instructors:', instructorsData);
        
        setPrograms(programsData);
        setInstructors(instructorsData);
      } catch (err) {
        console.error('Error loading initial data:', err);
        toast.error('Failed to load programs or instructors');
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedProgram) {
      const loadBatches = async () => {
        try {
          const res = await coordinatorService.getBatchesByProgram(selectedProgram);
          const batchesData = res.data?.data || res.data || [];
          setBatches(Array.isArray(batchesData) ? batchesData : []);
          setSelectedBatch(null);
          setSelectedSemester(null);
          setSemesters([]);
          setCourses([]);
          setAllocations({});
        } catch (err) {
          console.error('Error loading batches:', err);
          toast.error('Failed to load batches');
        }
      };
      loadBatches();
    } else {
      setBatches([]);
      setSelectedBatch(null);
      setSelectedSemester(null);
      setSemesters([]);
      setCourses([]);
    }
  }, [selectedProgram]);

  useEffect(() => {
    if (!selectedBatch?.id) {
      setSemesters([]);
      setSelectedSemester(null);
      return;
    }

    const loadSemesters = async () => {
      try {
        const res = await coordinatorService.getBatchSemesters(selectedBatch.id);
        const semesterRows = res.data?.semesters || [];
        setSemesters(semesterRows);
        const current = semesterRows.find((semester: any) => semester.is_current) || semesterRows[0] || null;
        setSelectedSemester(current);
      } catch (err) {
        console.error('Error loading semester selector:', err);
        toast.error('Failed to load semesters for this batch');
        setSemesters([]);
        setSelectedSemester(null);
      }
    };

    loadSemesters();
  }, [selectedBatch?.id]);

  const loadCourses = async () => {
    if (!selectedBatch || !selectedSemester) return;
    try {
      setLoading(true);
      console.log('Loading courses for batch:', selectedBatch.name, 'ID:', selectedBatch.id, 'Semester:', selectedSemester.number);

      const versionId = selectedBatch.curriculum_version_id;
      let version: any = null;

      if (versionId) {
        const detailRes = await coordinatorService.getVersion(versionId, selectedBatch.id);
        version = detailRes.data?.data || detailRes.data;
      } else {
        const versionRes = await coordinatorService.getCurriculumVersions({ batch: selectedBatch.id });
        const versions = versionRes.data?.data || versionRes.data || [];
        version =
          versions.find((item: any) => String(item.batch) === String(selectedBatch.id)) ||
          versions.find((item: any) =>
            Array.isArray(item.assigned_batches) &&
            item.assigned_batches.some((batch: any) => String(batch.id) === String(selectedBatch.id))
          ) ||
          (versions.length > 0 ? versions[0] : null);
      }

      if (!version) {
        setCourses([]);
        setCurrentVersion(null);
        toast.error('No curriculum version linked to this batch.');
        return;
      }

      const detailData = version;
      setCurrentVersion(detailData);
      console.log('Version details:', detailData);

      const semesterKey = `semester_${selectedSemester.number || selectedBatch.current_semester || 1}`;
      const semesterCourses = detailData.courses_by_semester?.[semesterKey] || [];

      const transformedCourses = semesterCourses.map((vc: any) => ({
        id: vc.course,
        code: vc.course_code,
        name: vc.course_name,
        course_type: vc.course_type || 'lecture',
        credit_hours: vc.credit_hours,
        allocation: vc.allocation,
      }));

      console.log("=== TRANSFORMED COURSES ===");
      console.log(transformedCourses);
      const initialAllocations: Record<string, string> = {};
      transformedCourses.forEach((course: any) => {
        console.log(`Course ${course.code} - Allocation:`, course.allocation);
        let teacherId: string | null = null;
        if (course.allocation?.teacher) {
          if (typeof course.allocation.teacher === 'object') {
            teacherId = String(course.allocation.teacher.id);
          } else {
            teacherId = String(course.allocation.teacher);
          }
        } else if (course.allocation?.teacher_id) {
          teacherId = String(course.allocation.teacher_id);
        }
        
        if (teacherId) {
          initialAllocations[course.id] = teacherId;
        }
      });
      console.log("=== INITIAL ALLOCATIONS ===");
      console.log(initialAllocations);
      setCourses(transformedCourses);
      setAllocations(initialAllocations);

    } catch (err) {
      console.error('Error loading courses for allocation:', err);
      toast.error('Failed to load courses for this batch.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, [selectedBatch, selectedSemester]);

  const handleInstructorChange = (courseId: string, instructorId: string) => {
    setAllocations(prev => ({
      ...prev,
      [courseId]: instructorId || ''
    }));
  };
  const handleSave = async () => {
    if (!selectedBatch) {
      toast.error('Please select a batch first');
      return;
    }

    if (!canSaveAllocations) {
      toast.error('This semester is read-only.');
      return;
    }

    // Filter valid allocations
    const allocationList = Object.entries(allocations)
      .filter(([_, teacherId]) => teacherId && teacherId !== '')
      .map(([courseId, teacherId]) => ({
        course: courseId,
        teacher: teacherId
      }));

    if (allocationList.length === 0) {
      toast.error('No valid allocations to save');
      return;
    }

    try {
      setSaving(true);
      
      // If version doesn't exist, we'll try to find it or create a placeholder if the backend supports it
      // But based on user input, we should probably ensure a version is linked.
      // For now, let's use the currentVersion if found, or fetch it again.
      let versionId = currentVersion?.id;
      
      if (!versionId) {
        // Fallback: Try to get/create a version for this batch
        const versionRes = await coordinatorService.getCurriculumVersions({ batch: selectedBatch.id });
        const versions = versionRes.data?.data || versionRes.data || [];
        const match =
          versions.find((item: any) => String(item.batch) === String(selectedBatch.id)) ||
          versions.find((item: any) =>
            Array.isArray(item.assigned_batches) &&
            item.assigned_batches.some((batch: any) => String(batch.id) === String(selectedBatch.id))
          );
        if (match) {
          versionId = match.id;
        } else {
          toast.error('No curriculum version found for this batch. Please create a version first.');
          setSaving(false);
          return;
        }
      }

      await coordinatorService.bulkAllocate({
        curriculum_version: versionId,
        batch: selectedBatch.id,
        allocations: allocationList
      });
      toast.success('Allocated successfully');
      await Promise.all([loadCourses(), fetchAllocations()]);
    } catch (err: any) {
      console.error('Error saving allocations:', err);
      toast.error(err.response?.data?.message || 'Failed to save allocations');
    } finally {
      setSaving(false);
    }
  };

  if (loading && programs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Programs</p>
              <p className="text-2xl font-bold text-gray-900">{programs.length}</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg">
              <GraduationCap className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Instructors</p>
              <p className="text-2xl font-bold text-gray-900">{instructors.length}</p>
            </div>
            <div className="p-2 bg-purple-50 rounded-lg">
              <User className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Courses (Batch)</p>
              <p className="text-2xl font-bold text-gray-900">{courses.length}</p>
            </div>
            <div className="p-2 bg-green-50 rounded-lg">
              <BookOpen className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Allocated</p>
              <p className="text-2xl font-bold text-gray-900">{Object.keys(allocations).length}</p>
            </div>
            <div className="p-2 bg-yellow-50 rounded-lg">
              <CheckCircle className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <GraduationCap className="h-4 w-4 inline mr-2 text-green-600" />
              Select Program
            </label>
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition-all"
            >
              <option value="">Choose a program...</option>
              {programs.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="h-4 w-4 inline mr-2 text-green-600" />
              Select Batch
            </label>
            <select
              value={selectedBatch?.id || ''}
              onChange={(e) => {
                const batch = batches.find(b => b.id === e.target.value);
                setSelectedBatch(batch);
              }}
              disabled={!selectedProgram}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
            >
              <option value="">Choose a batch...</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name} (Semester {b.current_semester})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="h-4 w-4 inline mr-2 text-green-600" />
              Select Semester
            </label>
            <select
              value={selectedSemester?.id || ''}
              onChange={(e) => {
                const semester = semesters.find(s => s.id === e.target.value);
                setSelectedSemester(semester || null);
              }}
              disabled={!selectedBatch}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
            >
              <option value="">Choose a semester...</option>
              {semesters.map(semester => (
                <option key={semester.id} value={semester.id}>
                  Semester {semester.number} - {formatStatus(semester.status)}
                </option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {selectedBatch && selectedSemester && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          {currentVersion?.status === 'draft' ? (
            <div className="p-12 text-center">
              <div className="mx-auto mb-6 flex items-center justify-center w-16 h-16 rounded-full bg-orange-100">
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Curriculum Version is in Draft</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Please finalize the curriculum version first before managing course allocations.
              </p>
            </div>
          ) : (
            <>
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Course Allocations</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-sm text-gray-500">Assign instructors to courses for {selectedBatch.name}</p>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusBadgeClass(selectedSemester.status)}`}>
                      {selectedSemester.status === 'FINALIZED' ? 'Locked - ' : ''}{formatStatus(selectedSemester.status)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving || Object.keys(allocations).length === 0 || !canSaveAllocations}
                  className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors shadow-sm"
                  title={!canSaveAllocations ? 'This semester is read-only.' : undefined}
                >
                  {saving ? (
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Save className="h-5 w-5 mr-2" />
                  )}
                  Save Allocations
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-sm font-medium">
                      <th className="px-6 py-4">Course Info</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Credits</th>
                      <th className="px-6 py-4">Instructor</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {courses.length > 0 ? (
                      courses.map((course) => (
                        <tr key={course.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="p-2 bg-green-50 rounded-lg mr-3">
                                <BookOpen className="h-5 w-5 text-green-600" />
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">{course.name}</div>
                                <div className="text-xs text-gray-500">{course.code}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              course.course_type === 'lab' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {course.course_type.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-600">{course.credit_hours} Cr.</td>
                          <td className="px-6 py-4">
                            <div className="relative">
                              <select
        value={allocations[course.id] || ''}
                                onChange={(e) => handleInstructorChange(course.id, e.target.value)}
                                disabled={!canReassignInstructors}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none appearance-none bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
                                title={!canReassignInstructors ? 'This semester is read-only.' : undefined}
                              >
                                <option value="">Select Instructor</option>
                            {instructors.map(inst => {
                              const instructorUserId =
                                typeof inst.user === 'string'
                                  ? inst.user
                                  : inst.user?.id || '';

                              return (
                              <option key={inst.id} value={instructorUserId}>
                                {inst.name}
                              </option>
                              );
                            })}
                              </select>
                              <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {allocations[course.id] ? (
                              <div className="flex items-center text-green-600 text-sm">
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Ready
                              </div>
                            ) : (
                              <div className="flex items-center text-gray-400 text-sm">
                                <Clock className="h-4 w-4 mr-1" />
                                Pending
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          <div className="flex flex-col items-center">
                            <BookOpen className="h-12 w-12 text-gray-200 mb-4" />
                            <p>No courses found for this semester.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </motion.div>
      )}

      {!selectedBatch && !loading && (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <ChevronRight className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Start Allocation</h3>
          <p className="text-gray-500 max-w-xs mx-auto mt-2">
            Select a program, batch, and semester above to manage course allocations.
          </p>
        </div>
      )}
    </div>
  );
};

export default CourseAllocationBulkModule;
