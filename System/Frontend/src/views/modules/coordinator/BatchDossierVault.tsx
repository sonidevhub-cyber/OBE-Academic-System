import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlertCircle,
  Archive,
  Award,
  BookOpen,
  Building,
  Download,
  Filter,
  GraduationCap,
  Link2,
  Loader2,
  Lock,
  Search,
  Target,
} from 'lucide-react';
import {
  useDossierList,
  useFrameworkSnapshot,
} from '../../../hooks/useFrameworkSnapshot';
import obeService from '../../../api/obeService';
import type {
  DossierListItem,
  FrameworkSnapshotResponse,
  GASnapshotItem,
  GAPEOSnapshotMapping,
  PEOSnapshotItem,
  POKeywordSnapshotMapping,
  VisionMissionSnapshotItem,
} from '../../../api/obeService';

interface BatchDossierVaultProps {
  ongoingOnly?: boolean;
}

interface CourseStructureRow {
  courseCode: string;
  courseTitle: string;
  gaCode: string;
  gaTitle: string;
  poCode: string;
  poTitle: string;
  visionKeyword: string;
  missionKeyword: string;
  source: string;
}

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return 'Not locked';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const poCode = (po: PEOSnapshotItem) => `PO-${po.order_number}`;
const percentText = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? `${number.toFixed(1)}%` : '0.0%';
};

const addPdfTable = (
  pdf: jsPDF,
  title: string,
  head: string[],
  body: Array<Array<string | number>>,
  startY: number,
) => {
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, 14, startY);
  autoTable(pdf, {
    startY: startY + 4,
    head: [head],
    body: body.length ? body : [[`No ${title.toLowerCase()} available.`, ...head.slice(1).map(() => '')]],
    styles: { fontSize: 8, cellPadding: 2.5, valign: 'top' },
    headStyles: { fillColor: [49, 46, 129], textColor: 255 },
    margin: { left: 14, right: 14 },
  });
  return ((pdf as any).lastAutoTable?.finalY || startY + 18) + 10;
};

const downloadSnapshotPdf = (
  snapshot: FrameworkSnapshotResponse,
  selectedBatch: DossierListItem,
  structureRows: CourseStructureRow[],
) => {
  const pdf = new jsPDF('landscape', 'mm', 'a4');
  pdf.setProperties({ title: `${selectedBatch.name} Batch Dossier` });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('Batch Dossier Vault', 14, 16);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Batch: ${selectedBatch.name}`, 14, 24);
  pdf.text(`Program: ${selectedBatch.program_name}`, 14, 30);
  pdf.text(`Cohort: ${selectedBatch.start_year}-${selectedBatch.end_year}`, 14, 36);
  pdf.text(`Snapshot: ${snapshot.is_locked ? 'Locked' : 'Draft'} - ${formatDate(snapshot.snapshot_locked_date || selectedBatch.snapshot_locked_date)}`, 14, 42);

  let y = 52;
  y = addPdfTable(
    pdf,
    'Batch Structure Flow',
    ['Course', 'Title', 'GA', 'PO', 'Vision Keyword', 'Mission Keyword', 'Source'],
    structureRows.map((row) => [
      row.courseCode,
      row.courseTitle,
      row.gaCode,
      row.poCode,
      row.visionKeyword,
      row.missionKeyword,
      row.source,
    ]),
    y,
  );

  y = addPdfTable(
    pdf,
    'Program Outcomes (PO) Snapshot',
    ['PO Code', 'Title', 'Description', 'KPI', 'Status'],
    (snapshot.peo_snapshot || []).map((po) => [
      poCode(po),
      po.title || '',
      po.description || '',
      percentText(po.kpi_threshold),
      po.is_active ? 'Active' : 'Inactive',
    ]),
    y,
  );

  y = addPdfTable(
    pdf,
    'Graduate Attributes (GA) Snapshot',
    ['GA Code', 'Title', 'Description', 'KPI', 'Status'],
    (snapshot.ga_snapshot || []).map((ga) => [
      ga.code || `GA-${ga.order_number}`,
      ga.title || '',
      ga.description || '',
      percentText(ga.kpi_threshold),
      ga.is_active ? 'Active' : 'Inactive',
    ]),
    y,
  );

  y = addPdfTable(
    pdf,
    'GA-PO Mappings',
    ['PO', 'PO Title', 'GA', 'GA Title', 'Weight'],
    (snapshot.ga_peo_mappings || []).map((mapping) => [
      mapping.po_code || '',
      mapping.po_title || '',
      mapping.ga_code || '',
      mapping.ga_title || '',
      mapping.weight ? `${mapping.weight}%` : '',
    ]),
    y,
  );

  y = addPdfTable(
    pdf,
    'Vision & Mission Statements',
    ['Type', 'Statement', 'Keywords'],
    (snapshot.vision_mission_snapshot || []).map((item) => [
      item.statement_type,
      item.statement || '',
      (item.keywords || []).map((keyword) => keyword.text).join(', '),
    ]),
    y,
  );

  y = addPdfTable(
    pdf,
    'PO Mission/Vision Keyword Mappings',
    ['PO', 'PO Title', 'Mission Keyword', 'Vision Keyword'],
    (snapshot.po_keyword_mappings || []).map((mapping) => [
      mapping.po_code || '',
      mapping.po_title || '',
      mapping.mission_keyword || '',
      mapping.vision_keyword || '',
    ]),
    y,
  );

  const safeName = selectedBatch.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  pdf.save(`${safeName || 'batch'}-dossier.pdf`);
};

const BatchDossierVault: React.FC<BatchDossierVaultProps> = ({ ongoingOnly = false }) => {
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'graduated'>(ongoingOnly ? 'active' : 'all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [structureRows, setStructureRows] = useState<CourseStructureRow[]>([]);
  const [structureLoading, setStructureLoading] = useState(false);

  const { data: dossierList, loading: listLoading, error: listError } = useDossierList();
  const { data: snapshot, loading: snapshotLoading, error: snapshotError } = useFrameworkSnapshot(selectedBatchId);

  const uniquePrograms = useMemo(() => {
    const programs = new Map<string, string>();
    dossierList.forEach((item) => {
      if (item.program_id && item.program_name) programs.set(item.program_id, item.program_name);
    });
    return Array.from(programs.entries()).map(([id, name]) => ({ id, name }));
  }, [dossierList]);

  const filteredList = useMemo(() => {
    return dossierList.filter((item) => {
      if (ongoingOnly && item.status !== 'active') return false;
      if (programFilter !== 'all' && item.program_id !== programFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const haystack = `${item.name} ${item.program_name} ${item.start_year} ${item.end_year}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [dossierList, ongoingOnly, programFilter, statusFilter, searchTerm]);

  useEffect(() => {
    if (filteredList.length === 0) {
      setSelectedBatchId('');
      return;
    }
    if (!filteredList.some((batch) => batch.id === selectedBatchId)) {
      setSelectedBatchId(filteredList[0].id);
    }
  }, [filteredList, selectedBatchId]);

  const selectedBatch = useMemo(
    () => dossierList.find((batch) => batch.id === selectedBatchId) || null,
    [dossierList, selectedBatchId],
  );

  useEffect(() => {
    let cancelled = false;

    const buildStructureRows = async () => {
      if (!selectedBatchId || !snapshot) {
        setStructureRows([]);
        return;
      }

      setStructureLoading(true);
      try {
        const sessionsResponse = await obeService.getCourseSessions(selectedBatchId);
        const sessions = Array.isArray(sessionsResponse?.sessions) ? sessionsResponse.sessions : [];
        const scoreResults = await Promise.allSettled(
          sessions.map(async (session) => ({
            session,
            scores: await obeService.getCourseGAScores(String(session.id)).catch(() => []),
            matrix: await obeService.getCourseCLOGAMatrix(String(session.course)).catch(() => null),
          })),
        );

        const poMappingsByGa = new Map<string, GAPEOSnapshotMapping[]>();
        (snapshot.ga_peo_mappings || []).forEach((mapping) => {
          const key = String(mapping.ga_id || mapping.ga_code || '');
          if (!key) return;
          const existing = poMappingsByGa.get(key) || [];
          existing.push(mapping);
          poMappingsByGa.set(key, existing);
          if (mapping.ga_code) {
            const codeExisting = poMappingsByGa.get(mapping.ga_code) || [];
            codeExisting.push(mapping);
            poMappingsByGa.set(mapping.ga_code, codeExisting);
          }
        });

        const keywordMappingsByPo = new Map<string, POKeywordSnapshotMapping[]>();
        (snapshot.po_keyword_mappings || []).forEach((mapping) => {
          const keys = [mapping.po_id, mapping.po_code].filter(Boolean).map(String);
          keys.forEach((key) => {
            const existing = keywordMappingsByPo.get(key) || [];
            existing.push(mapping);
            keywordMappingsByPo.set(key, existing);
          });
        });

        const rows: CourseStructureRow[] = [];
        scoreResults.forEach((result) => {
          if (result.status !== 'fulfilled') return;
          const { session, scores, matrix } = result.value;
          const courseCode = session.course_code || session.course?.code || session.course?.course_code || 'Course';
          const courseTitle = session.course_name || session.course?.name || session.course?.course_name || '';
          const rawMatrixGas = matrix?.gas;
          const matrixGas = Array.isArray(rawMatrixGas) ? rawMatrixGas : [];
          const mappedGas = (scores || []).length > 0
            ? (scores || []).map((score: any) => ({
                id: score.ga || score.ga_id,
                code: score.ga_code || score.ga_title?.match(/GA-\d+/)?.[0] || '',
                title: score.ga_title || '',
                source: score.score !== null && score.score !== undefined ? `GA score ${Number(score.score).toFixed(1)}%` : 'Course-GA',
              }))
            : matrixGas.length > 0
              ? matrixGas.map((ga: any) => ({
                  id: ga.id,
                  code: ga.code || '',
                  title: ga.title || '',
                  source: 'CLO-GA mapping',
                }))
              : [];

          mappedGas.forEach((courseGa: any) => {
            const gaCode = courseGa.code || '';
            const gaKeyCandidates = [courseGa.id, gaCode].filter(Boolean).map(String);
            const poMappings = gaKeyCandidates.flatMap((key) => poMappingsByGa.get(key) || []);

            if (poMappings.length === 0) {
              rows.push({
                courseCode,
                courseTitle,
                gaCode: gaCode || courseGa.title || 'GA',
                gaTitle: courseGa.title || '',
                poCode: '-',
                poTitle: '-',
                visionKeyword: '-',
                missionKeyword: '-',
                source: courseGa.source,
              });
              return;
            }

            poMappings.forEach((poMapping) => {
              const keywordMappings = [poMapping.po_id, poMapping.po_code]
                .filter(Boolean)
                .flatMap((key) => keywordMappingsByPo.get(String(key)) || []);
              const mappingsToUse = keywordMappings.length > 0 ? keywordMappings : [null];

              mappingsToUse.forEach((keywordMapping) => {
                rows.push({
                  courseCode,
                  courseTitle,
                  gaCode: poMapping.ga_code || gaCode || 'GA',
                  gaTitle: poMapping.ga_title || courseGa.title || '',
                  poCode: poMapping.po_code || 'PO',
                  poTitle: poMapping.po_title || '',
                  visionKeyword: keywordMapping?.vision_keyword || '-',
                  missionKeyword: keywordMapping?.mission_keyword || '-',
                  source: courseGa.source,
                });
              });
            });
          });
        });

        if (!cancelled) setStructureRows(rows);
      } catch (error) {
        console.error('Failed to build batch structure flow:', error);
        if (!cancelled) setStructureRows([]);
      } finally {
        if (!cancelled) setStructureLoading(false);
      }
    };

    void buildStructureRows();
    return () => {
      cancelled = true;
    };
  }, [selectedBatchId, snapshot]);

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-[22px] border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
            <Archive size={21} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900">Batch Structure</h2>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Course to GA, PO, Vision, and Mission mapping snapshot
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">
            <BookOpen size={12} />
            {filteredList.length} batches
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
            <Lock size={12} />
            {dossierList.filter((d) => d.has_snapshot).length} locked
          </span>
        </div>
      </div>

      <div className="rounded-[22px] border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">
            Snapshot Filters
          </span>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_0.8fr_1.4fr_auto]">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search batch or program..."
              className="h-11 w-full rounded-xl border-2 border-gray-100 bg-white pl-9 pr-3 text-xs font-bold text-gray-700 placeholder:text-gray-300 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            className="h-11 w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-3 text-xs font-bold text-gray-700 focus:border-indigo-400 focus:outline-none"
          >
            <option value="all">All Programs</option>
            {uniquePrograms.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>

          {ongoingOnly ? (
            <div className="inline-flex h-11 items-center rounded-xl border-2 border-emerald-100 bg-emerald-50 px-3 text-xs font-black text-emerald-700">
              Ongoing only
            </div>
          ) : (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'graduated')}
              className="h-11 w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-3 text-xs font-bold text-gray-700 focus:border-indigo-400 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="graduated">Graduated</option>
            </select>
          )}

          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            disabled={filteredList.length === 0 || listLoading}
            className="h-11 w-full rounded-xl border-2 border-indigo-100 bg-indigo-50/60 px-3 text-xs font-black text-indigo-900 focus:border-indigo-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
          >
            {filteredList.length === 0 ? (
              <option value="">No batches found</option>
            ) : (
              filteredList.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name} - {batch.program_name} - {batch.start_year}-{batch.end_year}
                </option>
              ))
            )}
          </select>

          <button
            type="button"
            onClick={() => snapshot && selectedBatch && downloadSnapshotPdf(snapshot, selectedBatch, structureRows)}
            disabled={!snapshot || !selectedBatch || snapshotLoading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
          >
            <Download size={15} />
            PDF
          </button>
        </div>
      </div>

      {listLoading ? (
        <LoadingPanel label="Loading dossier list..." />
      ) : listError ? (
        <ErrorPanel title="Failed to load dossiers" detail={listError} />
      ) : !selectedBatch ? (
        <EmptyPanel />
      ) : (
        <SnapshotPanel
          selectedBatch={selectedBatch}
          snapshot={snapshot}
          structureRows={structureRows}
          structureLoading={structureLoading}
          loading={snapshotLoading}
          error={snapshotError}
        />
      )}
    </div>
  );
};

const LoadingPanel: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex min-h-[420px] items-center justify-center rounded-[22px] border border-gray-100 bg-white shadow-sm">
    <div className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600">
      <Loader2 size={18} className="animate-spin" />
      {label}
    </div>
  </div>
);

const ErrorPanel: React.FC<{ title: string; detail?: string | null }> = ({ title, detail }) => (
  <div className="rounded-[22px] border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
    <div className="flex items-center gap-2">
      <AlertCircle size={16} />
      {title}
    </div>
    {detail ? <p className="mt-1 text-xs font-medium text-rose-500">{detail}</p> : null}
  </div>
);

const EmptyPanel = () => (
  <div className="flex min-h-[420px] items-center justify-center rounded-[22px] border border-dashed border-gray-200 bg-gradient-to-br from-white via-gray-50/40 to-indigo-50/30">
    <div className="space-y-3 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
        <GraduationCap size={28} />
      </div>
      <h3 className="text-lg font-black text-gray-800">No batch selected</h3>
      <p className="mx-auto max-w-sm text-xs font-semibold text-gray-400">
        Select a batch from the top dropdown to inspect its locked framework snapshot.
      </p>
    </div>
  </div>
);

const SnapshotPanel: React.FC<{
  selectedBatch: DossierListItem;
  snapshot: FrameworkSnapshotResponse | null;
  structureRows: CourseStructureRow[];
  structureLoading: boolean;
  loading: boolean;
  error: string | null;
}> = ({ selectedBatch, snapshot, structureRows, structureLoading, loading, error }) => (
  <motion.section
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="overflow-hidden rounded-[22px] border border-gray-100 bg-white shadow-sm"
  >
    <div className="bg-gradient-to-r from-slate-50 via-white to-indigo-50/40 px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-sm ${
            snapshot?.is_locked ? 'border-slate-800 bg-slate-900 text-slate-50' : 'border-amber-600 bg-amber-500 text-white'
          }`}>
            {snapshot?.is_locked ? <Lock size={22} /> : <GraduationCap size={22} />}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-black text-gray-900">{selectedBatch.name}</h3>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                selectedBatch.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {selectedBatch.status}
              </span>
            </div>
            <p className="text-xs font-bold text-gray-500">
              {selectedBatch.program_name} - Cohort {selectedBatch.start_year}-{selectedBatch.end_year}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black text-indigo-700">
                <Building size={10} />
                Sem {selectedBatch.current_semester || 'N/A'}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black ${
                snapshot?.is_locked ? 'bg-slate-900 text-white' : 'bg-amber-100 text-amber-700'
              }`}>
                <Lock size={10} />
                {snapshot?.is_locked ? 'Snapshot Locked' : 'Snapshot Draft'}
              </span>
              <span className="inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[10px] font-black text-indigo-700">
                {formatDate(snapshot?.snapshot_locked_date || selectedBatch.snapshot_locked_date)}
              </span>
            </div>
          </div>
        </div>
        {loading ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-bold text-indigo-600">
            <Loader2 size={12} className="animate-spin" />
            Loading snapshot
          </span>
        ) : null}
      </div>
    </div>

    {loading && !snapshot ? (
      <LoadingPanel label="Loading snapshot..." />
    ) : error ? (
      <div className="p-6">
        <ErrorPanel title="Framework snapshot could not be loaded." detail={error} />
      </div>
    ) : snapshot ? (
      <div className="space-y-8 px-6 py-6">
        <StructureFlowTable rows={structureRows} loading={structureLoading} />
        <PEOSnapshotTable peos={snapshot.peo_snapshot ?? []} />
        <GASnapshotTable gas={snapshot.ga_snapshot ?? []} />
        <GAPEOMappingTable mappings={snapshot.ga_peo_mappings ?? []} />
        <VisionMissionSnapshotTable items={snapshot.vision_mission_snapshot ?? []} />
        <POKeywordMappingTable mappings={snapshot.po_keyword_mappings ?? []} />
      </div>
    ) : (
      <div className="m-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center text-xs font-semibold text-gray-400">
        No framework snapshot exists for this batch yet.
      </div>
    )}
  </motion.section>
);

const SectionTitle: React.FC<{
  icon: React.ReactNode;
  title: string;
  helper: string;
  colorClass: string;
}> = ({ icon, title, helper, colorClass }) => (
  <div className="flex items-center gap-2 pl-1">
    <div className={`flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-sm ${colorClass}`}>
      {icon}
    </div>
    <div>
      <h4 className="text-sm font-black uppercase tracking-wider text-gray-800">{title}</h4>
      <p className="text-[11px] font-semibold text-gray-400">{helper}</p>
    </div>
  </div>
);

const PEOSnapshotTable: React.FC<{ peos: PEOSnapshotItem[] }> = ({ peos }) => (
  <DossierTable
    title={<SectionTitle icon={<Target size={15} />} title="Program Outcomes (PO) Snapshot" helper={`${peos.length} PO records`} colorClass="bg-indigo-600" />}
    headers={['PO Code', 'Title', 'Description', 'KPI Threshold', 'Status']}
    emptyText="No PO snapshot data available."
    rows={peos.map((po) => [
      poCode(po),
      po.title || '',
      po.description,
      percentText(po.kpi_threshold),
      po.is_active ? 'Active' : 'Inactive',
    ])}
  />
);

const GASnapshotTable: React.FC<{ gas: GASnapshotItem[] }> = ({ gas }) => (
  <DossierTable
    title={<SectionTitle icon={<Award size={15} />} title="Graduate Attributes (GA) Snapshot" helper={`${gas.length} GA records`} colorClass="bg-emerald-600" />}
    headers={['GA Code', 'Title', 'Description', 'KPI Threshold', 'Status']}
    emptyText="No GA snapshot data available."
    rows={gas.map((ga) => [
      ga.code || `GA-${ga.order_number}`,
      ga.title,
      ga.description,
      percentText(ga.kpi_threshold),
      ga.is_active ? 'Active' : 'Inactive',
    ])}
  />
);

const StructureFlowTable: React.FC<{ rows: CourseStructureRow[]; loading: boolean }> = ({ rows, loading }) => (
  <DossierTable
    title={
      <SectionTitle
        icon={loading ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
        title="Batch Structure Flow"
        helper={loading ? 'Building course mapping flow...' : `${rows.length} course-to-framework links`}
        colorClass="bg-slate-900"
      />
    }
    headers={['Course', 'Title', 'GA', 'PO', 'Vision Keyword', 'Mission Keyword', 'Source']}
    emptyText={loading ? 'Loading structure flow...' : 'No course-to-framework mappings available for this batch yet.'}
    rows={rows.map((row) => [
      row.courseCode,
      row.courseTitle,
      `${row.gaCode}${row.gaTitle ? ` - ${row.gaTitle}` : ''}`,
      `${row.poCode}${row.poTitle ? ` - ${row.poTitle}` : ''}`,
      row.visionKeyword,
      row.missionKeyword,
      row.source,
    ])}
  />
);

const GAPEOMappingTable: React.FC<{ mappings: GAPEOSnapshotMapping[] }> = ({ mappings }) => (
  <DossierTable
    title={<SectionTitle icon={<Link2 size={15} />} title="GA-PO Mapping Snapshot" helper={`${mappings.length} mapped links`} colorClass="bg-sky-600" />}
    headers={['PO', 'PO Title', 'GA', 'GA Title', 'Weight']}
    emptyText="No GA-PO mappings captured in this snapshot."
    rows={mappings.map((mapping) => [
      mapping.po_code || '',
      mapping.po_title || '',
      mapping.ga_code || '',
      mapping.ga_title || '',
      mapping.weight ? `${mapping.weight}%` : '',
    ])}
  />
);

const VisionMissionSnapshotTable: React.FC<{ items: VisionMissionSnapshotItem[] }> = ({ items }) => (
  <DossierTable
    title={<SectionTitle icon={<BookOpen size={15} />} title="Vision & Mission Snapshot" helper="Institutional statement plus keywords" colorClass="bg-violet-600" />}
    headers={['Type', 'Statement', 'Keywords']}
    emptyText="No Vision/Mission snapshot data available."
    rows={items.map((item) => [
      item.statement_type,
      item.statement,
      (item.keywords || []).map((keyword) => keyword.text).join(', '),
    ])}
  />
);

const POKeywordMappingTable: React.FC<{ mappings: POKeywordSnapshotMapping[] }> = ({ mappings }) => (
  <DossierTable
    title={<SectionTitle icon={<Target size={15} />} title="PO Mission/Vision Mapping Snapshot" helper={`${mappings.length} keyword mappings`} colorClass="bg-fuchsia-600" />}
    headers={['PO', 'PO Title', 'Mission Keyword', 'Vision Keyword']}
    emptyText="No PO Mission/Vision keyword mappings captured in this snapshot."
    rows={mappings.map((mapping) => [
      mapping.po_code || '',
      mapping.po_title || '',
      mapping.mission_keyword || '',
      mapping.vision_keyword || '',
    ])}
  />
);

const DossierTable: React.FC<{
  title: React.ReactNode;
  headers: string[];
  rows: Array<Array<string | number>>;
  emptyText: string;
}> = ({ title, headers, rows, emptyText }) => (
  <div className="space-y-3">
    {title}
    <div className="overflow-x-auto rounded-[22px] border border-gray-200 bg-white shadow-sm">
      <table className="min-w-[980px] table-fixed border-collapse text-left">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((header, index) => (
              <th
                key={header}
                className={`border-b border-gray-200 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 ${
                  index === 0 ? 'w-32' : index === headers.length - 1 ? 'w-28' : ''
                }`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-10 text-center text-xs font-semibold text-gray-300">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="align-top transition-colors hover:bg-gray-50/60">
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${rowIndex}-${cellIndex}`}
                    className={`border-r border-gray-100 px-4 py-3 text-xs leading-relaxed text-gray-600 last:border-r-0 ${
                      cellIndex === 0 ? 'font-black text-indigo-900' : cellIndex === row.length - 1 ? 'font-bold text-indigo-700' : ''
                    }`}
                  >
                    {cell || '-'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export default BatchDossierVault;
