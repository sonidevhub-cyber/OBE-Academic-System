import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Unlock, ChevronDown, ChevronUp, Target, Award, Loader2, AlertCircle } from 'lucide-react';
import { useFrameworkSnapshot } from '../../hooks/useFrameworkSnapshot';
import type { PEOSnapshotItem, GASnapshotItem } from '../../api/obeService';

interface BatchFrameworkBannerProps {
  batchId: string | null | undefined;
  batchName?: string | null;
  className?: string;
}

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return 'Not locked';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

const PEOSnapshotList: React.FC<{ peos: PEOSnapshotItem[] }> = ({ peos }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-indigo-600">
      <Target size={14} />
      <span>Program Outcomes (PO)</span>
      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-700">{peos.length}</span>
    </div>
    <div className="overflow-x-auto rounded-2xl border border-indigo-100 bg-white shadow-sm">
      <table className="min-w-full table-fixed border-collapse text-left">
        <thead className="bg-indigo-50/60">
          <tr>
            <th className="w-20 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-500 border-b border-indigo-100">
              PO #
            </th>
            <th className="w-32 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-500 border-b border-indigo-100">
              Title
            </th>
            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-500 border-b border-indigo-100">
              Description
            </th>
            <th className="w-24 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-500 border-b border-indigo-100">
              KPI Target
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-indigo-50">
          {peos.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-3 py-4 text-center text-xs font-medium text-indigo-300">
                No PO data in snapshot
              </td>
            </tr>
          ) : (
            peos.map((po) => (
              <tr key={po.id} className="align-top hover:bg-indigo-50/30 transition-colors">
                <td className="px-3 py-2 text-sm font-black text-indigo-900 border-r border-indigo-50">
                  PO-{po.order_number}
                </td>
                <td className="px-3 py-2 text-xs font-bold text-indigo-800 border-r border-indigo-50 whitespace-normal break-words">
                  {po.title || '—'}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600 border-r border-indigo-50 whitespace-normal break-words">
                  {po.description}
                </td>
                <td className="px-3 py-2 text-sm font-black text-indigo-700 whitespace-nowrap">
                  {po.kpi_threshold.toFixed(1)}%
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const GASnapshotList: React.FC<{ gas: GASnapshotItem[] }> = ({ gas }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-emerald-600">
      <Award size={14} />
      <span>Graduate Attributes (GA)</span>
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">{gas.length}</span>
    </div>
    <div className="overflow-x-auto rounded-2xl border border-emerald-100 bg-white shadow-sm">
      <table className="min-w-full table-fixed border-collapse text-left">
        <thead className="bg-emerald-50/60">
          <tr>
            <th className="w-20 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-500 border-b border-emerald-100">
              Code
            </th>
            <th className="w-40 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-500 border-b border-emerald-100">
              Title
            </th>
            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-500 border-b border-emerald-100">
              Description
            </th>
            <th className="w-24 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-500 border-b border-emerald-100">
              KPI Target
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-emerald-50">
          {gas.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-3 py-4 text-center text-xs font-medium text-emerald-300">
                No GA data in snapshot
              </td>
            </tr>
          ) : (
            gas.map((ga) => (
              <tr key={ga.id} className="align-top hover:bg-emerald-50/30 transition-colors">
                <td className="px-3 py-2 text-sm font-black text-emerald-900 border-r border-emerald-50 whitespace-nowrap">
                  {ga.code || `GA-${ga.order_number}`}
                </td>
                <td className="px-3 py-2 text-xs font-bold text-emerald-800 border-r border-emerald-50 whitespace-normal break-words">
                  {ga.title}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600 border-r border-emerald-50 whitespace-normal break-words">
                  {ga.description}
                </td>
                <td className="px-3 py-2 text-sm font-black text-emerald-700 whitespace-nowrap">
                  {ga.kpi_threshold.toFixed(1)}%
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const BatchFrameworkBanner: React.FC<BatchFrameworkBannerProps> = ({ batchId, batchName, className = '' }) => {
  const [collapsed, setCollapsed] = useState(true);
  const { data, loading, error } = useFrameworkSnapshot(batchId);

  const hasValidBatch = Boolean(batchId);
  const isLocked = Boolean(data?.is_locked);
  const lockedDate = data?.snapshot_locked_date ?? null;

  if (!hasValidBatch) {
    return null;
  }

  const headerLabel = batchName ? `${batchName} — Batch Framework` : 'Batch Framework';
  const lockedLabel = isLocked ? 'Locked' : 'Draft';

  return (
    <div
      className={`w-full rounded-[22px] border bg-white shadow-sm overflow-hidden transition-all duration-300 ${
        isLocked ? 'border-slate-200' : 'border-amber-200'
      } ${className}`}
    >
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-3 px-5 py-3 text-left transition-all duration-200 hover:brightness-[0.98] ${
          isLocked
            ? 'bg-gradient-to-r from-slate-50 via-slate-100/60 to-gray-50 hover:from-slate-100/80 hover:to-slate-100/40'
            : 'bg-gradient-to-r from-amber-50 via-amber-100/60 to-amber-50 hover:from-amber-100/80 hover:to-amber-100/40'
        }`}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm border ${
              isLocked
                ? 'bg-slate-900 text-slate-50 border-slate-800'
                : 'bg-amber-500 text-white border-amber-600'
            }`}
          >
            {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-sm font-black truncate ${isLocked ? 'text-slate-900' : 'text-amber-900'}`}>
                {headerLabel} — {lockedLabel}
              </span>
              {loading && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-sm">
                  <Loader2 size={10} className="animate-spin" />
                  Loading
                </span>
              )}
              {!loading && lockedDate && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black shadow-sm ${
                    isLocked
                      ? 'bg-slate-900 text-slate-100'
                      : 'bg-amber-600 text-white'
                  }`}
                >
                  {formatDate(lockedDate)}
                </span>
              )}
              {error && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 shadow-sm">
                  <AlertCircle size={10} />
                  Unavailable
                </span>
              )}
            </div>
            <p className={`text-[11px] font-semibold ${isLocked ? 'text-slate-500' : 'text-amber-600'}`}>
              Reference-only snapshot for CLO/GA mapping — no edits allowed
            </p>
          </div>
        </div>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            isLocked ? 'bg-slate-900/10 text-slate-700' : 'bg-amber-500/15 text-amber-700'
          }`}
        >
          {collapsed ? <ChevronDown size={18} strokeWidth={2.5} /> : <ChevronUp size={18} strokeWidth={2.5} />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 px-5 py-4 space-y-4 bg-gradient-to-b from-white via-slate-50/30 to-slate-50/50">
              {loading ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="h-40 animate-pulse rounded-2xl bg-slate-100 border border-slate-200" />
                  <div className="h-40 animate-pulse rounded-2xl bg-slate-100 border border-slate-200" />
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>Framework snapshot could not be loaded.</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-rose-500">{error}</p>
                </div>
              ) : data ? (
                <div className="space-y-4">
                  <PEOSnapshotList peos={data.peo_snapshot ?? []} />
                  <GASnapshotList gas={data.ga_snapshot ?? []} />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-6 text-center text-xs font-semibold text-slate-400">
                  No snapshot data available for this batch.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BatchFrameworkBanner;
