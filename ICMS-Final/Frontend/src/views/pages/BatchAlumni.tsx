import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Users, 
  ChevronRight,
  Home,
  Loader2,
  GraduationCap,
  Mail,
  Calendar,
  ArrowLeft
} from 'lucide-react';
import batchService, { Batch } from '../../api/batchService';
import academicStructureService, { Program } from '../../api/academicStructureService';
import { studentService } from '../../api/apiService';

interface Student {
  student_id: string;
  registration_number: string;
  custom_id?: string;
  name: string;
  user_email: string;
  enrollment_date: string;
  role: string;
}

const BatchAlumni: React.FC = () => {
  const { programId, batchId } = useParams<{ programId: string; batchId: string }>();
  
  const [program, setProgram] = useState<Program | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [alumni, setAlumni] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!programId || !batchId) return;
    setLoading(true);
    try {
      const [progRes, batchRes, alumniRes] = await Promise.all([
        academicStructureService.getProgramDetail(programId),
        batchService.getBatchById(programId, batchId),
        studentService.getAll({ batch: batchId, role: 'alumni' })
      ]);
      
      setProgram(progRes.data);
      setBatch(batchRes.data);
      
      setAlumni(alumniRes.data.results || alumniRes.data);
    } catch (err: any) {
      setError('Failed to load alumni data');
    } finally {
      setLoading(false);
    }
  }, [programId, batchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-gray-500 animate-pulse">Loading alumni records...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link to="/sac/programs" className="hover:text-indigo-600 flex items-center gap-1 transition-colors">
          <Home className="w-4 h-4" />
          <span>Programs</span>
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link to={`/sac/programs/${programId}/batches`} className="hover:text-indigo-600 transition-colors">
          {program?.name}
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="font-bold text-gray-900">{batch?.name}</span>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-400 font-medium">Alumni</span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-end border-b pb-6 border-gray-100">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-emerald-600" />
            <span>Alumni of {program?.name}-{batch?.name}</span>
          </h1>
          <p className="text-gray-500 mt-1">Total {alumni.length} alumni records found for this batch.</p>
        </div>
        <Link 
          to={`/sac/programs/${programId}/batches`}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Batches</span>
        </Link>
      </div>

      {/* Info Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 rounded-2xl">
            <Users className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Batch Name</p>
            <p className="text-lg font-bold text-gray-900">{batch?.name}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-2xl">
            <Calendar className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Graduated On</p>
            <p className="text-lg font-bold text-gray-900">
              {batch?.graduated_at ? new Date(batch.graduated_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-2xl">
            <GraduationCap className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Alumni</p>
            <p className="text-lg font-bold text-gray-900">{alumni.length}</p>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Current Semester</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {alumni.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-20 text-center text-gray-400 italic">
                  No alumni records found for this batch.
                </td>
              </tr>
            ) : (
              alumni.map(a => (
                <tr key={a.student_id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <span className="font-bold text-gray-900">{a.registration_number || a.custom_id || a.student_id}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="font-medium text-gray-900">{a.name}</span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-sm font-medium">{a.user_email || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200 uppercase tracking-wider">
                      Alumni
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BatchAlumni;
