import React, { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Archive, BookOpen, Download, Filter, Loader2, Network } from 'lucide-react';
import batchService, { BatchFlat, BatchStructureGA, BatchStructureResponse } from '../../../api/batchService';
import useBatchStructure from '../../../hooks/useBatchStructure';

const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'graduated', label: 'Graduated' },
];

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'Not locked';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const safeFilePart = (value: string) => value.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'batch_structure';
const percentText = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? `${number.toFixed(1)}%` : '-';
};

const gaLabelShort = (ga: { code?: string; order_number?: number; title?: string }) =>
  ga.code || `GA-${ga.order_number || ''}`.trim() || 'GA';

const gaLabelFull = (ga: { code?: string; order_number?: number; title?: string }) => {
  const short = gaLabelShort(ga);
  const title = ga.title?.trim();
  return title && title !== short ? `${short} — ${title}` : short;
};

const sortGAs = <T extends { order_number?: number; code?: string; id?: string }>(gas: T[]) =>
  [...gas].sort((a, b) => {
    const aNum = Number(a.order_number ?? parseInt(String(a.code || '').replace(/\D/g, ''), 10));
    const bNum = Number(b.order_number ?? parseInt(String(b.code || '').replace(/\D/g, ''), 10));
    if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) return aNum - bNum;
    return String(a.code || a.id || '').localeCompare(String(b.code || b.id || ''));
  });

const sortMappedGAs = <T extends { ga_code?: string; ga_id?: string; order_number?: number }>(gas: T[]) =>
  [...gas].sort((a, b) => {
    const aNum = Number(a.order_number ?? parseInt(String(a.ga_code || '').replace(/\D/g, ''), 10));
    const bNum = Number(b.order_number ?? parseInt(String(b.ga_code || '').replace(/\D/g, ''), 10));
    if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) return aNum - bNum;
    return String(a.ga_code || a.ga_id || '').localeCompare(String(b.ga_code || b.ga_id || ''));
  });

const downloadBatchStructurePdf = (structure: BatchStructureResponse, semester: string) => {
  const pdf = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 14;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('Batch Structure Reference', margin, 15);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`Batch: ${structure.batch_name}`, margin, 22);
  pdf.text(`Snapshot Locked: ${formatDate(structure.snapshot_locked_date)}`, margin, 28);
  if (semester) pdf.text(`Semester: ${semester}`, margin, 34);
  pdf.text(`Generated: ${formatDate(new Date().toISOString())}`, pageWidth - margin, 22, { align: 'right' });

  const sortedGAs = sortGAs(structure.ga_snapshot || []);

  let startY = semester ? 42 : 36;

  autoTable(pdf, {
    startY,
    head: [['GA Code', 'GA Title', 'Description', 'KPI Threshold']],
    body: sortedGAs.map(ga => [
      gaLabelShort(ga),
      ga.title || '-',
      ga.description || '-',
      percentText(ga.kpi_threshold),
    ]),
    styles: { fontSize: 8, cellPadding: 3, valign: 'top' },
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 60 },
      2: { cellWidth: 150 },
      3: { cellWidth: 28 },
    },
  });

  let y = ((pdf as any).lastAutoTable?.finalY || startY) + 8;

  const sortedCourses = [...(structure.courses || [])].sort((a, b) => {
    const sA = Number(a.semester_number || 0);
    const sB = Number(b.semester_number || 0);
    if (sA !== sB) return sA - sB;
    return String(a.course_code || a.course_name || '').localeCompare(String(b.course_code || b.course_name || ''));
  });

  if (sortedCourses.length > 0) {
    autoTable(pdf, {
      startY: y,
      head: [['Semester', 'Course', 'CLO', 'Mapped GAs']],
      body: sortedCourses.flatMap(course => {
        if (!course.clos || course.clos.length === 0) {
          return [[course.semester_number || '-', `${course.course_code || ''} ${course.course_name || '-'}`.trim(), '-', '-']];
        }
        return course.clos.map(clo => [
          course.semester_number || '-',
          `${course.course_code || ''} ${course.course_name || '-'}`.trim(),
          `${clo.clo_number || 'CLO'} — ${clo.title || '-'}`,
          sortMappedGAs(clo.mapped_gas || []).map(ga => ga.ga_code ? `${ga.ga_code} — ${ga.ga_title || ''}` : ga.ga_title).join(', ') || '-',
        ]);
      }),
      styles: { fontSize: 8, cellPadding: 3, valign: 'top' },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 70 },
        2: { cellWidth: 100 },
        3: { cellWidth: 74 },
      },
    });
  }

  pdf.save(`${safeFilePart(structure.batch_name)}_batch_structure.pdf`);
};

const CoordinatorBatchStructureView: React.FC = () => {
  const [batches, setBatches] = useState<BatchFlat[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [programFilter, setProgramFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [batchError, setBatchError] = useState<string | null>(null);

  useEffect(() => {
    const loadBatches = async () => {
      setLoadingBatches(true);
      setBatchError(null);
      try {
        const response = await batchService.getAllBatches({ alumni_feedback: 'all' });
        const list = Array.isArray(response.data) ? response.data : [];
        setBatches(list);
        setSelectedBatchId(current => current || list[0]?.id || '');
      } catch (error: any) {
        setBatchError(error?.response?.data?.detail || error?.message || 'Failed to load batches');
        setBatches([]);
      } finally {
        setLoadingBatches(false);
      }
    };

    void loadBatches();
  }, []);

  const programs = useMemo(() => {
    const seen = new Map<string, string>();
    batches.forEach(batch => {
      const id = batch.program_id || batch.program?.id || batch.program_name || 'unknown';
      const name = batch.program_name || batch.program?.name || 'Unknown Program';
      seen.set(String(id), name);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [batches]);

  const filteredBatches = useMemo(() => {
    return batches.filter(batch => {
      const matchesProgram = programFilter === 'all' || String(batch.program_id || batch.program?.id) === programFilter;
      const matchesStatus = statusFilter === 'all' || String(batch.status || 'active') === statusFilter;
      return matchesProgram && matchesStatus;
    });
  }, [batches, programFilter, statusFilter]);

  const selectedBatch = useMemo(
    () => batches.find(batch => batch.id === selectedBatchId) || null,
    [batches, selectedBatchId]
  );

  const semesterOptions = useMemo(() => {
    const currentSemester = Number(selectedBatch?.current_semester || 0);
    if (!Number.isFinite(currentSemester) || currentSemester <= 0) return [];
    return Array.from({ length: currentSemester }, (_, index) => String(index + 1));
  }, [selectedBatch]);

  useEffect(() => {
    if (!filteredBatches.length) {
      setSelectedBatchId('');
      return;
    }
    if (!filteredBatches.some(batch => batch.id === selectedBatchId)) {
      setSelectedBatchId('');
    }
  }, [filteredBatches, selectedBatchId]);

  useEffect(() => {
    if (!semesterOptions.length) {
      setSelectedSemester('');
      return;
    }
    setSelectedSemester(current => semesterOptions.includes(current) ? current : semesterOptions[semesterOptions.length - 1]);
  }, [semesterOptions]);

  const { data: structure, loading: structureLoading, error: structureError } = useBatchStructure(
    selectedBatchId,
    selectedSemester || undefined
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <label className="min-w-[220px] flex-1">
            <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-gray-400">
              <Filter size={13} />
              Program
            </span>
            <select
              value={programFilter}
              onChange={(event) => setProgramFilter(event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Programs</option>
              {programs.map(program => (
                <option key={program.id} value={program.id}>{program.name}</option>
              ))}
            </select>
          </label>

          <label className="min-w-[180px]">
            <span className="block text-[11px] font-black uppercase tracking-widest text-gray-400">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="min-w-[240px] flex-[1.2]">
            <span className="block text-[11px] font-black uppercase tracking-widest text-gray-400">Batch</span>
            <select
              value={selectedBatchId}
              onChange={(event) => setSelectedBatchId(event.target.value)}
              disabled={loadingBatches || filteredBatches.length === 0}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {filteredBatches.length === 0 ? (
                <option value="">No batches found</option>
              ) : filteredBatches.map(batch => (
                <option key={batch.id} value={batch.id}>{batch.name}</option>
              ))}
            </select>
          </label>

          <label className="min-w-[160px]">
            <span className="block text-[11px] font-black uppercase tracking-widest text-gray-400">Semester</span>
            <select
              value={selectedSemester}
              onChange={(event) => setSelectedSemester(event.target.value)}
              disabled={semesterOptions.length === 0}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {semesterOptions.length === 0 ? (
                <option value="">All</option>
              ) : semesterOptions.map(semester => (
                <option key={semester} value={semester}>Semester {semester}</option>
              ))}
            </select>
          </label>
        </div>

        {batchError ? (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {batchError}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Archive size={22} />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">Batch Structure Reference</p>
              <h2 className="mt-1 text-2xl font-black text-gray-900">{structure?.batch_name || selectedBatch?.name || 'Select a batch'}</h2>
              <p className="mt-1 text-xs font-bold text-gray-400">Snapshot locked: {formatDate(structure?.snapshot_locked_date)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-700">
              {selectedSemester ? `Semester ${selectedSemester}` : 'All semesters'}
            </div>
            <button
              type="button"
              onClick={() => structure && downloadBatchStructurePdf(structure, selectedSemester)}
              disabled={!structure || structureLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={16} />
              Download PDF
            </button>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center gap-2">
            <Network size={16} className="text-indigo-600" />
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-900">Valid GAs for this batch</h3>
          </div>
          {structureLoading ? (
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              Loading GAs
            </div>
          ) : (structure?.ga_snapshot || []).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {sortGAs(structure?.ga_snapshot || []).map(ga => (
                <span
                  key={ga.id}
                  title={ga.description || ga.title || ''}
                  className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700"
                >
                  {gaLabelFull(ga)}
                </span>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm font-bold text-gray-400">
              No GA snapshot captured for this batch.
            </div>
          )}
        </div>
      </section>

      {structureLoading ? (
        <section className="rounded-2xl border border-gray-100 bg-white p-12 text-center font-bold text-gray-400 shadow-sm">
          <Loader2 size={24} className="mx-auto mb-3 animate-spin" />
          Loading course structure
        </section>
      ) : structureError ? (
        <section className="rounded-2xl border border-red-100 bg-red-50 p-6 font-bold text-red-700">
          {structureError}
        </section>
      ) : structure ? (
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <BookOpen size={18} className="text-indigo-600" />
            <h3 className="text-lg font-black uppercase tracking-widest text-gray-900">Courses, CLOs & Mapped GAs</h3>
          </div>

          {[...(structure.courses || [])].sort((a, b) => {
            const sA = Number(a.semester_number || 0);
            const sB = Number(b.semester_number || 0);
            if (sA !== sB) return sA - sB;
            return String(a.course_code || a.course_name || '').localeCompare(String(b.course_code || b.course_name || ''));
          }).length > 0 ? (
            <div className="space-y-4">
              {[...(structure.courses || [])].sort((a, b) => {
                const sA = Number(a.semester_number || 0);
                const sB = Number(b.semester_number || 0);
                if (sA !== sB) return sA - sB;
                return String(a.course_code || a.course_name || '').localeCompare(String(b.course_code || b.course_name || ''));
              }).map(course => (
                <div key={course.course_id} className="overflow-hidden rounded-2xl border border-gray-100">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 px-5 py-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">Semester {course.semester_number || selectedSemester || '-'}</p>
                      <h4 className="mt-1 text-base font-black text-gray-900">
                        {course.course_code ? `${course.course_code} - ` : ''}{course.course_name}
                      </h4>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-gray-500">
                      {(course.clos || []).length} CLOs
                    </span>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {(course.clos || []).length > 0 ? course.clos.map(clo => (
                      <div key={clo.clo_id} className="grid gap-4 px-5 py-4 lg:grid-cols-[140px_minmax(0,1fr)_minmax(220px,360px)]">
                        <div className="font-black text-indigo-700">{clo.clo_number}</div>
                        <div className="text-sm font-semibold leading-6 text-gray-700">{clo.title || 'Untitled CLO'}</div>
                        <div className="flex flex-wrap gap-2">
                          {(clo.mapped_gas || []).length > 0 ? sortMappedGAs(clo.mapped_gas || []).map(ga => (
                            <span
                              key={`${clo.clo_id}-${ga.ga_id}`}
                              className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700"
                            >
                              {ga.ga_code && ga.ga_title ? `${ga.ga_code} — ${ga.ga_title}` : (ga.ga_code || ga.ga_title || 'GA')}
                            </span>
                          )) : (
                            <span className="text-xs font-bold text-gray-400">No mapped GAs</span>
                          )}
                        </div>
                      </div>
                    )) : (
                      <div className="px-5 py-6 text-sm font-bold text-gray-400">No CLOs found for this course.</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm font-bold text-gray-400">
              No courses found for the selected semester.
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-gray-100 bg-white p-12 text-center font-bold text-gray-400 shadow-sm">
          Select a batch to view its course/CLO structure.
        </section>
      )}
    </div>
  );
};

export default CoordinatorBatchStructureView;
