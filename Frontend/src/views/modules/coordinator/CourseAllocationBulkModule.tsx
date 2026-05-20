import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, BookOpen, User, Calendar, CheckCircle, XCircle, ChevronRight, GraduationCap, Clock } from 'lucide-react';
import { coordinatorService } from '../../../api/coordinatorService';
import { toast } from 'react-hot-toast';

const CourseAllocationBulkModule: React.FC = () => {
  const [programs, setPrograms] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);

  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [currentVersion, setCurrentVersion] = useState<any>(null);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
      setCourses([]);
    }
  }, [selectedProgram]);

  useEffect(() => {
    if (selectedBatch) {
      const loadCourses = async () => {
        try {
          setLoading(true);
          
          // Load curriculum version for this batch
          const versionRes = await coordinatorService.getCurriculumVersions({ batch: selectedBatch.id });
          const versions = versionRes.data?.data || versionRes.data || [];
          const version = versions.length > 0 ? versions[0] : null;
          setCurrentVersion(version);

          const res = await coordinatorService.getCoursesByBatch(selectedProgram, selectedBatch.current_semester);
          const courseList = res.data?.data || res.data || [];
          setCourses(Array.isArray(courseList) ? courseList : []);
          
          // Try to load existing allocations for this version
          let existingAllocations: any[] = [];
          if (version) {
            try {
              const existingAllocationsRes = await coordinatorService.getCourseAllocations({ version: version.id });
              existingAllocations = existingAllocationsRes.data?.data || existingAllocationsRes.data || [];
            } catch (err) {
              console.warn('Could not load existing allocations:', err);
            }
          }
          
          const initialAllocations: Record<string, string> = {};
          courseList.forEach((course: any) => {
            const existing = existingAllocations.find((a: any) => a.course === course.id);
            if (existing) {
              initialAllocations[course.id] = String(existing.teacher);
            }
          });
          setAllocations(initialAllocations);
        } catch (err) {
          console.error('Error loading courses:', err);
          toast.error('Failed to load courses');
        } finally {
          setLoading(false);
        }
      };
      loadCourses();
    } else {
      setCourses([]);
    }
  }, [selectedBatch, selectedProgram]);

  const handleInstructorChange = (courseId: string, instructorId: string) => {
    setAllocations(prev => ({
      ...prev,
      [courseId]: instructorId
    }));
  };

  const handleSave = async () => {
    if (!selectedBatch) {
      toast.error('Please select a batch first');
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
        if (versions.length > 0) {
          versionId = versions[0].id;
        } else {
          toast.error('No curriculum version found for this batch. Please create a version first.');
          setSaving(false);
          return;
        }
      }

      await coordinatorService.bulkAllocate({
        curriculum_version: versionId,
        allocations: allocationList
      });
      toast.success('Allocated successfully');
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </div>
      </div>

      {selectedBatch && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Course Allocations</h3>
              <p className="text-sm text-gray-500">Assign instructors to courses for {selectedBatch.name}</p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || Object.keys(allocations).length === 0}
              className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors shadow-sm"
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
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none appearance-none bg-white"
                          >
                            <option value="">Select Instructor</option>
                            {instructors.map(inst => (
                              <option key={inst.id} value={inst.user}>{inst.name}</option>
                            ))}
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
        </motion.div>
      )}

      {!selectedBatch && !loading && (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <ChevronRight className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Start Allocation</h3>
          <p className="text-gray-500 max-w-xs mx-auto mt-2">
            Select a program and batch above to manage course allocations for the current semester.
          </p>
        </div>
      )}
    </div>
  );
};

export default CourseAllocationBulkModule;
