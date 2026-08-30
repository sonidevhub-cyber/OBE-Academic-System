import React, { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Archive, Award, Download, Filter, Info, Loader2, RefreshCw, Target } from 'lucide-react';
import batchService, {
  BatchFlat,
  BatchFrameworkSnapshotField,
  BatchStructureGA,
  BatchStructurePEO,
  BatchStructureResponse,
} from '../../../api/batchService';
import useBatchStructure from '../../../hooks/useBatchStructure';
import { toast } from 'react-toastify';

const formatDate = (value: string | null) => {
  if (!value) return 'Not locked';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const gaLabel = (ga: BatchStructureGA) => ga.code || `GA-${ga.order_number || ''}`.trim();
const peoLabel = (peo: BatchStructurePEO) => `PO-${peo.order_number || ''}`.trim();
const keywordText = (keyword: { text?: string } | string) => typeof keyword === 'string' ? keyword : keyword.text || '';
const safeFilePart = (value: string) => value.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'batch_structure';
const percentText = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? `${number.toFixed(1)}%` : '-';
};

const getEmptySnapshotFields = (structure: BatchStructureResponse | null): BatchFrameworkSnapshotField[] => {
  if (!structure) return [];
  if (structure.snapshot_empty_fields) {
    return (Object.entries(structure.snapshot_empty_fields) as Array<[BatchFrameworkSnapshotField, boolean]>)
      .filter(([, isEmpty]) => isEmpty)
      .map(([field]) => field);
  }
  const hasVisionMission = (structure.vision_mission_snapshot || []).some(item =>
    Boolean(item.statement || (item.keywords || []).length > 0)
  );
  const emptyFields: BatchFrameworkSnapshotField[] = [];
  if ((structure.ga_snapshot || []).length === 0) emptyFields.push('ga');
  if ((structure.peo_snapshot || []).length === 0) emptyFields.push('peo');
  if (!hasVisionMission) emptyFields.push('vision_mission');
  return emptyFields;
};

const snapshotFieldLabel: Record<BatchFrameworkSnapshotField, string> = {
  ga: 'GA', peo: 'PO', vision_mission: 'Vision/Mission',
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

const downloadBatchStructurePdf = (structure: BatchStructureResponse, gaById: Map<string, BatchStructureGA>) => {
  const pdf = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 14;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('Batch Structure', margin, 15);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`Batch: ${structure.batch_name}`, margin, 22);
  pdf.text(`Snapshot Locked: ${formatDate(structure.snapshot_locked_date)}`, margin, 28);
  pdf.text(`Generated: ${formatDate(new Date().toISOString())}`, pageWidth - margin, 22, { align: 'right' });

  autoTable(pdf, {
    startY: 36,
    head: [['Type', 'Statement', 'Keywords']],
    body: (structure.vision_mission_snapshot || []).map(item => [
      item.statement_type || '-',
      item.statement || '-',
      (item.keywords || []).map(keywordText).filter(Boolean).join(', ') || '-',
    ]),
    styles: { fontSize: 8, cellPadding: 3, valign: 'top' },
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 145 }, 2: { cellWidth: 90 } },
  });

  let y = ((pdf as any).lastAutoTable?.finalY || 36) + 8;

  // Grouped PO keyword mapping for PDF
  const poMapPdf = new Map<string, { po_code: string; po_title: string; mission: string[]; vision: string[] }>();
  (structure.po_keyword_mappings || []).forEach(mapping => {
    const key = mapping.po_id || mapping.po_code || '';
    if (!poMapPdf.has(key)) poMapPdf.set(key, { po_code: mapping.po_code || 'PO', po_title: mapping.po_title || '', mission: [], vision: [] });
    const entry = poMapPdf.get(key)!;
    if (mapping.mission_keyword && !entry.mission.includes(mapping.mission_keyword)) entry.mission.push(mapping.mission_keyword);
    if (mapping.vision_keyword && !entry.vision.includes(mapping.vision_keyword)) entry.vision.push(mapping.vision_keyword);
  });
  const pdfPoRows = Array.from(poMapPdf.values()).sort((a, b) => {
    const aNum = parseInt(a.po_code.replace(/\D/g, ''), 10);
    const bNum = parseInt(b.po_code.replace(/\D/g, ''), 10);
    return (Number.isFinite(aNum) && Number.isFinite(bNum)) ? aNum - bNum : a.po_code.localeCompare(b.po_code);
  });

  autoTable(pdf, {
    startY: y,
    head: [['PO', 'PO Title', 'Mission Keywords', 'Vision Keywords']],
    body: pdfPoRows.map(row => [row.po_code, row.po_title, row.mission.join(', ') || '-', row.vision.join(', ') || '-']),
    styles: { fontSize: 8, cellPadding: 3, valign: 'top' },
    headStyles: { fillColor: [219, 39, 119], textColor: 255 },
  });

  y = ((pdf as any).lastAutoTable?.finalY || y) + 8;

  autoTable(pdf, {
    startY: y,
    head: [['PO', 'Title', 'Description', 'Linked GAs']],
    body: (structure.peo_snapshot || []).map(peo => [
      peoLabel(peo),
      peo.title || 'Program Outcome',
      peo.description || '-',
      sortMappedGAs(peo.ga_mappings || []).map(mapping => {
        const ga = mapping.ga_id ? gaById.get(String(mapping.ga_id)) : undefined;
        return ga ? `${gaLabel(ga)} - ${ga.title}` : mapping.ga_code || 'GA';
      }).join(', ') || '-',
    ]),
    styles: { fontSize: 8, cellPadding: 3, valign: 'top' },
    headStyles: { fillColor: [15, 118, 110], textColor: 255 },
    columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 55 }, 2: { cellWidth: 120 }, 3: { cellWidth: 68 } },
  });

  y = ((pdf as any).lastAutoTable?.finalY || y) + 8;

  autoTable(pdf, {
    startY: y,
    head: [['GA', 'Title', 'Description', 'KPI']],
    body: sortGAs(structure.ga_snapshot || []).map(ga => [
      gaLabel(ga), ga.title || '-', ga.description || '-', percentText(ga.kpi_threshold),
    ]),
    styles: { fontSize: 8, cellPadding: 3, valign: 'top' },
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 65 }, 2: { cellWidth: 145 }, 3: { cellWidth: 25 } },
  });

  y = ((pdf as any).lastAutoTable?.finalY || y) + 8;

  if ((structure.courses || []).length > 0) {
    autoTable(pdf, {
      startY: y,
      head: [['Semester', 'Course', 'CLO', 'Mapped GAs']],
      body: structure.courses.flatMap(course => {
        if (!course.clos.length) return [[course.semester_number || '-', course.course_name || '-', '-', '-']];
        return course.clos.map(clo => [
          course.semester_number || '-',
          course.course_name || '-',
          `${clo.clo_number || 'CLO'} - ${clo.title || '-'}`,
          sortMappedGAs(clo.mapped_gas || []).map(ga => ga.ga_code ? `${ga.ga_code} - ${ga.ga_title}` : ga.ga_title).join(', ') || '-',
        ]);
      }),
      styles: { fontSize: 8, cellPadding: 3, valign: 'top' },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 75 }, 2: { cellWidth: 105 }, 3: { cellWidth: 63 } },
    });
  }

  pdf.save(`${safeFilePart(structure.batch_name)}_batch_structure.pdf`);
};

const HODBatchStructureView: React.FC = () => {
  const [batches, setBatches] = useState<BatchFlat[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [copyingSnapshot, setCopyingSnapshot] = useState(false);

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

  const filteredBatches = useMemo(() => batches.filter(batch => {
    const matchesProgram = programFilter === 'all' || String(batch.program_id || batch.program?.id) === programFilter;
    const matchesStatus = statusFilter === 'all' || batch.status === statusFilter;
    return matchesProgram && matchesStatus;
  }), [batches, programFilter, statusFilter]);

  useEffect(() => {
    if (!filteredBatches.length) { setSelectedBatchId(''); return; }
    if (!filteredBatches.some(batch => batch.id === selectedBatchId)) setSelectedBatchId('');
  }, [filteredBatches, selectedBatchId]);

  const { data: structure, loading: structureLoading, error: structureError, refetch: refetchStructure } = useBatchStructure(selectedBatchId);

  const gaById = useMemo(() => {
    const map = new Map<string, BatchStructureGA>();
    (structure?.ga_snapshot || []).forEach(ga => map.set(String(ga.id), ga));
    return map;
  }, [structure]);

  const emptySnapshotFields = useMemo(() => getEmptySnapshotFields(structure), [structure]);
  const hasEmptySnapshotFields = emptySnapshotFields.length > 0;

  const handleCopyCurrentFramework = async () => {
    if (!selectedBatchId || emptySnapshotFields.length === 0) return;
    setCopyingSnapshot(true);
    try {
      const response = await batchService.copyFrameworkSnapshot(selectedBatchId, emptySnapshotFields);
      const copied = Object.keys(response.data.copied || {});
      const errors = Object.values(response.data.errors || {}).filter(Boolean);
      if (copied.length > 0) toast.success(`Copied current framework: ${copied.map(f => snapshotFieldLabel[f as BatchFrameworkSnapshotField]).join(', ')}`);
      errors.forEach(message => toast.error(message));
      await refetchStructure();
    } catch (error: any) {
      const data = error?.response?.data;
      const messages = data?.errors ? Object.values(data.errors).filter(Boolean) : [];
      if (messages.length > 0) messages.forEach(message => toast.error(String(message)));
      else toast.error(data?.detail || data?.error || error?.message || 'Failed to copy current framework');
    } finally {
      setCopyingSnapshot(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top bar: filters + batch selector */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-gray-900 font-black uppercase tracking-widest text-sm mr-2">
            <Archive size={18} className="text-indigo-600" />
            Batch Structure
          </div>
          <label className="flex flex-col gap-1 min-w-[160px]">
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <Filter size={12} /> Program
            </span>
            <select
              value={programFilter}
              onChange={e => setProgramFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Programs</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 min-w-[130px]">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="graduated">Graduated</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 min-w-[220px] flex-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Batch</span>
            {loadingBatches ? (
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-400">
                <Loader2 size={13} className="animate-spin" /> Loading...
              </div>
            ) : batchError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{batchError}</div>
            ) : (
              <select
                value={selectedBatchId}
                onChange={e => setSelectedBatchId(e.target.value)}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a batch</option>
                {filteredBatches.map(batch => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name} — {batch.program_name || batch.program?.name || 'Program'} ({batch.status || 'active'})
                  </option>
                ))}
              </select>
            )}
          </label>
        </div>
      </div>

      {/* Batch header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">Selected Batch</p>
            <h2 className="mt-1 text-2xl font-black text-gray-900">{structure?.batch_name || 'Select a batch'}</h2>
          </div>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Snapshot Locked</p>
            <p className="text-sm font-bold text-indigo-900">{formatDate(structure?.snapshot_locked_date || null)}</p>
          </div>
          {hasEmptySnapshotFields && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Missing Snapshot</p>
                <p className="text-xs font-bold text-amber-800">{emptySnapshotFields.map(f => snapshotFieldLabel[f]).join(', ')}</p>
              </div>
              <button
                type="button"
                onClick={handleCopyCurrentFramework}
                disabled={copyingSnapshot || structureLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-black text-white shadow-sm transition-all hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copyingSnapshot ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                Copy Current Framework
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => structure && downloadBatchStructurePdf(structure, gaById)}
            disabled={!structure || structureLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-black text-white shadow-sm transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={16} />
            Download PDF
          </button>
        </div>
      </div>

      {structureLoading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 font-bold">
          <Loader2 size={24} className="animate-spin mx-auto mb-3" />
          Loading structure
        </div>
      ) : structureError ? (
        <div className="bg-red-50 rounded-2xl border border-red-100 p-6 text-red-700 font-bold">{structureError}</div>
      ) : structure ? (
        <>
          {/* Vision & Mission */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <Target size={18} className="text-indigo-600" />
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-widest">Vision &amp; Mission</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {(structure.vision_mission_snapshot || []).map(item => (
                <div key={`${item.statement_type}-${item.id || item.statement}`} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600">{item.statement_type}</div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-gray-700">{item.statement || 'No statement captured.'}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(item.keywords || []).map((keyword, index) => {
                      const text = keywordText(keyword);
                      return text ? (
                        <span key={`${text}-${index}`} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-600 border border-gray-200">{text}</span>
                      ) : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* PO Keyword Mapping — grouped per PO */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <Target size={18} className="text-emerald-600" />
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-widest">PO Keyword Mapping</h3>
            </div>
            {(structure.po_keyword_mappings || []).length > 0 ? (() => {
              const poMap = new Map<string, { po_code: string; po_title: string; mission: string[]; vision: string[] }>();
              (structure.po_keyword_mappings || []).forEach(mapping => {
                const key = mapping.po_id || mapping.po_code || '';
                if (!poMap.has(key)) poMap.set(key, { po_code: mapping.po_code || 'PO', po_title: mapping.po_title || '', mission: [], vision: [] });
                const entry = poMap.get(key)!;
                if (mapping.mission_keyword && !entry.mission.includes(mapping.mission_keyword)) entry.mission.push(mapping.mission_keyword);
                if (mapping.vision_keyword && !entry.vision.includes(mapping.vision_keyword)) entry.vision.push(mapping.vision_keyword);
              });
              const rows = Array.from(poMap.values()).sort((a, b) => {
                const aNum = parseInt(a.po_code.replace(/\D/g, ''), 10);
                const bNum = parseInt(b.po_code.replace(/\D/g, ''), 10);
                return (Number.isFinite(aNum) && Number.isFinite(bNum)) ? aNum - bNum : a.po_code.localeCompare(b.po_code);
              });
              return (
                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                  <table className="min-w-[640px] w-full border-collapse text-left">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-100 w-20">PO</th>
                        <th className="px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-100">PO Title</th>
                        <th className="px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-100">Mission Keywords</th>
                        <th className="px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-100">Vision Keywords</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map(row => (
                        <tr key={row.po_code} className="align-top hover:bg-gray-50">
                          <td className="px-4 py-4 font-black text-emerald-700">{row.po_code}</td>
                          <td className="px-4 py-4 text-sm font-semibold text-gray-700">{row.po_title || '-'}</td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {row.mission.length > 0 ? row.mission.map(kw => (
                                <span key={kw} className="rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">{kw}</span>
                              )) : <span className="text-xs text-gray-400">—</span>}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {row.vision.length > 0 ? row.vision.map(kw => (
                                <span key={kw} className="rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-black text-indigo-700">{kw}</span>
                              )) : <span className="text-xs text-gray-400">—</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })() : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm font-bold text-gray-400">
                No PO keyword mappings captured in this batch snapshot.
              </div>
            )}
          </section>

          {/* Program Outcomes & Linked GAs */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <Award size={18} className="text-indigo-600" />
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-widest">Program Outcomes &amp; Linked GAs</h3>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-gray-100">
              <table className="min-w-[760px] w-full border-collapse text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-100">PO</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-100">Description</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-100">Linked GAs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(structure.peo_snapshot || []).map(peo => (
                    <tr key={peo.id} className="align-top hover:bg-gray-50">
                      <td className="px-4 py-4 w-36">
                        <div className="font-black text-indigo-700">{peoLabel(peo)}</div>
                        <div className="text-xs font-semibold text-gray-500">{peo.title || 'Program Outcome'}</div>
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold leading-6 text-gray-700">{peo.description}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {(peo.ga_mappings || []).length > 0 ? sortMappedGAs(peo.ga_mappings || []).map((mapping, index) => {
                            const ga = mapping.ga_id ? gaById.get(String(mapping.ga_id)) : undefined;
                            return (
                              <span key={`${peo.id}-${mapping.ga_id || index}`} className="rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-black text-indigo-700">
                                {ga ? gaLabel(ga) : mapping.ga_code || 'GA'}
                              </span>
                            );
                          }) : <span className="text-xs font-bold text-gray-400">No linked GAs</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* GA Details */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <Info size={18} className="text-indigo-600" />
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-widest">GA Details</h3>
            </div>
            {sortGAs(structure.ga_snapshot || []).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sortGAs(structure.ga_snapshot || []).map(ga => (
                  <div key={ga.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-indigo-700">{gaLabel(ga)}</div>
                        <h4 className="mt-1 font-black text-gray-900">{ga.title || 'Graduate Attribute'}</h4>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-gray-500 border border-gray-200">
                        KPI {percentText(ga.kpi_threshold)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-6 text-gray-600">{ga.description || 'No description captured.'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm font-bold text-gray-400">
                No GA details captured in this batch snapshot.
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 font-bold">
          Select a batch to view its locked structure.
        </div>
      )}
    </div>
  );
};

export default HODBatchStructureView;
