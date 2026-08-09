import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  GraduationCap,
  Loader2,
  Search,
  Users,
  X
} from 'lucide-react';
import academicStructureService, { Program } from '../../api/academicStructureService';
import batchService, { Batch } from '../../api/batchService';
import { studentService } from '../../api/apiService';

interface BatchStudent {
  student_id: string;
  registration_number: string;
  custom_id?: string;
  name: string;
  user_email: string;
  phone: string;
  semester?: { name: string };
}

const AlumniTab: React.FC = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [alumniBatches, setAlumniBatches] = useState<Batch[]>([]);
  const [programLoading, setProgramLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  const [selectedBatchForAlumni, setSelectedBatchForAlumni] = useState<Batch | null>(null);
  const [batchStudents, setBatchStudents] = useState<BatchStudent[]>([]);
  const [batchStudentsLoading, setBatchStudentsLoading] = useState(false);
  const alumniBatchCacheRef = useRef<Record<string, Batch[]>>({});
  const alumniListCacheRef = useRef<Record<string, BatchStudent[]>>({});

  const fetchPrograms = useCallback(async () => {
    setProgramLoading(true);
    try {
      const res = await academicStructureService.getPrograms();
      const list = res.data || [];
      setPrograms(list);
      if (list.length > 0) {
        setSelectedProgram(list[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProgramLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  const fetchGraduatedBatches = useCallback(async () => {
    if (!selectedProgram) return;
    const programId = selectedProgram.id;
    if (alumniBatchCacheRef.current[programId]) {
      setAlumniBatches(alumniBatchCacheRef.current[programId]);
      return;
    }
    setLoading(true);
    try {
      const res = await batchService.getBatches(programId);
      const list: Batch[] = (res.data || []).filter((b: Batch) => b.status === 'graduated');
      alumniBatchCacheRef.current[programId] = list;
      setAlumniBatches(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedProgram?.id]);

  useEffect(() => {
    fetchGraduatedBatches();
  }, [fetchGraduatedBatches]);

  const fetchAlumniList = useCallback(async (batch: Batch) => {
    setSelectedBatchForAlumni(batch);
    if (alumniListCacheRef.current[batch.id]) {
      setBatchStudents(alumniListCacheRef.current[batch.id]);
      return;
    }
    setBatchStudentsLoading(true);
    try {
      const res = await studentService.getAllStudents({ batch: batch.id, role: 'alumni' } as any);
      const payload = res.data;
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.results)
          ? payload.results
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
      alumniListCacheRef.current[batch.id] = list;
      setBatchStudents(list);
    } catch (e) {
      console.error(e);
    } finally {
      setBatchStudentsLoading(false);
    }
  }, []);

  const totalAlumni = alumniBatches.reduce((acc, b) => acc + Number(b.student_count ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-50 via-white to-slate-50 rounded-[22px] border border-amber-100 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md shadow-amber-200">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                Alumni
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                  Graduated Batches
                </span>
              </h1>
              <p className="mt-1 text-sm text-gray-500 font-medium">
                View programs, graduated batches, and alumni records
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-5 py-3 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Alumni</p>
                <p className="text-xl font-black text-gray-900 tabular-nums">{totalAlumni}</p>
              </div>
            </div>
            <div className="px-5 py-3 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-50 text-slate-600">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Batches</p>
                <p className="text-xl font-black text-gray-900 tabular-nums">{alumniBatches.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Programs Sidebar */}
        <aside className="lg:w-80 shrink-0">
          <div className="bg-white rounded-[22px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-500" />
                Programs
              </h3>
              <p className="text-xs text-gray-400 mt-1 font-medium">
                {programs.length} available
              </p>
            </div>
            <div className="max-h-[70vh] overflow-y-auto custom-scrollbar p-2 space-y-1">
              {programLoading ? (
                <div className="p-8 flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <p className="text-xs font-bold text-gray-400">Loading programs...</p>
                </div>
              ) : programs.length === 0 ? (
                <div className="p-8 flex flex-col items-center text-center gap-2">
                  <BookOpen className="w-6 h-6 text-gray-300" />
                  <p className="text-xs font-bold text-gray-400">No programs yet</p>
                </div>
              ) : (
                programs.map(p => {
                  const countForProgram = alumniBatches.length;
                  const active = selectedProgram?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProgram(p)}
                      className={`w-full p-3 rounded-xl text-left transition-all flex items-center justify-between gap-3 group
                        ${active
                          ? 'bg-gradient-to-r from-indigo-50 to-white border border-indigo-200 shadow-sm'
                          : 'hover:bg-gray-50 border border-transparent'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg shrink-0 transition-colors
                          ${active ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className={`font-bold truncate ${active ? 'text-indigo-900' : 'text-gray-800'}`}>
                            {p.code}
                          </p>
                          <p className="text-[11px] font-medium text-gray-400 truncate">{p.name}</p>
                        </div>
                      </div>
                      <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0
                        ${active ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.total_semesters} sem
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* Alumni Batches Content */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-[22px] border border-gray-100 shadow-sm overflow-hidden min-h-[500px]">
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-white via-amber-50/20 to-white">
              {selectedProgram ? (
                <>
                  <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-amber-600" />
                    {selectedProgram.code} Alumni Records
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {alumniBatches.length} graduated batch{alumniBatches.length === 1 ? '' : 'es'}
                    {totalAlumni > 0 && <span className="mx-1.5">·</span>}
                    {totalAlumni > 0 && <span className="font-bold text-gray-700">{totalAlumni} total alumni</span>}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-black text-gray-900">Alumni Records</h2>
                  <p className="text-sm text-gray-500">Select a program to view its graduated batches</p>
                </>
              )}
            </div>
            <div className="p-0">
              {loading ? (
                <div className="py-24 flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <p className="text-sm font-bold text-gray-400">Loading alumni batches...</p>
                </div>
              ) : alumniBatches.length === 0 ? (
                <div className="py-24 flex flex-col items-center text-center gap-4 px-8">
                  <div className="p-4 rounded-3xl bg-amber-50">
                    <GraduationCap className="w-12 h-12 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-800">No graduated batches</h3>
                    <p className="text-sm text-gray-400 mt-1 max-w-md leading-relaxed">
                      Once batches complete their final semester and are graduated, they will appear here with their alumni records.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Batch Name</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Duration</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Graduated On</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Total Alumni</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {alumniBatches.map(b => (
                        <tr key={b.id} className="hover:bg-amber-50/30 transition-colors group">
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 border border-amber-200/50 shadow-sm">
                                <GraduationCap className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="font-black text-gray-900">{b.name}</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                    Graduated
                                  </span>
                                  {b.session_type && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                      {b.session_type}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center text-sm font-semibold text-gray-600">
                            {b.start_year} - {b.end_year}
                          </td>
                          <td className="px-6 py-5 text-center text-sm font-medium text-gray-500">
                            {b.graduated_at
                              ? new Date(b.graduated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                              : 'N/A'
                            }
                          </td>
                          <td className="px-6 py-5 text-center">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-900 text-white font-black shadow-sm">
                              <Users className="w-3 h-3" />
                              {b.student_count}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <button
                              onClick={() => fetchAlumniList(b)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-amber-500 hover:text-white hover:border-amber-500 hover:shadow-md hover:shadow-amber-200 transition-all text-xs font-bold"
                            >
                              <Search className="w-3.5 h-3.5" />
                              View Alumni
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Alumni List Modal */}
      <AnimatePresence>
        {selectedBatchForAlumni && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-3xl shadow-2xl border border-gray-100 flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-amber-50 via-white to-amber-50/40 shrink-0">
                <div>
                  <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-amber-600" />
                    Alumni of {selectedBatchForAlumni.name}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5 font-medium">
                    Total {batchStudents.length} graduate{batchStudents.length === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedBatchForAlumni(null)}
                  className="p-2 hover:bg-white hover:shadow-md rounded-full transition-all border border-gray-100"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                {batchStudentsLoading ? (
                  <div className="py-24 flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                    <p className="text-sm font-bold text-gray-400">Loading alumni list...</p>
                  </div>
                ) : batchStudents.length === 0 ? (
                  <div className="py-24 flex flex-col items-center gap-3 text-center px-8">
                    <Users className="w-10 h-10 text-gray-300" />
                    <p className="text-base font-black text-gray-600">No alumni records found</p>
                    <p className="text-sm text-gray-400 max-w-md">
                      Student records for this batch may be stored under a different role.
                    </p>
                  </div>
                ) : (
                  <div className="h-full overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ID</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {batchStudents.map(s => (
                          <tr key={s.student_id} className="hover:bg-amber-50/40 transition-colors">
                            <td className="px-6 py-4 text-sm font-black text-amber-700 tabular-nums">
                              {s.registration_number || s.custom_id || s.student_id}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-gray-900">
                              {s.name}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                              {s.user_email}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-100 to-amber-50 text-amber-800 border border-amber-200 text-[11px] font-black uppercase tracking-wider shadow-sm">
                                <GraduationCap className="w-3 h-3" />
                                Alumni
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="p-5 border-t border-gray-100 bg-gray-50/40 flex justify-end shrink-0">
                <button
                  onClick={() => setSelectedBatchForAlumni(null)}
                  className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-900 hover:text-white hover:border-gray-900 hover:shadow-md transition-all text-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AlumniTab;
