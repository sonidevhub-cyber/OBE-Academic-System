import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../api/api";
import { toast } from "react-hot-toast";
import obeService, {
  GACQIRecord,
  GACQIResubmissionHistory,
  GAReportItem,
  BatchGAReportResponse,
  ReadinessResponse,
  Batch,
} from "../../api/obeService";
import authService from "../../api/authService";
import {
  History,
  FileBarChart,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Lock,
  CheckCheck,
  XCircle,
} from "lucide-react";

interface HODCQIProps {
  mode?: "clo" | "ga";
}

const HODCQI: React.FC<HODCQIProps> = ({ mode }) => {
  const [activeTab, setActiveTab] = useState<"clo" | "ga">(mode || "clo");

  const [cloData, setCloData] = useState<any[]>([]);
  const [cloLoadingId, setCloLoadingId] = useState<string | null>(null);
  const [cloLoading, setCloLoading] = useState(false);
  const [cloComments, setCloComments] = useState<{ [key: string]: string }>({});

  const [gaBatches, setGaBatches] = useState<Batch[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [gaReportData, setGaReportData] =
    useState<GAReportItem[] | ReadinessResponse | BatchGAReportResponse | null>(null);
  const [gaLoading, setGaLoading] = useState(false);
  const [expandedGAs, setExpandedGAs] = useState<string[]>([]);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localComment, setLocalComment] = useState<{ [key: string]: string }>({});

  const [editingCqiId, setEditingCqiId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    root_cause: '',
    hod_action_plan: '',
    implemented_in_batch: '',
    action_taken_description: '',
  });
  const [savingClose, setSavingClose] = useState(false);
  const [editingCqiStatus, setEditingCqiStatus] = useState<string>("");


  const currentAuth = authService.getCurrentUser();
  const isHod =
    currentAuth?.role === "hod" || currentAuth?.user?.secondary_role === "hod";

  const fetchCloData = async () => {
    try {
      setCloLoading(true);
      const res = await api.get("/assessments/hod-cqi/");
      setCloData(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load CLO CQI data");
    } finally {
      setCloLoading(false);
    }
  };

  const handleCloAction = async (id: string, status: string) => {
    try {
      setCloLoadingId(id);
      await api.patch(`/assessments/hod-cqi/update/${id}/`, {
        status,
        hod_comment: cloComments[id] || "",
      });
      toast.success(`CLO CQI ${status}`);
      fetchCloData();
    } catch (err: any) {
      console.error(err?.response?.data);
      toast.error("Action failed");
    } finally {
      setCloLoadingId(null);
    }
  };

  const fetchGaBatches = async () => {
    try {
      setGaLoading(true);
      const batchesData = await obeService.getAllBatches({ alumni_feedback: "all" });
      setGaBatches(batchesData);
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch batches");
    } finally {
      setGaLoading(false);
    }
  };

  const fetchGaReport = async () => {
    if (!selectedBatchId) return;
    setGaLoading(true);
    try {
      const data = await obeService.getBatchGAReport(selectedBatchId, {
        mode: "cumulative",
        scope: "all_students",
      });
      if (data && Array.isArray(data.cohort_summary)) {
        const selectedBatch = gaBatches.find((batch) => batch.id === selectedBatchId);
        const programId = selectedBatch?.program?.id;
        const cqiRecords =
          programId && selectedBatchId
            ? await obeService.getGACQIAdvisoryExport(programId, selectedBatchId).catch(() => [])
            : [];
        const cqiByGaId = cqiRecords.reduce<Record<string, GACQIRecord[]>>(
          (acc, record) => {
            const gaId = String(record.ga);
            if (!acc[gaId]) acc[gaId] = [];
            acc[gaId].push(record);
            return acc;
          },
          {}
        );
        if (programId && selectedBatchId) {
          try {
            const statusRow = await obeService.getGAStatusRow(programId, selectedBatchId);
            for (const row of statusRow) {
              const gaId = String(row.ga_id);
              if (row.cqi_record_id && !cqiByGaId[gaId]) {
                try {
                  const fullRecord = await obeService.getGACQIRecord(row.cqi_record_id);
                  if (!cqiByGaId[gaId]) cqiByGaId[gaId] = [];
                  cqiByGaId[gaId].push(fullRecord);
                } catch (err) {
                  console.error("Failed to fetch CQI record:", err);
                }
              }
            }
          } catch (err) {
            console.error("Failed to fetch GA status row:", err);
          }
        }
        const items: GAReportItem[] = data.cohort_summary.map((summary: any) => ({
          ga_id: summary.ga_id,
          ga_code: summary.ga_code,
          ga_title: summary.ga_title,
          direct_score: summary.direct_attainment,
          indirect_score: summary.indirect_attainment,
          ga_attainment: summary.final_attainment,
          ga_kpi_threshold: summary.ga_kpi_threshold,
          kpi_threshold: summary.ga_kpi_threshold,
          status: summary.status,
          contributing_courses: [],
          ga_cqi_records:
            summary.status === "BELOW_TARGET"
              ? cqiByGaId[String(summary.ga_id)] || []
              : [],
        }));
        setGaReportData(items);
      } else {
        setGaReportData(data);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch GA report");
    } finally {
      setGaLoading(false);
    }
  };

  const toggleGAExpansion = (gaCode: string) => {
    setExpandedGAs((prev) =>
      prev.includes(gaCode) ? prev.filter((code) => code !== gaCode) : [...prev, gaCode]
    );
  };

  const toggleHistory = (cqiId: string) => {
    setExpandedHistory((prev) => (prev === cqiId ? null : cqiId));
  };


  const openEditForm = (cqi: GACQIRecord) => {
    setEditingCqiId(cqi.id);
    setEditingCqiStatus(cqi.status);
    setEditForm({
      root_cause: cqi.root_cause || cqi.issue_statement || '',
      hod_action_plan: cqi.hod_action_plan || '',
      implemented_in_batch: cqi.implemented_in_batch || '',
      action_taken_description: cqi.action_taken_description || '',
    });
  };

  const handleSaveAndClose = async () => {
    if (!editingCqiId) return;
    if (!editForm.implemented_in_batch) {
      toast.error("Please select the batch where actions were implemented");
      return;
    }
    if (!editForm.action_taken_description.trim()) {
      toast.error("Please describe the action taken (mandatory)");
      return;
    }
    setSavingClose(true);
    try {
      await obeService.updateGACQIRecord(editingCqiId, {
        root_cause: editForm.root_cause || undefined,
        hod_action_plan: editForm.hod_action_plan || undefined,
      });
      await obeService.closeGACQI(editingCqiId, {
        implemented_in_batch: editForm.implemented_in_batch,
        action_taken_description: editForm.action_taken_description.trim(),
      });
      toast.success("GA CQI saved and closed successfully");
      setEditingCqiId(null);
      fetchGaReport();
    } catch (error: any) {
      console.error(error);
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        "Failed to save and close CQI";
      toast.error(msg);
    } finally {
      setSavingClose(false);
    }
  };

  const handleSaveCQI = async () => {
    if (!editingCqiId) return;
    if (editForm.hod_action_plan.trim().length < 20) {
      toast.error("HOD Action Plan must be at least 20 characters");
      return;
    }
    setSavingClose(true);
    try {
      await obeService.saveGACQI(editingCqiId, {
        hod_action_plan: editForm.hod_action_plan.trim(),
        issue_statement: editForm.root_cause || editForm.hod_action_plan || undefined,
      });
      toast.success("CQI saved. You can now close the loop.");
      setEditingCqiId(null);
      setEditingCqiStatus("");
      fetchGaReport();
    } catch (error: any) {
      console.error(error);
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        "Failed to save CQI";
      toast.error(msg);
    } finally {
      setSavingClose(false);
    }
  };


  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "FULLY_APPROVED":
      case "approved":
      case "OPEN":
      case "SAVED":
        return "bg-amber-100 text-amber-700";
      case "CLOSED_IMPLEMENTED":
        return "bg-emerald-100 text-emerald-700";
      case "PENDING":
      case "pending":
        return "bg-amber-100 text-amber-700";
      case "SENT_BACK":
      case "rejected":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "FULLY_APPROVED":
      case "approved":
      case "OPEN":
      case "SAVED":
        return <AlertCircle className="w-4 h-4" />;
      case "CLOSED_IMPLEMENTED":
        return <CheckCheck className="w-4 h-4" />;
      case "PENDING":
      case "pending":
      case "SENT_BACK":
      case "rejected":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <XCircle className="w-4 h-4" />;
    }
  };

  const isBatchGAReportResponse = (data: any): data is BatchGAReportResponse => {
    return (
      data &&
      typeof data.is_program_end_ready === "boolean" &&
      Array.isArray(data.ga_reports)
    );
  };

  const isGAArray = (data: any): data is GAReportItem[] => {
    return Array.isArray(data);
  };

  const getGAItems = (): GAReportItem[] => {
    if (isBatchGAReportResponse(gaReportData)) {
      return gaReportData.ga_reports;
    } else if (isGAArray(gaReportData)) {
      return gaReportData;
    }
    return [];
  };

  const canCloseCqi = (cqi: GACQIRecord) => {
    return (
      isHod &&
      cqi.status !== "CLOSED_IMPLEMENTED" &&
      cqi.status !== "NOT_TRIGGERED" &&
      (cqi.status === "SAVED" ||
        cqi.status === "FULLY_APPROVED" ||
        cqi.status === "OPEN" ||
        cqi.status === "APPROVED")
    );
  };

  const gaPrograms = useMemo(() => {
    const seen = new Map<string, string>();
    gaBatches.forEach(b => {
      const id = String(b.program?.id || (b as any).program_id || '');
      const name = b.program?.name || (b as any).program_name || '';
      if (id && name) seen.set(id, name);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [gaBatches]);

  const filteredGaBatches = useMemo(
    () =>
      gaBatches
        .filter((batch) => batch.status === "graduated" && (!selectedProgramId || String(batch.program?.id || (batch as any).program_id || '') === selectedProgramId))
        .sort((a, b) =>
          String(b.name || '').localeCompare(String(a.name || ''))
        ),
    [gaBatches, selectedProgramId]
  );

  const implementationBatches = useMemo(
    () => gaBatches.filter((batch) => batch.status === "active"),
    [gaBatches]
  );

  useEffect(() => {
    fetchCloData();
    fetchGaBatches();
  }, []);

  useEffect(() => {
    if (mode) setActiveTab(mode);
  }, [mode]);

  useEffect(() => {
    if (selectedBatchId) {
      fetchGaReport();
    }
  }, [selectedBatchId]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">
        {activeTab === "ga" ? "GA CQI Closing Loop" : "CLO CQI Review"}
      </h2>

      {!mode && (
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("clo")}
            className={`px-4 py-2 font-semibold rounded-t-lg transition-colors ${
              activeTab === "clo"
                ? "bg-indigo-100 text-indigo-700 border-b-2 border-indigo-500"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            CLO CQI
          </button>
          <button
            onClick={() => setActiveTab("ga")}
            className={`px-4 py-2 font-semibold rounded-t-lg transition-colors ${
              activeTab === "ga"
                ? "bg-indigo-100 text-indigo-700 border-b-2 border-indigo-500"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            GA CQI (Closing Loop)
          </button>
        </div>
      )}

      {activeTab === "clo" && (
        <div>
          {cloLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : cloData.length === 0 ? (
            <p className="text-gray-500">No CLO CQI Data Found</p>
          ) : (
            cloData.map((item) => (
              <div
                key={item.id}
                className="bg-white p-5 rounded-xl shadow mb-4 border"
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-red-600 text-lg">
                    {item.clo_display}
                  </h3>
                </div>
                <p>
                  <b>Instructor:</b> {item.instructor_name}
                </p>
                <p>
                  <b>Reason:</b> {item.reason}
                </p>
                <p>
                  <b>Action Plan:</b> {item.action_plan}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "ga" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-gray-400">
                  Graduate Attribute CQI
                </p>
                <h3 className="mt-2 text-xl font-black text-gray-900">
                  Cumulative GA Attainment & Closing Loop
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Approve CQI, then close the loop by documenting the implementation
                  batch and action taken. Resulting attainment is auto-pulled from
                  report calculation.
                </p>
              </div>
               <div className="grid w-full gap-3 md:max-w-[520px]">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-400">Program</label>
                    <select className="w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-3 font-bold text-gray-700 transition-all focus:border-indigo-500 focus:ring-0" value={selectedProgramId} onChange={(e) => { setSelectedProgramId(e.target.value); setSelectedBatchId(""); }}>
                      <option value="">All Programs</option>
                      {gaPrograms.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-400">Select Alumni Batch</label>
                    <select className="w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-3 font-bold text-gray-700 transition-all focus:border-indigo-500 focus:ring-0" value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)}>
                      <option value="">Select a batch</option>
                      {filteredGaBatches.map((batch) => (<option key={batch.id} value={batch.id}>{batch.name}</option>))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {gaLoading && (
            <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-xl font-bold text-gray-600">Loading records...</p>
            </div>
          )}

          {!gaLoading && !selectedBatchId && (
            <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
              <FileBarChart className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Select a batch to view GA CQI records
              </h3>
            </div>
          )}

          {!gaLoading && selectedBatchId && getGAItems().length === 0 && (
            <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                No GA records for this batch
              </h3>
            </div>
          )}

          {!gaLoading && getGAItems().length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                        GA
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                        Direct
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                        Indirect
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                        Final
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                        CQI Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                        Resulting At.
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {getGAItems().map((ga) => {
                      const cqi = ga.ga_cqi_records?.[0];
                      const isExpanded = expandedGAs.includes(ga.ga_code);
                      return (
                        <React.Fragment key={ga.ga_id}>
                          <tr className="hover:bg-gray-50">
                            <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                              <div className="font-black">{ga.ga_code}</div>
                              <div className="text-xs font-normal text-gray-500 max-w-[220px] truncate">
                                {ga.ga_title}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-700">
                              {ga.direct_score !== null && ga.direct_score !== undefined
                                ? `${ga.direct_score.toFixed(1)}%`
                                : "N/A"}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-700">
                              {ga.indirect_score !== null && ga.indirect_score !== undefined
                                ? `${ga.indirect_score.toFixed(1)}%`
                                : "N/A"}
                            </td>
                            <td className="px-4 py-4 text-sm font-bold text-gray-900">
                              {ga.ga_attainment !== null && ga.ga_attainment !== undefined
                                ? `${ga.ga_attainment.toFixed(1)}%`
                                : "N/A"}
                              <div className="text-xs font-normal text-gray-500">
                                Target {ga.ga_kpi_threshold ?? ga.kpi_threshold ?? 60}%
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              {cqi ? (
                                <span
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadgeColor(
                                    cqi.status
                                  )}`}
                                >
                                  {getStatusIcon(cqi.status)}
                                  {cqi.status === "CLOSED_IMPLEMENTED"
                                    ? "Closed"
                                    : cqi.status}
                                </span>
                              ) : ga.status === "ACHIEVED" ? (
                                <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-700">
                                  Achieved
                                </span>
                              ) : ga.status === "NOT_ASSESSED" ? (
                                <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-gray-600">
                                  Not assessed
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-red-700">
                                  Needs CQI
                                </span>
                              )}
                                </td>
                             <td className="px-4 py-4 text-sm text-gray-700">
                               {cqi?.resulting_attainment !== null &&
                               cqi?.resulting_attainment !== undefined ? (
                                 <div>
                                   <span className="font-bold">
                                     {Number(cqi.resulting_attainment).toFixed(1)}%
                                   </span>
                                   {cqi.implemented_in_batch_name && (
                                     <div className="text-xs text-gray-500">
                                       Batch: {cqi.implemented_in_batch_name}
                                     </div>
                                   )}
                                 </div>
                              ) : cqi?.status === "CLOSED_IMPLEMENTED" ? (
                                "—"
                              ) : cqi ? (
                                <span className="text-gray-400 text-xs italic">
                                  Pending close
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                {cqi && (
                                  <button
                                    type="button"
                                    onClick={() => toggleGAExpansion(ga.ga_code)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </button>
                                )}
                                {cqi && (
                                  <button
                                    type="button"
                                    onClick={() => openEditForm(cqi)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700 shadow"
                                  >
                                    <CheckCheck className="h-4 w-4" />
                                    Manage CQI
                                  </button>
                                )}
                                {cqi?.status === "CLOSED_IMPLEMENTED" && (
                                  <span className="inline-flex items-center gap-1 rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold text-gray-500">
                                    <Lock className="h-3.5 w-3.5" />
                                    Locked
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && cqi && (
                            <tr>
                              <td colSpan={7} className="bg-gray-50/70 p-0">
                                <div className="grid gap-4 p-5 lg:grid-cols-2">
                                  <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                                    <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                                      Root Cause
                                    </p>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                      {cqi.root_cause || cqi.issue_statement || "—"}
                                    </p>
                                  </div>
                                  <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                                    <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                                      HOD Action Plan
                                    </p>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                      {cqi.hod_action_plan || "—"}
                                    </p>
                                  </div>

                                  {cqi.status === "CLOSED_IMPLEMENTED" && (
                                    <>
                                      <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                                        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                                          Action Taken Description
                                        </p>
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                          {cqi.action_taken_description || "—"}
                                        </p>
                                      </div>
                                      <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                                        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                                          Closing Details
                                        </p>
                                        <div className="space-y-1 text-sm text-gray-700">
                                          <div>
                                            <span className="font-semibold">
                                              Implemented in:
                                            </span>{" "}
                                            {cqi.implemented_in_batch_name ||
                                              cqi.implemented_in_batch ||
                                              "—"}
                                          </div>
                                          <div>
                                            <span className="font-semibold">
                                              Resulting attainment:
                                            </span>{" "}
                                            {cqi.resulting_attainment !== null &&
                                            cqi.resulting_attainment !== undefined
                                              ? `${Number(
                                                  cqi.resulting_attainment
                                                ).toFixed(1)}% (auto-calculated)`
                                              : "—"}
                                          </div>
                                          <div>
                                            <span className="font-semibold">Closed by:</span>{" "}
                                            {cqi.closed_by_name || cqi.closed_by || "—"}
                                          </div>
                                          <div>
                                            <span className="font-semibold">Closed on:</span>{" "}
                                            {cqi.closed_at
                                              ? new Date(cqi.closed_at).toLocaleString()
                                              : "—"}
                                          </div>
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  <div className="lg:col-span-2 rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div className="flex items-center gap-3">
                                        <span
                                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadgeColor(
                                            cqi.status
                                          )}`}
                                        >
                                          {getStatusIcon(cqi.status)}
                                          {cqi.status === "CLOSED_IMPLEMENTED"
                                            ? "Closed"
                                            : cqi.status}
                                        </span>
                                        {cqi.history && cqi.history.length > 0 ? (
                                          <button
                                            type="button"
                                            onClick={() => toggleHistory(cqi.id)}
                                            className="inline-flex items-center gap-1 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200"
                                          >
                                            <History className="h-4 w-4" />
                                            History
                                          </button>
                                        ) : null}
                                      </div>

                                      {cqi.status !== "CLOSED_IMPLEMENTED" && isHod && (
                                        <button
                                          type="button"
                                          onClick={() => openEditForm(cqi)}
                                          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 shadow"
                                        >
                                          <CheckCheck className="inline h-4 w-4 mr-1" />
                                          Manage CQI
                                        </button>
                                      )}
                                       </div>

                                    {expandedHistory === cqi.id ? (
                                      <div className="mt-4 rounded-xl bg-gray-50 p-4">
                                        <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">
                                          Submission History
                                        </div>
                                        <div className="space-y-3">
                                          {cqi.history?.map(
                                            (historyItem: GACQIResubmissionHistory) => (
                                              <div
                                                key={historyItem.id}
                                                className="rounded-xl bg-white p-3"
                                              >
                                                <div className="flex items-center justify-between mb-2">
                                                  <span className="text-xs font-black uppercase tracking-wider text-gray-500">
                                                    {historyItem.status_at_time}
                                                  </span>
                                                  <span className="text-xs text-gray-500">
                                                    {new Date(
                                                      historyItem.submitted_at
                                                    ).toLocaleString()}
                                                  </span>
                                                </div>
                                                <div className="text-sm text-gray-600 space-y-1">
                                                  {historyItem.root_cause_snapshot && (
                                                    <div>
                                                      <span className="font-semibold">
                                                        Root Cause:
                                                      </span>{" "}
                                                      {historyItem.root_cause_snapshot}
                                                    </div>
                                                  )}
                                                   {historyItem.hod_comment_snapshot && (
                                                     <div>
                                                       <span className="font-semibold">
                                                         HOD Comment:
                                                       </span>{" "}
                                                       {historyItem.hod_comment_snapshot}
                                                     </div>
                                                   )}
                                                </div>
                                              </div>
                                            )
                                          )}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
       )}

      {editingCqiId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                Manage GA-CQI{" "}
                <span className="text-sm font-medium text-gray-500">
                  (Status: {editingCqiStatus})
                </span>
              </h3>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                  Issue Statement
                </label>
                <textarea
                  className={`w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 outline-none transition-all focus:border-indigo-500 ${
                    editingCqiStatus === "SAVED" ? "cursor-not-allowed" : ""
                  }`}
                  rows={3}
                  value={editForm.root_cause}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      root_cause: e.target.value,
                    }))
                  }
                  disabled={editingCqiStatus === "SAVED"}
                  placeholder="Auto-filled issue statement (editable before saving)"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                  HOD Action Plan <span className="text-red-500">*</span>
                </label>
                <textarea
                  className={`w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 outline-none transition-all focus:border-indigo-500 resize-none`}
                  rows={4}
                  value={editForm.hod_action_plan}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      hod_action_plan: e.target.value,
                    }))
                  }
                  placeholder="Enter your action plan here... (minimum 20 characters)"
                />
              </div>

              {editingCqiStatus === "SAVED" && (
                <>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                      Implementation Batch <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-3 font-bold text-gray-700 transition-all focus:border-emerald-500 focus:ring-0"
                      value={editForm.implemented_in_batch}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          implemented_in_batch: e.target.value,
                        }))
                      }
                    >
                      <option value="">
                        Select the batch where actions were implemented
                      </option>
                      {implementationBatches.map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                      Action Taken Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className="w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 outline-none transition-all focus:border-emerald-500"
                      rows={6}
                      placeholder="Describe the corrective actions implemented, interventions applied, teaching strategies revised, resources added, faculty development conducted, etc."
                      value={editForm.action_taken_description}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          action_taken_description: e.target.value,
                        }))
                      }
                    />
                  </div>
                </>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingCqiId(null);
                  setEditingCqiStatus("");
                }}
                disabled={savingClose}
                className="rounded-xl bg-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-300 disabled:opacity-70"
              >
                Cancel
              </button>
              {editingCqiStatus !== "SAVED" && (
                <button
                  type="button"
                  onClick={handleSaveCQI}
                  disabled={savingClose}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {savingClose ? "Saving..." : "Save CQI"}
                </button>
              )}
              {editingCqiStatus === "SAVED" && (
                <button
                  type="button"
                  onClick={handleSaveAndClose}
                  disabled={savingClose}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-emerald-700 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {savingClose ? "Closing..." : "Confirm Close & Save"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default HODCQI;
