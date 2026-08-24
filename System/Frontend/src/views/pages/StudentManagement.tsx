import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { studentService } from '../../api/apiService';
import batchService, { Batch } from '../../api/batchService';
import academicStructureService, { Program } from '../../api/academicStructureService';
import StudentModal from '../../components/ui/modals/StudentModal';
import EnhancedStudentProfile from '../../components/ui/EnhancedStudentProfile';
import { getFullImageUrl } from '../../utils/imageHelpers';
import { toast } from 'react-toastify';

// Custom scrollbar styling
const scrollbarStyle = `
  .custom-scrollbar {
    overflow: auto;
  }
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
`;

interface Department {
  id: number;
  name: string;
  code: string;
  description: string;
  department_id?: number;
  departmentId?: number;
  num_semesters?: number;
}

interface Student {
  student_id: string;
  custom_id?: string;
  registration_number?: string;
  id?: string;
  name: string;
  full_name?: string;
  email?: string;
  user_email?: string;
  phone?: string;
  role?: string;
  department?: Department | null;
  semester?: { semester_id: string; name: string; semester_code: string } | null;
  batch?: string;
  batch_id?: string;
  program_id?: string;
  batch_name?: string;
  program_name?: string;
  program_code?: string;
  father_guardian?: string;
  image?: string;
  attendance_percentage?: number;
  gpa?: number;
  performance_notes?: string;
  current_semester?: number;
  promotion_status?: string;
  is_frozen?: boolean;
  is_freezable?: boolean;
  frozen_at_semester?: number | null;
  frozen_date?: string | null;
  original_batch_id?: string | null;
  original_batch_name?: string | null;
}

interface FreezeBatchCandidate {
  id: string;
  batch_name?: string;
  name?: string;
  current_semester: number;
  program_id?: string;
}

interface StudentManagementProps {
  activeTab: string;
}

const StudentManagement: React.FC<StudentManagementProps> = ({ activeTab }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showStudentModal, setShowStudentModal] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showStudentProfile, setShowStudentProfile] = useState<boolean>(false);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [freezeTarget, setFreezeTarget] = useState<Student | null>(null);
  const [freezeSemester, setFreezeSemester] = useState<number | null>(null);
  const [unfreezeTarget, setUnfreezeTarget] = useState<Student | null>(null);
  const [unfreezeCandidates, setUnfreezeCandidates] = useState<FreezeBatchCandidate[]>([]);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  
  const [programs, setPrograms] = useState<Program[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  const fetchProgramsAndBatches = useCallback(async () => {
    try {
      const progRes = await academicStructureService.getPrograms();
      setPrograms(progRes.data);
      
      const batchRes = await batchService.getAllBatches();
      const batchList = (batchRes.data || []) as Batch[];
      setBatches(batchList);

      if (!selectedBatchId && batchList.length > 0) {
        const latestBatch = [...batchList].sort((a, b) => {
          const yearDiff = Number(b.start_year || 0) - Number(a.start_year || 0);
          if (yearDiff !== 0) return yearDiff;
          return String(b.name || '').localeCompare(String(a.name || ''));
        })[0];

        setSelectedProgramId(latestBatch.program_id || (latestBatch.program?.id ? String(latestBatch.program.id) : null));
        setSelectedBatchId(latestBatch.id);
      }
    } catch (err) {
      console.error('Failed to fetch programs/batches', err);
    }
  }, [selectedBatchId]);

  const fetchStudents = useCallback(async (page: number = 1) => {
    if (!selectedBatchId) {
      setStudents([]);
      setTotalPages(1);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const filters: any = { page, page_size: 100, batch: selectedBatchId, role: 'student' };
      if (searchTerm) filters.search = searchTerm;
      
      const response = await studentService.getAllStudents(filters);
      
      // Handle paginated response or regular array
      if (response.data && response.data.results) {
        setStudents(response.data.results);
        // Check if DRF provides num_pages or total_pages
        setTotalPages(response.data.total_pages || response.data.num_pages || 1);
        setTotalCount(response.data.count || 0);
      } else if (Array.isArray(response.data)) {
        setStudents(response.data);
        setTotalPages(1);
        setTotalCount(response.data.length);
      } else {
        setStudents([]);
        setTotalPages(1);
        setTotalCount(0);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to fetch students');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedBatchId, searchTerm]);

  useEffect(() => {
    if (activeTab === 'students') {
      fetchProgramsAndBatches();
    }
  }, [activeTab, fetchProgramsAndBatches]);

  useEffect(() => {
    if (activeTab === 'students') {
      fetchStudents(currentPage);
    }
  }, [activeTab, currentPage, fetchStudents]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedBatchId, searchTerm]);

  const handleDeleteStudent = useCallback(async (id: string | number) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      try {
        await studentService.deleteStudent(id);
        setStudents(prev => prev.filter(student => String(student.student_id) !== String(id)));
      } catch (error: any) {
        setError(error.message || 'Failed to delete student');
      }
    }
  }, []);

  const filteredBatches = useMemo(() => {
    return batches
      .filter(b => !selectedProgramId || b.program_id === selectedProgramId || String((b as any).program?.id || '') === selectedProgramId)
      .sort((a, b) => {
        const yearDiff = Number(b.start_year || 0) - Number(a.start_year || 0);
        if (yearDiff !== 0) return yearDiff;
        return String(b.name || '').localeCompare(String(a.name || ''));
      });
  }, [batches, selectedProgramId]);

  const selectedBatch = useMemo(
    () => batches.find(b => b.id === selectedBatchId) || null,
    [batches, selectedBatchId]
  );

  const formatFreezeDate = useCallback((value?: string | null) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString();
  }, []);

  const openFreezeDialog = useCallback((student: Student) => {
    const currentSemester = student.current_semester || selectedBatch?.current_semester || null;
    setFreezeTarget(student);
    setFreezeSemester(currentSemester);
  }, [selectedBatch]);

  const handleFreezeStudent = useCallback(async () => {
    if (!freezeTarget || !freezeSemester) return;
    setActionLoading(true);
    try {
      const res = await studentService.freezeStudent(freezeTarget.student_id, freezeSemester);
      toast.success(res.data?.message || 'Student frozen successfully');
      setFreezeTarget(null);
      setFreezeSemester(null);
      fetchStudents(currentPage);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to freeze student');
    } finally {
      setActionLoading(false);
    }
  }, [currentPage, fetchStudents, freezeSemester, freezeTarget]);

  const handleUnfreezeStudent = useCallback(async (student: Student, targetBatchId?: string) => {
    setActionLoading(true);
    try {
      const res = await studentService.unfreezeStudent(student.student_id, targetBatchId);
      const assignedName = res.data?.assigned_batch?.batch_name || res.data?.assigned_batch?.name;
      toast.success(res.data?.message || `Student rejoined${assignedName ? ` ${assignedName}` : ''}`);
      setUnfreezeTarget(null);
      setUnfreezeCandidates([]);
      fetchStudents(currentPage);
      fetchProgramsAndBatches();
    } catch (err: any) {
      const data = err.response?.data || {};
      const candidates = data.candidate_batches || data.active_batches || [];
      if ((err.response?.status === 409 || candidates.length > 0) && candidates.length > 0) {
        setUnfreezeTarget(student);
        setUnfreezeCandidates(candidates);
      } else {
        toast.error(data.error || 'Failed to unfreeze student');
      }
    } finally {
      setActionLoading(false);
    }
  }, [currentPage, fetchProgramsAndBatches, fetchStudents]);

  const filteredStudents = useMemo(() => {
    if (!selectedBatchId || !Array.isArray(students)) return [];
    
    // Only show active students (not alumni) in the Student Management tab
    let filtered = students.filter(student => student.role === 'student' || !student.role);
    
    if (selectedProgramId) {
      filtered = filtered.filter(student => !student.program_id || String(student.program_id) === String(selectedProgramId));
    }

    if (selectedBatchId) {
      filtered = filtered.filter(student => !student.batch_id || String(student.batch_id) === String(selectedBatchId));
    }
    
    if (searchTerm) {
      filtered = filtered.filter(student =>
        (student.name || student.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.registration_number?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (student.custom_id?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (student.email?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (student.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (student.semester?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
      );
    }
    
    return filtered;
  }, [students, searchTerm, selectedProgramId, selectedBatchId]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyle }} />
      <div className="min-h-screen w-full bg-[#E8EFF8] p-4 md:p-6 custom-scrollbar">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 space-y-4 lg:space-y-0">
        <h2 className="text-2xl font-bold text-gray-800">Student Management</h2>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          <input
            type="text"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
          />
          <select
            value={selectedProgramId || ''}
            onChange={(e) => {
              const nextProgramId = e.target.value || null;
              setSelectedProgramId(nextProgramId);
              const nextBatch = [...batches]
                .filter(b => !nextProgramId || b.program_id === nextProgramId || String((b as any).program?.id || '') === nextProgramId)
                .sort((a, b) => Number(b.start_year || 0) - Number(a.start_year || 0))[0];
              setSelectedBatchId(nextBatch?.id || null);
            }}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Programs</option>
            {programs.map(p => (
              <option key={p.id} value={p.id}>{p.code}</option>
            ))}
          </select>
          <select
            value={selectedBatchId || ''}
            onChange={(e) => setSelectedBatchId(e.target.value || null)}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select Batch</option>
            {filteredBatches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}{b.session_type ? ` (${b.session_type})` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setEditingStudent(null);
              setShowStudentModal(true);
            }}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 whitespace-nowrap"
          >
            Add Student
          </button>
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-xl shadow-lg border border-indigo-200 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
            <p className="text-sm font-medium text-indigo-600 mb-1">Total Students</p>
            <p className="text-3xl font-bold text-indigo-900">{totalCount}</p>
          </div>
            <div className="p-3 bg-indigo-500 rounded-full shadow-lg">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a.5.5 0 00-.5-.5h-11a.5.5 0 00-.5.5v3h12z"/>
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl shadow-lg border border-purple-200 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600 mb-1">
                {selectedBatch ? `Batch: ${selectedBatch.name}` : 'Selected Batch'}
              </p>
              <p className="text-3xl font-bold text-purple-900">{filteredStudents.length}</p>
            </div>
            <div className="p-3 bg-purple-500 rounded-full shadow-lg">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
              </svg>
            </div>
          </div>
        </div>
        
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">
            {selectedBatch ? `${selectedBatch.name} Students` : 'Select a batch to view students'}
          </h3>
        </div>

        {!selectedBatchId ? (
          <div className="text-center py-16 px-6">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
              <svg className="h-7 w-7 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14M5 19h14a2 2 0 002-2v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-800 font-semibold">Please select a batch first</p>
            <p className="text-sm text-gray-500 mt-1">Students are shown only for the selected batch.</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Batch</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Performance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStudents.map((student) => (
                  <tr key={student.student_id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {student.image ? (
                            <img className="h-10 w-10 rounded-full object-cover" src={getFullImageUrl(student.image)} alt={student.name || student.full_name || 'Student'} />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center">
                              <span className="text-white font-medium text-sm">{(student.name || student.full_name || 'S').charAt(0)}</span>
                            </div>
                          )}
                        </div>
                        <div className="ml-4 min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 truncate">{student.name || student.full_name}</div>
                          <div className="text-sm text-gray-500 truncate">ID: {student.registration_number || student.custom_id || student.student_id}</div>
                          {student.is_frozen && (
                            <div className="mt-1 inline-flex w-fit items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                              Frozen - Sem {student.frozen_at_semester || student.current_semester || 'N/A'}
                              {student.frozen_date ? ` (since ${formatFreezeDate(student.frozen_date)})` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800`}>
                        {student.role || 'student'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <div className="truncate">
                        {(student.role === 'student' || student.role === 'alumni' || !student.role) 
                          ? (student.batch_name || student.batch || '-') 
                          : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900 truncate">{student.user_email || student.email}</div>
                      <div className="text-sm text-gray-500 truncate">{student.phone}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">Semester: {student.current_semester || selectedBatch?.current_semester || 'N/A'}</div>
                      <div className="text-sm text-gray-500">Status: {student.promotion_status || 'Active'}</div>
                      {student.is_frozen && student.original_batch_name && (
                        <div className="text-xs text-sky-600">Original: {student.original_batch_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => {
                            setViewingStudent(student);
                            setShowStudentProfile(true);
                          }}
                          className="inline-flex items-center px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-md hover:bg-emerald-100 transition-colors duration-200 border border-emerald-200"
                          title="View student profile"
                        >
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span className="text-xs font-medium">Profile</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditingStudent(student);
                            setShowStudentModal(true);
                          }}
                          className="inline-flex items-center px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors duration-200 border border-blue-200"
                          title="Edit student details"
                        >
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span className="text-xs font-medium">Edit</span>
                        </button>
                        {student.is_frozen ? (
                          <button
                            onClick={() => handleUnfreezeStudent(student)}
                            disabled={actionLoading}
                            className="inline-flex items-center px-2.5 py-1.5 bg-sky-50 text-sky-700 rounded-md hover:bg-sky-100 transition-colors duration-200 border border-sky-200 disabled:opacity-50"
                            title="Unfreeze and assign this student to a matching active batch"
                          >
                            <span className="text-xs font-medium">Unfreeze / Rejoin</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => openFreezeDialog(student)}
                            disabled={!student.is_freezable || actionLoading}
                            className="inline-flex items-center px-2.5 py-1.5 bg-cyan-50 text-cyan-700 rounded-md hover:bg-cyan-100 transition-colors duration-200 border border-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                            title={student.is_freezable ? 'Freeze student' : 'Final marks not yet submitted for this semester - freeze unavailable until then.'}
                          >
                            <span className="text-xs font-medium">Freeze</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteStudent(student.student_id)}
                          className="inline-flex items-center px-2.5 py-1.5 bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-colors duration-200 border border-red-200"
                          title="Remove student"
                        >
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span className="text-xs font-medium">Remove</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {((currentPage - 1) * 100) + 1} to {Math.min(currentPage * 100, totalCount)} of {totalCount} students
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Show first page, last page, and around current page
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        pageNum === currentPage
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {selectedBatchId && filteredStudents.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">No students found</p>
          </div>
        )}
      </div>

      {showStudentModal && (
        <StudentModal
          isOpen={showStudentModal}
          studentId={editingStudent ? editingStudent.student_id : undefined}
          onClose={() => {
            setShowStudentModal(false);
            setEditingStudent(null);
          }}
          onSuccess={() => {
            fetchStudents();
          }}
        />
      )}

      {freezeTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Freeze Student</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Move <span className="font-semibold text-gray-900">{freezeTarget.name || freezeTarget.full_name}</span> into frozen status.
              </p>
              <div className="space-y-2">
                {[freezeTarget.current_semester || selectedBatch?.current_semester, (freezeTarget.current_semester || selectedBatch?.current_semester || 0) - 1]
                  .filter((value, index, values): value is number => Boolean(value && value > 0 && values.indexOf(value) === index))
                  .map(semester => (
                    <label key={semester} className="flex items-center gap-3 rounded-md border border-gray-200 p-3 text-sm text-gray-700">
                      <input
                        type="radio"
                        name="freeze_semester"
                        checked={freezeSemester === semester}
                        onChange={() => setFreezeSemester(semester)}
                        className="h-4 w-4 text-cyan-600 focus:ring-cyan-500"
                      />
                      <span>Freeze at Semester {semester}</span>
                    </label>
                  ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setFreezeTarget(null);
                  setFreezeSemester(null);
                }}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleFreezeStudent}
                disabled={!freezeSemester || actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-md hover:bg-cyan-700 disabled:opacity-50"
              >
                Freeze
              </button>
            </div>
          </div>
        </div>
      )}

      {unfreezeTarget && unfreezeCandidates.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Choose Rejoin Batch</h3>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-600">
                Select the active batch for <span className="font-semibold text-gray-900">{unfreezeTarget.name || unfreezeTarget.full_name}</span>.
              </p>
              {unfreezeCandidates.map(batch => (
                <button
                  key={batch.id}
                  onClick={() => handleUnfreezeStudent(unfreezeTarget, batch.id)}
                  disabled={actionLoading}
                  className="w-full rounded-md border border-gray-200 px-4 py-3 text-left hover:border-sky-300 hover:bg-sky-50 disabled:opacity-50"
                >
                  <div className="text-sm font-semibold text-gray-900">{batch.batch_name || batch.name}</div>
                  <div className="text-xs text-gray-500">Semester {batch.current_semester}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setUnfreezeTarget(null);
                  setUnfreezeCandidates([]);
                }}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showStudentProfile && viewingStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg max-w-7xl w-full max-h-[95vh] overflow-y-auto">
            {viewingStudent && (
                    <EnhancedStudentProfile 
                      studentId={viewingStudent.student_id} 
                      onClose={() => {
                        setShowStudentProfile(false);
                        setViewingStudent(null);
                      }}
                    />
                  )}
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default React.memo(StudentManagement);
