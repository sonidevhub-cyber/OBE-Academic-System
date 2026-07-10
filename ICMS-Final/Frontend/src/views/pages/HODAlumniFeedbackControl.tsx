import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { Calendar, CheckCircle2, Clock3, GraduationCap, Users, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import obeService, { Batch } from '../../api/obeService';

const addDays = (base: Date, days: number) => new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

const toDateTimeLocalValue = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
};

const fromDateTimeLocalValue = (value: string) => {
  if (!value) return '';
  return new Date(value).toISOString();
};

const formatDuration = (fromDate?: string | null) => {
  if (!fromDate) return 'N/A';
  const start = new Date(fromDate);
  if (Number.isNaN(start.getTime())) return 'N/A';

  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? '' : 's'}`);
  if (months > 0) parts.push(`${months} month${months === 1 ? '' : 's'}`);
  if (years === 0 && months === 0) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  return parts.join(' ');
};

const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  'EMPLOYED': 'Employed',
  'SELF_EMPLOYED': 'Self-Employed',
  'HIGHER_STUDIES': 'Higher Studies',
  'UNEMPLOYED': 'Unemployed',
  'HOUSEWIFE': 'Housewife'
};

const EMPLOYMENT_STATUS_COLORS: Record<string, string> = {
  'EMPLOYED': '#10b981',
  'SELF_EMPLOYED': '#3b82f6',
  'HIGHER_STUDIES': '#8b5cf6',
  'UNEMPLOYED': '#f59e0b',
  'HOUSEWIFE': '#ec4899'
};

const HODAlumniFeedbackControl: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [dueDates, setDueDates] = useState<Record<string, string>>({});
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [employmentStats, setEmploymentStats] = useState<Record<string, {
    employment_distribution: Record<string, number>;
    top_employers: Array<{ name: string; count: number }>;
  }>>({});

  const defaultDueDate = useMemo(() => toDateTimeLocalValue(addDays(new Date(), 15).toISOString()), []);

  const loadBatches = useCallback(async () => {
    try {
      const data = await obeService.getAlumniFeedbackBatches();
      setBatches(data);
      const nextDates: Record<string, string> = {};
      data.forEach((batch) => {
        nextDates[batch.id] = toDateTimeLocalValue(batch.alumni_feedback_due_at) || defaultDueDate;
      });
      setDueDates(nextDates);
    } catch (error) {
      console.error('Failed to load alumni feedback batches:', error);
      toast.error('Failed to load alumni feedback batches');
    } finally {
      setLoading(false);
    }
  }, [defaultDueDate]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const toggleAlumniFeedback = async (batch: Batch) => {
    setToggling(batch.id);
    try {
      const response = await obeService.toggleAlumniFeedbackForBatch(batch.id, {
        due_at: dueDates[batch.id] ? fromDateTimeLocalValue(dueDates[batch.id]) : undefined,
      });
      setBatches(prev =>
        prev.map(item =>
          item.id === batch.id
            ? {
                ...item,
                alumni_feedback_enabled: response.alumni_feedback_enabled,
                alumni_feedback_enabled_at: response.alumni_feedback_enabled_at,
                alumni_feedback_cycle_status: response.cycle?.status ?? item.alumni_feedback_cycle_status,
                alumni_feedback_due_at: response.cycle?.due_at ?? item.alumni_feedback_due_at,
                alumni_feedback_response_rate: response.cycle?.response_rate ?? item.alumni_feedback_response_rate,
                alumni_feedback_response_count: response.cycle?.response_count ?? item.alumni_feedback_response_count,
                alumni_feedback_total_alumni: response.cycle?.eligible_alumni_count ?? item.alumni_feedback_total_alumni,
              }
            : item
        )
      );
      toast.success(response.alumni_feedback_enabled ? 'Alumni feedback enabled' : 'Alumni feedback disabled');
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Failed to update alumni feedback';
      toast.error(message);
    } finally {
      setToggling(null);
    }
  };

  const loadEmploymentStats = useCallback(async (batchId: string) => {
    if (employmentStats[batchId]) return;
    try {
      const stats = await obeService.getAlumniEmploymentStats(batchId);
      setEmploymentStats(prev => ({ ...prev, [batchId]: stats }));
    } catch (error) {
      console.error('Failed to load employment stats:', error);
    }
  }, [employmentStats]);

  const toggleExpand = useCallback((batchId: string) => {
    setExpandedBatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(batchId)) {
        newSet.delete(batchId);
      } else {
        newSet.add(batchId);
        loadEmploymentStats(batchId);
      }
      return newSet;
    });
  }, [loadEmploymentStats]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Alumni Feedback Control</h2>
            <p className="text-gray-600 mt-1">
              Review every graduated batch, see how long it has been alumni, and enable feedback whenever HOD chooses.
            </p>
          </div>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-100 border-t-emerald-500"></div>
        </div>
      ) : batches.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-600">
          No graduated batches found.
        </div>
      ) : (
        <div className="grid gap-6">
          {batches.map((batch, index) => {
            const dueDateValue = dueDates[batch.id] || defaultDueDate;
            const graduationAge = formatDuration(batch.graduated_at);
            const readyForFeedback = batch.is_alumni_feedback_eligible;
            return (
              <motion.div
                key={batch.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-3">
                      <h3 className="text-xl font-bold text-gray-800">{batch.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        batch.alumni_feedback_enabled
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {batch.alumni_feedback_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        readyForFeedback ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {readyForFeedback ? 'Available' : 'Not available'}
                      </span>
                      {batch.alumni_feedback_cycle_status && (
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          batch.alumni_feedback_cycle_status === 'ACTIVE'
                            ? 'bg-blue-100 text-blue-700'
                            : batch.alumni_feedback_cycle_status === 'CLOSED'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {batch.alumni_feedback_cycle_status}
                        </span>
                      )}
                      <button
                        onClick={() => toggleExpand(batch.id)}
                        className="ml-auto p-2 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        {expandedBatches.has(batch.id) ? (
                          <ChevronUp className="w-5 h-5 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                        )}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-6 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700">Program:</span>
                        {batch.program?.name || 'N/A'}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock3 className="w-4 h-4 text-emerald-500" />
                        <span>
                          Alumni for: {graduationAge}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-500" />
                        <span>
                          Due: {batch.alumni_feedback_due_at ? new Date(batch.alumni_feedback_due_at).toLocaleString() : 'Not set'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-500" />
                        <span>Alumni: {batch.alumni_feedback_total_alumni || 0}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>Responses: {batch.alumni_feedback_response_count || 0}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock3 className="w-4 h-4 text-indigo-500" />
                        <span>Response Rate: {batch.alumni_feedback_response_rate || 0}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-stretch gap-3 min-w-[280px]">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Lock Date
                    </label>
                    <input
                      type="datetime-local"
                      value={dueDateValue}
                      onChange={(e) => setDueDates(prev => ({ ...prev, [batch.id]: e.target.value }))}
                      className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="text-xs text-slate-500 bg-slate-50 px-4 py-3 rounded-xl">
                      HOD can enable alumni feedback anytime after graduation.
                    </div>

                    {batch.alumni_feedback_enabled ? (
                      <button
                        onClick={() => toggleAlumniFeedback(batch)}
                        disabled={
                          toggling === batch.id ||
                          ((batch.alumni_feedback_response_rate ?? 0) < 50 &&
                            batch.alumni_feedback_cycle_status === 'ACTIVE')
                        }
                        className="px-6 py-3 rounded-xl font-semibold transition-all duration-200 bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                      >
                        {toggling === batch.id ? 'Processing...' : 'Disable Feedback'}
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleAlumniFeedback(batch)}
                        disabled={toggling === batch.id || !readyForFeedback || batch.alumni_feedback_cycle_status === 'CLOSED'}
                        className="px-6 py-3 rounded-xl font-semibold transition-all duration-200 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-lg disabled:opacity-50"
                      >
                        {toggling === batch.id ? 'Processing...' : batch.alumni_feedback_cycle_status === 'CLOSED' ? 'Feedback Closed' : 'Enable Feedback'}
                      </button>
                    )}

                    {!batch.alumni_feedback_enabled && (
                      <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-4 py-2 rounded-xl">
                        <XCircle className="w-4 h-4" />
                        <span className="text-sm font-semibold">
                          Feedback is currently off for this batch
                        </span>
                      </div>
                    )}
                    {batch.alumni_feedback_enabled && (batch.alumni_feedback_response_rate ?? 0) < 50 && (
                      <div className="text-xs text-gray-500">
                        Auto-extends by 5 days if response rate stays below 50%.
                      </div>
                    )}
                  </div>
                </div>

                {expandedBatches.has(batch.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-6 pt-6 border-t border-gray-100"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Employment Rate Chart */}
                      <div className="bg-gray-50 rounded-2xl p-6">
                        <h4 className="text-lg font-bold text-gray-800 mb-4">Employment Status</h4>
                        {employmentStats[batch.id] ? (
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart
                              data={Object.entries(employmentStats[batch.id].employment_distribution).map(([key, value]) => ({
                                status: EMPLOYMENT_STATUS_LABELS[key] || key,
                                count: value,
                              }))}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="status" />
                              <YAxis />
                              <Tooltip />
                              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-indigo-500"></div>
                          </div>
                        )}
                      </div>

                      {/* Top Employers */}
                      <div className="bg-gray-50 rounded-2xl p-6">
                        <h4 className="text-lg font-bold text-gray-800 mb-4">Top Employers</h4>
                        {employmentStats[batch.id] ? (
                          employmentStats[batch.id].top_employers.length > 0 ? (
                            <div className="space-y-3">
                              {employmentStats[batch.id].top_employers.map((employer, i) => (
                                <div key={i} className="flex items-center justify-between bg-white px-4 py-3 rounded-xl shadow-sm">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                      {i + 1}
                                    </div>
                                    <span className="font-semibold text-gray-700">{employer.name}</span>
                                  </div>
                                  <span className="text-indigo-600 font-bold">{employer.count} Alumni</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center text-gray-500 py-8">
                              No employer data available yet.
                            </div>
                          )
                        ) : (
                          <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-indigo-500"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HODAlumniFeedbackControl;
