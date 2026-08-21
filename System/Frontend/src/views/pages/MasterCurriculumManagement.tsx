import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, Eye, Edit, Trash2, Loader2, X, BookOpen, CheckCircle2, AlertCircle } from 'lucide-react';
import { curriculumService } from '../../api/curriculumService';
import academicStructureService, { Program } from '../../api/academicStructureService';
import { toast } from 'react-toastify';

const MasterCurriculumManagement = () => {
  const [masterCurricula, setMasterCurricula] = useState<any[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({ version_no: '', program: '' });
  const [error, setError] = useState<string | null>(null);

  const fetchMasterCurricula = useCallback(async () => {
    setLoading(true);
    try {
      const response = await curriculumService.getAllMasterCurricula();
      // The API returns an object with a 'data' property containing the array
      setMasterCurricula(response.data.data || []);
    } catch (err) {
      toast.error('Failed to load master curricula.');
      setMasterCurricula([]); // Ensure it's an array on error
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPrograms = useCallback(async () => {
    try {
      const response = await academicStructureService.getPrograms();
      setPrograms(response.data);
    } catch (err) {
      toast.error('Failed to load programs.');
    }
  }, []);

  useEffect(() => {
    fetchMasterCurricula();
    fetchPrograms();
  }, [fetchMasterCurricula, fetchPrograms]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await curriculumService.createCurriculumVersion(form);
      toast.success('Master curriculum created successfully!');
      setShowCreateModal(false);
      setForm({ version_no: '', program: '' });
      fetchMasterCurricula();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create master curriculum.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-end border-b pb-4 border-gray-100">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Master Curricula</h1>
          <p className="text-gray-500 mt-1">Manage reusable curriculum templates.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Master Curriculum</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version No</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Courses</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-300 inline-block" />
                </td>
              </tr>
            ) : (
              masterCurricula.map(mc => (
                <tr key={mc.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-800">{mc.version_no}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">{mc.program_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">{mc.total_courses}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Link to={`/curriculum/master/${mc.id}`} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-md">
                      <Eye className="w-5 h-5 inline-block" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: -20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: -20 }}
              className="bg-white rounded-2xl shadow-xl max-w-lg w-full"
            >
              <form onSubmit={handleSubmit}>
                <div className="p-8">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">New Master Curriculum</h2>
                    <button type="button" onClick={() => setShowCreateModal(false)} className="text-gray-400 text-2xl">&times;</button>
                  </div>

                  {error && (
                    <div className="flex items-center gap-3 p-3 mb-4 bg-red-50 text-red-700 rounded-xl border border-red-100">
                      <AlertCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">{error}</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Version Number</label>
                      <input
                        name="version_no"
                        value={form.version_no}
                        onChange={handleFormChange}
                        placeholder="e.g., V1.0-Fall2024"
                        required
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Program</label>
                      <select
                        name="program"
                        value={form.program}
                        onChange={handleFormChange}
                        required
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Select a program</option>
                        {programs.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-8 py-4 flex justify-end gap-3 rounded-b-2xl">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="px-6 py-2 rounded-xl border border-gray-200 text-gray-600">Cancel</button>
                  <button type="submit" disabled={submitting} className="flex items-center gap-2 px-8 py-2 bg-indigo-600 text-white rounded-xl shadow-lg disabled:opacity-50">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>Create</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MasterCurriculumManagement;