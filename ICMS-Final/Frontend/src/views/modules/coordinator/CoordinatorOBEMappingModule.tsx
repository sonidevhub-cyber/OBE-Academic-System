import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, 
  Award, 
  Settings, 
  BookOpen, 
  Plus, 
  Save, 
  Trash2, 
  Info,
  ChevronRight,
  LayoutGrid,
  Check
} from 'lucide-react';
import obeService, { PEO, GA, GAPEOMatrix } from '../../../api/obeService';
import academicStructureService, { Program, Course } from '../../../api/academicStructureService';
import { curriculumService, CurriculumVersion } from '../../../api/curriculumService';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'react-toastify';

type SubTabId = 'vision' | 'peo' | 'ga' | 'ga-peo' | 'clo-pi';

const CoordinatorOBEMappingModule: React.FC = () => {
  const { currentUser } = useAuth();
  const isHOD = currentUser?.effective_role === 'hod' || currentUser?.role === 'hod';
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>(isHOD ? 'vision' : 'clo-pi');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [versions, setVersions] = useState<CurriculumVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<CurriculumVersion | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [clos, setClos] = useState<any[]>([]);

  // Vision State
  const [vision, setVision] = useState('');
  const [isSavingVision, setIsSavingVision] = useState(false);

  // PEO/GA/CLO States
  const [peos, setPeos] = useState<PEO[]>([]);
  const [gas, setGas] = useState<GA[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'peo' | 'ga' | 'clo'>('peo');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({ 
    title: '', 
    description: '', 
    order_number: 1, 
    kpi_target: 60,
    bloom_level: 'K2',
    performance_indicators: [] as any[]
  });

  // Matrix States
  const [gaPeoMatrix, setGaPeoMatrix] = useState<GAPEOMatrix | null>(null);
  const [cloPiMatrix, setCloPiMatrix] = useState<any>(null);
  const [matrixChanges, setMatrixChanges] = useState<Set<string>>(new Set());

  const fetchInitialData = useCallback(async () => {
    try {
      const res = await academicStructureService.getPrograms();
      setPrograms(res.data);
      if (res.data.length > 0) {
        setSelectedProgram(res.data[0]);
      }
    } catch (error) {
      toast.error('Failed to load programs');
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (selectedProgram) {
      setVision(selectedProgram.description || '');
      loadPeosAndGas(selectedProgram.id);
      loadVersions(selectedProgram.id);
    }
  }, [selectedProgram]);

  useEffect(() => {
    if (selectedProgram) {
      loadCourses(selectedProgram.id);
    }
  }, [selectedProgram]);

  useEffect(() => {
    if (selectedCourse && selectedVersion) {
      loadClos(selectedCourse.id, selectedVersion.id);
    }
  }, [selectedCourse, selectedVersion]);

  const loadPeosAndGas = async (programId: string) => {
    if (!programId) return;
    try {
      const [peoRes, gaRes] = await Promise.all([
        obeService.getPEOs(programId),
        obeService.getGAs(programId)
      ]);
      setPeos(Array.isArray(peoRes) ? peoRes : (peoRes as any).data || []);
      setGas(Array.isArray(gaRes) ? gaRes : (gaRes as any).data || []);
    } catch (error) {
      console.error('Failed to load PEOs/GAs:', error);
      setPeos([]);
      setGas([]);
    }
  };

  const loadVersions = async (programId: string) => {
    if (!programId) return;
    try {
      const res = await curriculumService.getVersions({ program: programId, status: 'draft' });
      const versionData = Array.isArray(res.data) ? res.data : (res.data as any).data || [];
      setVersions(versionData);
      if (versionData.length > 0) {
        setSelectedVersion(versionData[0]);
      } else {
        setSelectedVersion(null);
      }
    } catch (error) {
      console.error('Failed to load versions:', error);
      setVersions([]);
      setSelectedVersion(null);
    }
  };

  const loadCourses = async (programId: string) => {
    if (!programId) return;
    try {
      const res = await academicStructureService.getCourses(programId);
      const courseData = Array.isArray(res.data) ? res.data : (res.data as any).data || [];
      setCourses(courseData);
    } catch (error) {
      console.error('Failed to load courses:', error);
      setCourses([]);
    }
  };

  const loadClos = async (courseId: string, versionId: number) => {
    if (!courseId || !versionId) return;
    try {
      const res = await obeService.getCLOs(courseId, versionId);
      setClos(Array.isArray(res) ? res : (res as any).data || []);
    } catch (error) {
      console.error('Failed to load CLOs:', error);
      setClos([]);
    }
  };

  const handleSaveVision = async () => {
    if (!selectedProgram) return;
    setIsSavingVision(true);
    try {
      await obeService.updateProgramVision(selectedProgram.id, vision);
      toast.success('Program vision updated');
    } catch (error) {
      toast.error('Failed to update vision');
    } finally {
      setIsSavingVision(false);
    }
  };

  const handleOpenModal = (type: 'peo' | 'ga' | 'clo', item?: any) => {
    setModalType(type);
    setEditingItem(item || null);

    setFormData(item ? { 
      title: item.title, 
      description: item.description, 
      order_number: item.order_number,
      kpi_target: item.kpi_target || item.kpi_threshold || 60,
      bloom_level: item.bloom_level || 'K2',
      performance_indicators: []
    } : { 
      title: '', 
      description: '', 
      order_number: (type === 'peo' ? peos.length : type === 'ga' ? gas.length : clos.length) + 1,
      kpi_target: 60,
      bloom_level: 'K2',
      performance_indicators: []
    });
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgram) return;

    try {
      if (modalType === 'peo') {
        // Prepare data with kpi_threshold instead of kpi_target for PEO
        const peoData = {
          ...formData,
          kpi_threshold: formData.kpi_target
        };
        if (editingItem) {
          await obeService.updatePEO(editingItem.id, peoData);
          toast.success('PEO updated');
        } else {
          await obeService.createPEO(selectedProgram.id, peoData);
          toast.success('PEO created');
        }
        loadPeosAndGas(selectedProgram.id);
      } else if (modalType === 'ga') {
        if (editingItem) {
          await obeService.updateGA(editingItem.id, formData);
          toast.success('GA updated');
        } else {
          await obeService.createGA(selectedProgram.id, formData);
          toast.success('GA created');
        }
        loadPeosAndGas(selectedProgram.id);
      } else if (modalType === 'clo') {
        if (!selectedCourse || !selectedVersion) return;
        if (editingItem) {
          await obeService.updateCLO(editingItem.id, formData);
          toast.success('CLO updated');
        } else {
          await obeService.createCLO(selectedCourse.id, selectedVersion.id, formData);
          toast.success('CLO created');
        }
        loadClos(selectedCourse.id, selectedVersion.id);
      }
      setIsModalOpen(false);
    } catch (error) {
      toast.error('Failed to save item');
    }
  };

  const handleDeleteItem = async (type: 'peo' | 'ga' | 'clo', id: string) => {
    if (!window.confirm(`Are you sure you want to delete this ${type.toUpperCase()}?`)) return;
    try {
      if (type === 'peo') await obeService.deletePEO(id);
      else if (type === 'ga') await obeService.deleteGA(id);
      else if (type === 'clo') await obeService.deleteCLO(id);
      toast.success(`${type.toUpperCase()} deleted`);
      if (type === 'clo') loadClos(selectedCourse!.id, selectedVersion!.id);
      else loadPeosAndGas(selectedProgram!.id);
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const loadGaPeoMatrix = async () => {
    if (!selectedProgram) return;
    try {
      const res = await obeService.getGAPEOMatrix(selectedProgram.id);
      setGaPeoMatrix(res);
      setMatrixChanges(new Set());
    } catch (error: any) {
      if (error.response?.status === 404) {
        setGaPeoMatrix({ peos: [], gas: [], mappings: [] });
      } else {
        toast.error('Failed to load GA-PEO matrix');
      }
    }
  };

  const loadCloGaMatrix = async () => {
    if (!selectedCourse || !selectedVersion) return;
    try {
      const res = await obeService.getMappingMatrix(selectedCourse.id, selectedVersion.id);
      setCloPiMatrix(res);
      setMatrixChanges(new Set());
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Try fallback or show empty
        setCloPiMatrix({ clos: [], gas: [], mappings: [] });
      } else {
        toast.error('Failed to load CLO-GA matrix');
      }
    }
  };

  useEffect(() => {
    if (activeSubTab === 'ga-peo' && selectedProgram) loadGaPeoMatrix();
    if (activeSubTab === 'clo-pi' && selectedCourse && selectedVersion) loadCloGaMatrix();
  }, [activeSubTab, selectedProgram, selectedCourse, selectedVersion]);

  const handleMatrixChange = (rowId: string, colId: string, type: 'ga-peo' | 'clo-ga') => {
     const changeKey = `${rowId}-${colId}`;
     const newChanges = new Set(matrixChanges);
     if (newChanges.has(changeKey)) newChanges.delete(changeKey);
     else newChanges.add(changeKey);
     setMatrixChanges(newChanges);

     if (type === 'ga-peo') {
        const newMappings = [...gaPeoMatrix!.mappings];
        const existingIdx = newMappings.findIndex(m => (m.ga === rowId && m.peo === colId) || (m.ga_id === rowId && m.peo_id === colId));
        if (existingIdx >= 0) newMappings.splice(existingIdx, 1);
        else newMappings.push({ id: '', ga: rowId, peo: colId, ga_id: rowId, peo_id: colId });
        setGaPeoMatrix({ ...gaPeoMatrix!, mappings: newMappings });
      } else {
       const newMappings = [...cloPiMatrix!.mappings];
       const existingIdx = newMappings.findIndex(m => (m.clo === rowId && m.ga === colId) || (m.clo_id === rowId && m.ga_id === colId));
       if (existingIdx >= 0) newMappings.splice(existingIdx, 1);
       else newMappings.push({ id: '', clo: rowId, ga: colId, clo_id: rowId, ga_id: colId, weight: 3 });
       setCloPiMatrix({ ...cloPiMatrix!, mappings: newMappings });
     }
   };

   const handleSaveMatrix = async (type: 'ga-peo' | 'clo-ga') => {
      try {
        if (type === 'ga-peo') {
          const mappings = gaPeoMatrix!.mappings.map(m => ({
            ga_id: (m.ga || m.ga_id)!,
            peo_id: (m.peo || m.peo_id)!
          }));
          await obeService.saveGAPEOMappings(selectedProgram!.id, mappings);
          toast.success('GA-PEO mappings saved');
          loadGaPeoMatrix();
        } else {
          const mappings = cloPiMatrix!.mappings.map((m: any) => ({
            clo_id: (m.clo || m.clo_id)!,
            ga_id: (m.ga || m.ga_id)!,
            weight: m.weight || 3
          }));
          await obeService.saveCLOGAMappings(selectedCourse!.id, selectedVersion!.id, mappings);
          toast.success('CLO-GA mappings saved');
          loadCloGaMatrix();
        }
        setMatrixChanges(new Set());
      } catch (error) {
        toast.error('Failed to save mappings');
      }
    };

  const subTabs = [
    ...(isHOD ? [
      { id: 'vision', label: 'Program Vision', icon: Target },
      { id: 'peo', label: 'PEO Definitions', icon: Award },
      { id: 'ga', label: 'GA Definitions', icon: Info },
      { id: 'ga-peo', label: 'GA-PEO Mapping', icon: LayoutGrid },
    ] : [
      { id: 'clo-pi', label: 'CLO-GA Mapping', icon: BookOpen },
    ]),
  ];

  return (
    <div className="space-y-6">
      {/* Selection Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-6">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Program</label>
          <select 
            value={selectedProgram?.id || ''} 
            onChange={(e) => setSelectedProgram(programs.find(p => p.id === e.target.value) || null)}
            className="bg-gray-50 border-none rounded-xl px-4 py-2.5 font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500"
          >
            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {!isHOD && activeSubTab === 'clo-pi' && (
          <>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Curriculum Version (Draft)</label>
              <select 
                value={selectedVersion?.id || ''} 
                onChange={(e) => setSelectedVersion(versions.find(v => v.id === Number(e.target.value)) || null)}
                className="bg-gray-50 border-none rounded-xl px-4 py-2.5 font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500"
              >
                {versions.length === 0 && <option value="">No Draft Versions</option>}
                {versions.map(v => <option key={v.id} value={v.id}>{v.version_no}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Course</label>
              <select 
                value={selectedCourse?.id || ''} 
                onChange={(e) => setSelectedCourse(courses.find(c => c.id === e.target.value) || null)}
                className="bg-gray-50 border-none rounded-xl px-4 py-2.5 font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select Course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 gap-1 overflow-x-auto">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as SubTabId)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                activeSubTab === tab.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-indigo-600'
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-white rounded-3xl shadow-xl shadow-indigo-50/50 border border-indigo-50 overflow-hidden"
        >
          {activeSubTab === 'vision' && (
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-black text-gray-900">Program Vision & Mission</h3>
                  <p className="text-gray-400 text-sm mt-1">Define the strategic direction of the {selectedProgram?.name} program.</p>
                </div>
                <button 
                  onClick={handleSaveVision}
                  disabled={isSavingVision}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  <Save size={18} />
                  {isSavingVision ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
              <textarea
                value={vision}
                onChange={(e) => setVision(e.target.value)}
                placeholder="Enter program vision and mission statements here..."
                className="w-full h-64 p-6 bg-gray-50 border-none rounded-2xl text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
              />
            </div>
          )}

          {(activeSubTab === 'peo' || activeSubTab === 'ga') && (
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-black text-gray-900">
                    {activeSubTab === 'peo' ? 'Program Educational Objectives (PEOs)' : 'Graduate Attributes (GAs)'}
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">
                    Manage the {activeSubTab.toUpperCase()}s defined for this program.
                  </p>
                </div>
                {isHOD && (
                  <button 
                    onClick={() => handleOpenModal(activeSubTab)}
                    className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition-all"
                  >
                    <Plus size={18} />
                    Add {activeSubTab.toUpperCase()}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(activeSubTab === 'peo' ? peos : gas).map((item) => (
                  <div key={item.id} className="group p-6 bg-gray-50 rounded-2xl border border-transparent hover:border-indigo-200 hover:bg-white hover:shadow-xl transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 text-white font-black">
                          {item.order_number}
                        </span>
                        <h4 className="font-bold text-gray-900 text-lg">{item.title}</h4>
                      </div>
                      {isHOD && (
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleOpenModal(activeSubTab, item)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                            <Settings size={18} />
                          </button>
                          <button onClick={() => handleDeleteItem(activeSubTab, item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSubTab === 'ga-peo' && (
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-black text-gray-900">GA to PEO Mapping Matrix</h3>
                  <p className="text-gray-400 text-sm mt-1">Map Graduate Attributes to Program Educational Objectives.</p>
                </div>
                {isHOD && (
                  <button 
                    onClick={() => handleSaveMatrix('ga-peo')}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all"
                  >
                    <Save size={18} />
                    Save Mappings
                  </button>
                )}
              </div>

              {gaPeoMatrix ? (
                <div className="overflow-x-auto rounded-3xl border border-gray-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="p-6 border-b border-gray-100 font-black text-gray-400 uppercase text-xs tracking-widest w-64">Graduate Attribute</th>
                        {gaPeoMatrix.peos.map(peo => (
                          <th key={peo.id} className="p-6 border-b border-gray-100 text-center w-32">
                            <div className="font-black text-indigo-600 text-sm">PEO-{peo.order_number}</div>
                            <div className="text-[10px] text-gray-400 mt-1 uppercase truncate max-w-[100px] mx-auto">{peo.title}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gaPeoMatrix.gas.map(ga => (
                        <tr key={ga.id} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="p-6 border-b border-gray-50">
                            <div className="font-bold text-gray-900">GA-{ga.order_number}</div>
                            <div className="text-sm text-gray-500 truncate max-w-[200px]">{ga.title}</div>
                          </td>
                          {gaPeoMatrix.peos.map(peo => {
                            const active = gaPeoMatrix.mappings.some(m => 
                              (m.ga === ga.id || m.ga_id === ga.id) && (m.peo === peo.id || m.peo_id === peo.id)
                            );
                            return (
                              <td key={peo.id} className="p-6 border-b border-gray-50 text-center">
                                <button
                                  onClick={() => isHOD && handleMatrixChange(ga.id, peo.id, 'ga-peo')}
                                  disabled={!isHOD}
                                  className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto transition-all transform active:scale-95 ${
                                    active 
                                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                                      : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                                  } ${!isHOD ? 'cursor-not-allowed opacity-60' : ''}`}
                                >
                                  {active ? <Save size={20} /> : <Plus size={20} />}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center text-gray-400 italic">Select a program to view mapping matrix...</div>
              )}
            </div>
          )}

          {activeSubTab === 'clo-pi' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {!selectedCourse ? (
              <div className="bg-white p-12 text-center rounded-[40px] border-2 border-dashed border-gray-100 shadow-xl shadow-gray-50/50">
                <BookOpen className="w-16 h-16 text-gray-200 mx-auto mb-6" />
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-widest">Select a Course</h3>
                <p className="text-gray-500 font-bold mt-2">Please select a course to define CLOs and map them to GAs</p>
              </div>
            ) : (
              <>
                {/* CLO Definition Section */}
                <div className="bg-white p-8 rounded-[40px] shadow-xl border border-gray-100">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-xl font-black text-gray-900 uppercase tracking-widest">Course Learning Outcomes</h3>
                      <p className="text-gray-500 font-bold mt-1">Define learning outcomes for {selectedCourse.code}</p>
                    </div>
                    <button 
                      onClick={() => handleOpenModal('clo')}
                      className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-100 transition-all"
                    >
                      <Plus size={18} />
                      Add CLO
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clos.map(clo => (
                      <div key={clo.id} className="group p-6 bg-gray-50 rounded-3xl border border-transparent hover:border-indigo-100 hover:bg-white hover:shadow-xl hover:shadow-indigo-50/50 transition-all relative overflow-hidden">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-lg shadow-inner">
                            {clo.order_number}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">CLO-{clo.order_number}</span>
                              <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-lg font-black uppercase">
                                {clo.bloom_level}
                              </span>
                            </div>
                            <p className="text-sm font-bold text-gray-700 leading-relaxed" title={clo.title}>{clo.title}</p>
                          </div>
                        </div>
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => handleOpenModal('clo', clo)} className="p-2 bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl shadow-sm border border-gray-100">
                            <Settings size={14} />
                          </button>
                          <button onClick={() => handleDeleteItem('clo', clo.id)} className="p-2 bg-white text-red-600 hover:bg-red-50 rounded-xl shadow-sm border border-gray-100">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mapping Matrix Section */}
                <div className="bg-white p-8 rounded-[40px] shadow-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-black text-gray-900 uppercase tracking-widest">CLO-GA Mapping Matrix</h3>
                      <p className="text-gray-500 font-bold mt-1">Map Course Learning Outcomes to Graduate Attributes</p>
                    </div>
                    <button
                      onClick={() => handleSaveMatrix('clo-ga')}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-indigo-200"
                    >
                      <Save size={18} />
                      Save Mappings
                    </button>
                  </div>

                  {cloPiMatrix && (
                    <div className="overflow-x-auto rounded-[30px] border border-gray-100">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-r border-gray-100 w-48 sticky left-0 bg-gray-50 z-10">CLOs \ GAs</th>
                            {cloPiMatrix.gas.map((ga: any) => (
                              <th 
                                key={ga.id}
                                className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest text-center border-b border-r border-gray-100 bg-indigo-50/50"
                              >
                                GA-{ga.order_number}: {ga.title}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {cloPiMatrix.clos.map((clo: any) => (
                            <tr key={clo.id} className="hover:bg-gray-50 transition-colors">
                              <td className="p-6 border-b border-r border-gray-100 font-black text-gray-700 text-sm sticky left-0 bg-white group-hover:bg-gray-50 z-10">
                                <div className="flex flex-col">
                                  <span>{clo.title}</span>
                                  <span className="text-[10px] text-gray-400 font-bold uppercase">{clo.bloom_level}</span>
                                </div>
                              </td>
                              {cloPiMatrix.gas.map((ga: any) => {
                                const isSelected = cloPiMatrix.mappings.some((m: any) => 
                                  (m.clo === clo.id || m.clo_id === clo.id) && (m.ga === ga.id || m.ga_id === ga.id)
                                );
                                return (
                                  <td key={`${clo.id}-${ga.id}`} className="p-4 border-b border-r border-gray-100 text-center">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleMatrixChange(clo.id, ga.id, 'clo-ga')}
                                        className="sr-only peer"
                                      />
                                      <div className="w-10 h-10 bg-gray-100 rounded-xl peer-checked:bg-indigo-600 flex items-center justify-center transition-all peer-checked:shadow-lg peer-checked:shadow-indigo-100">
                                        {isSelected && <Check size={20} className="text-white" />}
                                      </div>
                                    </label>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
        </motion.div>
      </AnimatePresence>

      {/* Modal for PEO/GA/CLO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white"
          >
            <div className="p-10">
              <h3 className="text-2xl font-black text-gray-900 mb-2">
                {editingItem ? 'Edit' : 'Add'} {modalType.toUpperCase()}
              </h3>
              <p className="text-gray-400 text-sm mb-8">Fill in the details for the {modalType === 'clo' ? 'course learning outcome' : 'program objective'}.</p>
              
              <form onSubmit={handleSaveItem} className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Title / Short Name</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder={`e.g. ${modalType === 'clo' ? 'Design Principles' : 'Fundamental Knowledge'}`}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Order Number</label>
                    <input
                      type="number"
                      required
                      value={formData.order_number}
                      onChange={(e) => setFormData({...formData, order_number: parseInt(e.target.value)})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  {(modalType === 'clo' || modalType === 'ga' || modalType === 'peo') && (
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">KPI Threshold (%)</label>
                      <input
                        type="number"
                        required
                        value={formData.kpi_target}
                        onChange={(e) => setFormData({...formData, kpi_target: parseFloat(e.target.value)})}
                        placeholder="e.g., 70"
                        className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  )}
                  {modalType === 'clo' && (
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Bloom Level</label>
                      <select
                        required
                        value={formData.bloom_level}
                        onChange={(e) => setFormData({...formData, bloom_level: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                      >
                        <option value="K1">K1 - Remembering</option>
                        <option value="K2">K2 - Understanding</option>
                        <option value="K3">K3 - Applying</option>
                        <option value="K4">K4 - Analyzing</option>
                        <option value="K5">K5 - Evaluating</option>
                        <option value="K6">K6 - Creating</option>
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Description</label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Provide a detailed description..."
                    className="w-full h-32 bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-gray-100 text-gray-500 px-6 py-4 rounded-2xl font-black hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                  >
                    Save {modalType.toUpperCase()}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default CoordinatorOBEMappingModule;
