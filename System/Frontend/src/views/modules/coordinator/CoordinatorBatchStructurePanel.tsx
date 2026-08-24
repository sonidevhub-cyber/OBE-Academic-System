import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Network } from 'lucide-react';
import { BatchStructureGA } from '../../../api/batchService';
import useBatchStructure from '../../../hooks/useBatchStructure';

interface CoordinatorBatchStructurePanelProps {
  batchId?: string | null;
  semester?: number | string | null;
  onGasChange?: (gas: BatchStructureGA[]) => void;
}

const gaLabel = (ga: { ga_code?: string; ga_title?: string }) => ga.ga_code || ga.ga_title || 'GA';

const CoordinatorBatchStructurePanel: React.FC<CoordinatorBatchStructurePanelProps> = ({
  batchId,
  semester,
  onGasChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data, loading, error } = useBatchStructure(batchId, semester);

  useEffect(() => {
    onGasChange?.(data?.ga_snapshot || []);
  }, [data, onGasChange]);

  return (
    <section className="bg-white rounded-[32px] border border-gray-100 shadow-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(open => !open)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Network size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Batch Structure Reference</h3>
            <p className="text-xs font-bold text-gray-400 mt-1">
              {data?.batch_name || 'Select a batch and semester to load CLO-GA context'}
            </p>
          </div>
        </div>
        {isOpen ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
      </button>

      {isOpen && (
        <div className="border-t border-gray-100 p-6">
          {!batchId ? (
            <div className="rounded-2xl bg-gray-50 p-5 text-sm font-bold text-gray-500">
              Choose a batch to view its course and CLO structure.
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-gray-50 p-6 text-sm font-bold text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              Loading structure
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-red-50 p-5 text-sm font-bold text-red-700">{error}</div>
          ) : data && data.courses.length > 0 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Valid GAs for this batch</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(data.ga_snapshot || []).map(ga => (
                      <span key={ga.id} className="rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-black text-indigo-700">
                        {ga.code || `GA-${ga.order_number || ''}`.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {data.courses.map(course => (
                <div key={course.course_id} className="rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-black text-gray-900">{course.course_code ? `${course.course_code} - ` : ''}{course.course_name}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Semester {course.semester_number || semester || '-'}</div>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {course.clos.length > 0 ? course.clos.map(clo => (
                      <div key={clo.clo_id} className="px-4 py-3 grid grid-cols-1 lg:grid-cols-[160px_minmax(0,1fr)_minmax(180px,320px)] gap-3">
                        <div className="font-black text-indigo-700 text-sm">{clo.clo_number}</div>
                        <div className="text-sm font-semibold text-gray-700">{clo.title || 'Untitled CLO'}</div>
                        <div className="flex flex-wrap gap-2">
                          {clo.mapped_gas.length > 0 ? clo.mapped_gas.map(ga => (
                            <span key={`${clo.clo_id}-${ga.ga_id}`} className="rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                              {gaLabel(ga)}
                            </span>
                          )) : (
                            <span className="text-xs font-bold text-gray-400">No mapped GAs</span>
                          )}
                        </div>
                      </div>
                    )) : (
                      <div className="px-4 py-5 text-sm font-bold text-gray-400">No CLOs found for this course.</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-gray-50 p-5 text-sm font-bold text-gray-500">
              No courses found for the selected semester.
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default CoordinatorBatchStructurePanel;
