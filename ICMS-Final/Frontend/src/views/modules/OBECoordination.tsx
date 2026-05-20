import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  Settings, 
  Layers, 
  Target, 
  Award, 
  Copy, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  LayoutGrid
} from 'lucide-react';
import { obeService, PEO, GA, GAPEOMapping, CLO, CLOGAMapping } from '../../api/obeService';
import academicStructureService, { Program, Course, Semester } from '../../api/academicStructureService';
import batchService, { Batch } from '../../api/batchService';
import { toast } from 'react-toastify';

const OBECoordination: React.FC = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  
  const [activeSubTab, setActiveSubTab] = useState<'peo_ga' | 'curriculum' | 'clo'>('peo_ga');
  const [loading, setLoading] = useState(false);

  // PEO/GA States
  const [peos, setPeos] = useState<PEO[]>([]);
  const [gas, setGas] = useState<GA[]>([]);
  const [gaPeoMappings, setGaPeoMappings] = useState<GAPEOMapping[]>([]);
  const [isEditingMatrix, setIsEditingMatrix] = useState(false);

  // CLO States
  const [clos, setClos] = useState<CLO[]>([]);
  const [cloGaMappings, setCloGaMappings] = useState<CLOGAMapping[]>([]);
  const [showCLOModal, setShowCLOModal] = useState(false);
  const [editingCLO, setEditingCLO] = useState<CLO | null>(null);

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      const res = await academicStructureService.getPrograms();
      setPrograms(res.data);
      if (res.data.length > 0) setSelectedProgram(res.data[0]);
    } catch (error) {
      toast.error('Failed to load programs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProgram) {
      fetchProgramData();
    }
  }, [selectedProgram]);

  const fetchProgramData = async () => {
    if (!selectedProgram) return;
    try {
      setLoading(true);
      const [batchesRes, peosRes, gasRes, matrixRes] = await Promise.all([
        batchService.getBatches(selectedProgram.id),
        obeService.getPEOs(selectedProgram.id),
        obeService.getGAs(selectedProgram.id),
        obeService.getGAPEOMatrix(selectedProgram.id)
      ]);
      setBatches(batchesRes.data);
      setPeos(peosRes.data);
      setGas(gasRes.data);
      setGaPeoMappings(matrixRes.data.mappings);
      if (batchesRes.data.length > 0) setSelectedBatch(batchesRes.data[0]);
    } catch (error) {
      toast.error('Failed to load program data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBatch) {
      fetchBatchData();
    }
  }, [selectedBatch]);

  const fetchBatchData = async () => {
    if (!selectedBatch) return;
    try {
      const res = await academicStructureService.getCourses(selectedBatch.program);
      setCourses(res.data);
      if (res.data.length > 0) setSelectedCourse(res.data[0]);
    } catch (error) {
      toast.error('Failed to load courses');
    }
  };

  useEffect(() => {
    if (selectedCourse && selectedBatch) {
      fetchCLOData();
    }
  }, [selectedCourse, selectedBatch]);

  const fetchCLOData = async () => {
    if (!selectedCourse || !selectedBatch) return;
    try {
      const [closRes, matrixRes] = await Promise.all([
        obeService.getCLOs(selectedCourse.id, selectedBatch.id),
        obeService.getCLOGAMatrix(selectedCourse.id, selectedBatch.id)
      ]);
      setClos(closRes.data);
      setCloGaMappings(matrixRes.data.mappings);
    } catch (error) {
      console.error('Failed to load CLO data');
    }
  };

  const handleToggleMapping = (gaId: string, peoId: string) => {
    const exists = gaPeoMappings.some(m => m.ga === gaId && m.peo === peoId);
    if (exists) {
      setGaPeoMappings(gaPeoMappings.filter(m => !(m.ga === gaId && m.peo === peoId)));
    } else {
      setGaPeoMappings([...gaPeoMappings, { ga: gaId, peo: peoId } as GAPEOMapping]);
    }
  };

  const saveMatrix = async () => {
    if (!selectedProgram) return;
    try {
      const mappings = gaPeoMappings.map(m => ({ ga_id: m.ga, peo_id: m.peo }));
      await obeService.saveGAPEOMatrix(selectedProgram.id, mappings);
      toast.success('GA-PEO Matrix saved successfully');
      setIsEditingMatrix(false);
    } catch (error) {
      toast.error('Failed to save matrix');
    }
  };

  return (
    <div className="space-y-6">
      {/* Program & Batch Selector */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Program</label>
            <div className="relative">
              <select 
                value={selectedProgram?.id || ''} 
                onChange={(e) => setSelectedProgram(programs.find(p => p.id === e.target.value) || null)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 font-semibold text-gray-700 appearance-none"
              >
                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <BookOpen className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            </div>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Batch</label>
            <div className="relative">
              <select 
                value={selectedBatch?.id || ''} 
                onChange={(e) => setSelectedBatch(batches.find(b => b.id === e.target.value) || null)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 font-semibold text-gray-700 appearance-none"
              >
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <Layers className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            </div>
          </div>

          <div className="flex items-end pt-6">
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button 
                onClick={() => setActiveSubTab('peo_ga')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'peo_ga' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >PEO & GA</button>
              <button 
                onClick={() => setActiveSubTab('clo')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'clo' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >CLO Mapping</button>
              <button 
                onClick={() => setActiveSubTab('curriculum')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'curriculum' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >Curriculum</button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'peo_ga' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* GA-PEO Matrix */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-green-50 to-transparent">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <LayoutGrid className="w-5 h-5 text-green-600" />
                    GA-PEO Mapping Matrix
                  </h3>
                  <p className="text-sm text-gray-500">Map Graduate Attributes to Program Educational Objectives</p>
                </div>
                {!isEditingMatrix ? (
                  <button 
                    onClick={() => setIsEditingMatrix(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 font-bold transition-all"
                  >
                    <Edit2 className="w-4 h-4" /> Edit Matrix
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setIsEditingMatrix(false)} className="px-4 py-2 text-gray-500 font-bold">Cancel</button>
                    <button onClick={saveMatrix} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 font-bold transition-all shadow-lg shadow-green-100">
                      <Save className="w-4 h-4" /> Save Changes
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="p-4 bg-gray-50 border border-gray-100 text-left min-w-[200px]">
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Graduate Attributes</span>
                      </th>
                      {peos.map(peo => (
                        <th key={peo.id} className="p-4 bg-gray-50 border border-gray-100 text-center min-w-[120px]">
                          <div className="group relative">
                            <span className="text-sm font-bold text-gray-700 cursor-help underline decoration-dotted decoration-gray-300">PEO-{peo.order_number}</span>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                              {peo.title}
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gas.map(ga => (
                      <tr key={ga.id} className="hover:bg-gray-50/50">
                        <td className="p-4 border border-gray-100">
                          <div className="flex items-start gap-3">
                            <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-1.5 py-0.5 rounded mt-1">GA-{ga.order_number}</span>
                            <span className="text-sm font-semibold text-gray-600 leading-tight">{ga.title}</span>
                          </div>
                        </td>
                        {peos.map(peo => {
                          const isMapped = gaPeoMappings.some(m => m.ga === ga.id && m.peo === peo.id);
                          return (
                            <td key={peo.id} className="p-4 border border-gray-100 text-center">
                              <button
                                disabled={!isEditingMatrix}
                                onClick={() => handleToggleMapping(ga.id, peo.id)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-all ${
                                  isMapped 
                                    ? 'bg-green-100 text-green-600 scale-110 shadow-sm' 
                                    : 'bg-gray-50 text-gray-200 hover:bg-gray-100'
                                } ${isEditingMatrix ? 'cursor-pointer' : 'cursor-default opacity-80'}`}
                              >
                                <CheckCircle2 className={`w-5 h-5 ${isMapped ? 'opacity-100' : 'opacity-20'}`} />
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'clo' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* CLO Course Selector */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-2 bg-indigo-50 rounded-xl"><Target className="w-5 h-5 text-indigo-600" /></div>
              <div className="flex-1">
                <select 
                  value={selectedCourse?.id || ''} 
                  onChange={(e) => setSelectedCourse(courses.find(c => c.id === e.target.value) || null)}
                  className="w-full bg-transparent border-none focus:ring-0 font-bold text-gray-800 appearance-none cursor-pointer"
                >
                  {courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:bg-gray-50 rounded-xl transition-all text-sm font-bold border border-gray-100">
                  <Copy className="w-4 h-4" /> Copy from Batch
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-bold shadow-lg shadow-indigo-100">
                  <Plus className="w-4 h-4" /> Add CLO
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CLO List */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                  <h4 className="font-bold text-gray-800">Course Learning Outcomes</h4>
                </div>
                <div className="divide-y divide-gray-50">
                  {clos.length === 0 ? (
                    <div className="p-10 text-center text-gray-400 italic">No CLOs defined for this course</div>
                  ) : (
                    clos.map(clo => (
                      <div key={clo.id} className="p-4 hover:bg-gray-50 transition-colors group">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0 text-indigo-600 font-black text-xs">
                            {clo.order_number}
                          </div>
                          <div className="flex-1">
                            <h5 className="font-bold text-gray-800 leading-tight">{clo.title}</h5>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{clo.description}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[10px] font-black text-gray-400 uppercase">Target KPI: {clo.kpi_target}%</span>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* CLO-GA Matrix */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                  <h4 className="font-bold text-gray-800">CLO-GA Mapping</h4>
                  <button className="text-xs font-black text-indigo-600 uppercase hover:underline">Edit Weights</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-center">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="p-3 text-xs font-black text-gray-400 border-r border-gray-100">CLO</th>
                        {gas.map(ga => (
                          <th key={ga.id} className="p-3 text-xs font-bold text-gray-600 min-w-[60px]">GA-{ga.order_number}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {clos.map(clo => (
                        <tr key={clo.id} className="border-t border-gray-50">
                          <td className="p-3 text-xs font-black text-gray-700 bg-gray-50/30 border-r border-gray-100">C-{clo.order_number}</td>
                          {gas.map(ga => {
                            const mapping = cloGaMappings.find(m => m.clo === clo.id && m.ga === ga.id);
                            return (
                              <td key={ga.id} className="p-3">
                                <div className={`w-8 h-8 rounded-lg mx-auto flex items-center justify-center text-[10px] font-black ${
                                  mapping ? 'bg-green-100 text-green-700' : 'bg-gray-50 text-gray-300'
                                }`}>
                                  {mapping ? mapping.weight : '-'}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'curriculum' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-transparent">
              <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  Effective Curriculum: {selectedBatch?.name}
                </h3>
                <p className="text-sm text-gray-500">Manage batch-specific course overrides and elective additions</p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold transition-all shadow-lg shadow-blue-100">
                <RefreshCw className="w-4 h-4" /> Manage Overrides
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Sem</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Course Code</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Course Title</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Cr. Hrs</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Type</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {courses.map(course => (
                    <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-gray-500">{course.semester_number}</td>
                      <td className="px-6 py-4 font-mono text-sm font-bold text-blue-600">{course.code}</td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-800">{course.name}</td>
                      <td className="px-6 py-4 text-center text-sm font-bold text-gray-600">{course.credit_hours}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          course.course_type === 'theory' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                        }`}>
                          {course.course_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1.5 text-[10px] font-black text-green-600 uppercase">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Program Base
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OBECoordination;
