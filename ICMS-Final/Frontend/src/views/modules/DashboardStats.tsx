import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Users, GraduationCap, UserCheck, Building2, Layers, ChevronRight } from 'lucide-react';

interface BatchInfo {
  id: string;
  name?: string;
  current_semester?: number;
  total_students?: number;
  student_count?: number;
  program_name?: string;
}

interface StatsProps {
  stats: {
    totalStudents: number;
    totalInstructors: number;
    totalHods: number;
    totalAlumni?: number;
    totalBatches?: number;
  };
  onNavigate?: (tab: 'students' | 'instructors' | 'hod' | 'program-setup' | 'users' | 'alumni') => void;
}

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

const DashboardStats: React.FC<StatsProps> = ({ stats, onNavigate }) => {
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  useEffect(() => {
    const authData = localStorage.getItem('auth');
    const token = authData ? JSON.parse(authData).access_token || JSON.parse(authData).token : null;
    if (!token) {
      setLoadingBatches(false);
      return;
    }
    const load = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/batches/all/', {
          headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data.data || [];
          setBatches(list);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingBatches(false);
      }
    };
    load();
  }, []);

  const totalRealStudents = useMemo(() => {
    const sum = batches.reduce((acc, b: any) => acc + Number(b.total_students ?? b.student_count ?? 0), 0);
    return sum > 0 ? sum : null;
  }, [batches]);

  // Chart 1: Per-Batch enrollment (top bar chart — unique: per-batch granularity)
  const barChartData = useMemo(() => {
    if (batches.length === 0) return [];
    return batches
      .slice(0, 10)
      .map((b: any) => ({
        name: b.name || b.batch_name || `Batch ${b.id?.slice(0, 5)}`,
        students: Number(b.total_students ?? b.student_count ?? 0)
      }))
      .filter((d: any) => d.students > 0);
  }, [batches]);

  // Chart 2: Semester Distribution — batches count per semester (donut)
  const semesterDistribution = useMemo(() => {
    const counter: Record<number, number> = {};
    if (batches.length > 0) {
      batches.forEach((b: any) => {
        const sem = Number(b.current_semester) || 0;
        if (sem > 0) counter[sem] = (counter[sem] || 0) + 1;
      });
    }
    return Object.entries(counter).map(([sem, count]) => ({
      name: `Sem ${sem}`,
      value: count
    }));
  }, [batches]);

  // Chart 3 (NEW, not duplicated): Semester-wise Student Population — TOTAL students per semester (sums all batches).
  // COMPLETELY different from chart 1 which shows individual batch sizes.
  const semesterPopulation = useMemo(() => {
    const counter: Record<number, number> = {};
    if (batches.length > 0) {
      batches.forEach((b: any) => {
        const sem = Number(b.current_semester) || 0;
        const students = Number(b.total_students ?? b.student_count ?? 0);
        if (sem > 0 && students > 0) counter[sem] = (counter[sem] || 0) + students;
      });
    }
    const entries = Object.entries(counter).sort((a, b) => Number(a[0]) - Number(b[0]));
    return entries.map(([sem, count]) => ({
      name: `Sem ${sem}`,
      students: count
    }));
  }, [batches]);

  const statCards = [
    {
      key: 'students',
      title: 'Active Students',
      value: stats.totalStudents,
      helper: 'Currently enrolled',
      gradient: 'from-indigo-500 to-purple-600',
      icon: Users,
      onClick: () => onNavigate?.('students')
    },
    {
      key: 'alumni',
      title: 'Total Alumni',
      value: stats.totalAlumni ?? 0,
      helper: 'Graduated students',
      gradient: 'from-blue-400 to-sky-500',
      icon: GraduationCap,
      onClick: () => onNavigate?.('alumni')
    },
    {
      key: 'instructors',
      title: 'Faculty Members',
      value: stats.totalInstructors,
      helper: 'Active teaching staff',
      gradient: 'from-emerald-500 to-teal-600',
      icon: UserCheck,
      onClick: () => onNavigate?.('users')
    },
    {
      key: 'hods',
      title: 'HODs',
      value: stats.totalHods,
      helper: 'Department heads',
      gradient: 'from-pink-500 to-rose-600',
      icon: Building2,
      onClick: () => onNavigate?.('users')
    },
    {
      key: 'batches',
      title: 'Active Batches',
      value: stats.totalBatches ?? batches.length,
      helper: `${totalRealStudents ?? '—'} total students`,
      gradient: 'from-cyan-500 to-blue-600',
      icon: Layers,
      onClick: () => onNavigate?.('program-setup')
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.button
              key={card.key}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * idx, duration: 0.4 }}
              whileHover={{ y: -3 }}
              onClick={card.onClick}
              className="group relative overflow-hidden bg-white p-5 rounded-[22px] shadow-sm border border-gray-100 text-left cursor-pointer hover:shadow-xl hover:border-indigo-100 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{card.title}</p>
                  <p className="mt-1.5 text-3xl font-black text-gray-900 tabular-nums">{card.value}</p>
                  <p className="mt-1 text-xs font-medium text-gray-400 truncate">{card.helper}</p>
                </div>
                <div className={`h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                  <Icon className="h-6 w-6 text-white" strokeWidth={2.2} />
                </div>
              </div>
              <div className="mt-4 flex items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-indigo-500 transition-colors">
                <span>View Details</span>
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Charts Row 1 — Batch Strength + Semester Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Per-Batch Enrollment Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="lg:col-span-2 bg-white p-6 rounded-[22px] shadow-sm border border-gray-100"
        >
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                Batch Enrollment
                <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  Live · Per Batch
                </span>
              </h3>
              <p className="text-xs font-medium text-gray-400 mt-0.5">Student counts for individual active batches</p>
            </div>
            {loadingBatches && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                Syncing...
              </span>
            )}
          </div>
          <div className="h-[300px]">
            {barChartData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                  <Users className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-sm font-bold text-gray-500">No batch enrollment data yet</p>
                <p className="text-xs text-gray-400">Populate batches with student counts to see per-batch breakdown.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.65} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{
                      borderRadius: '14px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 10px 25px -10px rgba(99, 102, 241, 0.3)',
                      fontWeight: 700,
                      fontSize: 12
                    }}
                    formatter={(value: any) => [`${value} students`, 'Enrolled']}
                  />
                  <Bar
                    dataKey="students"
                    fill="url(#barGradient)"
                    radius={[10, 10, 0, 0]}
                    maxBarSize={56}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* Semester Distribution Donut */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.27 }}
          className="bg-white p-6 rounded-[22px] shadow-sm border border-gray-100"
        >
          <div className="mb-3">
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
              Semester Distribution
              <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                Live · Batches
              </span>
            </h3>
            <p className="text-xs font-medium text-gray-400 mt-0.5">How many batches reside in each semester</p>
          </div>
          <div className="h-[260px]">
            {semesterDistribution.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                  <Layers className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-sm font-bold text-gray-500">No semester data yet</p>
                <p className="text-xs text-gray-400">Assign current_semester to batches.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={semesterDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {semesterDistribution.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '14px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 10px 25px -10px rgba(0,0,0,0.15)',
                      fontWeight: 700,
                      fontSize: 12
                    }}
                    formatter={(value: any) => [`${value} batches`, 'Active']}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, fontWeight: 700 }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>
      </div>

      {/* Row 2 — Semester-wise Student Population (sum of all batches per semester — unique, NOT per-batch) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32 }}
        className="bg-white p-6 rounded-[22px] shadow-sm border border-gray-100"
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
              Semester-wise Student Population
              <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                Live · Aggregated
              </span>
            </h3>
            <p className="text-xs font-medium text-gray-400 mt-0.5">
              Total enrolled students grouped by current semester (combined across all active batches)
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
            <span className="inline-flex items-center gap-1.5 text-gray-500">
              <span className="w-3 h-3 rounded-full bg-gradient-to-br from-pink-400 to-fuchsia-600 shadow-sm" />
              Students
            </span>
          </div>
        </div>
        <div className="h-[240px]">
          {semesterPopulation.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2 px-6">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                <Users className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-sm font-bold text-gray-500">No aggregate data yet</p>
              <p className="text-xs text-gray-400 max-w-md">
                This chart combines student counts across all batches by their current semester.
                Once batches have current_semester + student counts filled, totals appear here.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={semesterPopulation} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="popGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: '#fdf4ff' }}
                  contentStyle={{
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 25px -10px rgba(236, 72, 153, 0.35)',
                    fontWeight: 700,
                    fontSize: 12
                  }}
                  formatter={(value: any) => [`${value} students`, 'Total Enrolled']}
                />
                <Bar
                  dataKey="students"
                  fill="url(#popGradient)"
                  radius={[10, 10, 0, 0]}
                  maxBarSize={72}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default DashboardStats;
