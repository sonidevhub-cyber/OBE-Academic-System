import React, { useEffect, useMemo, useState } from "react";
import { feedbackService } from "../../api/FeedbackServices";
import { api } from "../../api/api";
import toast from "react-hot-toast";

const CoordinatorFeedbackView = () => {
  const [activeTab, setActiveTab] = useState("indirect");
  const [indirectData, setIndirectData] = useState<any[]>([]);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [remedialAction, setRemedialAction] = useState("");
  const [nextBatch, setNextBatch] = useState("");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [directFilter, setDirectFilter] = useState("ALL");
  const [indirectFilter, setIndirectFilter] = useState("ALL");

  const [loadingBatches, setLoadingBatches] = useState(false);
  const [loadingIndirect, setLoadingIndirect] = useState(false);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [creatingCQI, setCreatingCQI] = useState(false);
  const [applyingCQI, setApplyingCQI] = useState(false);

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    if (!selectedBatch) {
      setIndirectData([]);
      setComparisonData([]);
      setExpandedCard(null);
      return;
    }

    fetchIndirectData();
    fetchComparisonData();
    setSearchTerm("");
    setStatusFilter("ALL");
    setDirectFilter("ALL");
    setIndirectFilter("ALL");
    setExpandedCard(null);
    setRootCause("");
    setRemedialAction("");
    setNextBatch("");
  }, [selectedBatch]);

  const fetchBatches = async () => {
    setLoadingBatches(true);
    try {
      const res = await api.get("/feedback/coordinator-batches/");
      setBatches(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setBatches([]);
      toast.error("Unable to load batches.");
    } finally {
      setLoadingBatches(false);
    }
  };

  const fetchIndirectData = async () => {
    if (!selectedBatch) return;
    setLoadingIndirect(true);
    try {
      const res = await feedbackService.getIndirectReport(selectedBatch);
      console.log("INDIRECT REPORT:", res);
      setIndirectData(Array.isArray(res) ? res : res?.results || []);
    } catch (err) {
      console.error(err);
      setIndirectData([]);
      toast.error("Unable to load indirect assessment report.");
    } finally {
      setLoadingIndirect(false);
    }
  };

  const fetchComparisonData = async () => {
    if (!selectedBatch) return;
    setLoadingComparison(true);
    try {
      const res = await feedbackService.compare(selectedBatch);
      console.log("COMPARE RESPONSE:", res);
      setComparisonData(Array.isArray(res) ? res : res?.results || []);
    } catch (err) {
      console.error(err);
      setComparisonData([]);
      toast.error("Unable to load direct vs indirect comparison.");
    } finally {
      setLoadingComparison(false);
    }
  };

  const getNumber = (value: any) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const createCQI = async (item: any) => {
    if (!rootCause.trim()) return toast.error("Please enter the root cause.");
    if (!remedialAction.trim()) return toast.error("Please enter the remedial action.");
    if (!item.course_id) return toast.error("Course information is missing.");
    if (!item.clo_id) return toast.error("CLO information is missing.");
    if (!item.batch_id) return toast.error("Batch information is missing.");
    if (!item.semester_id) return toast.error("Semester information is missing.");

    setCreatingCQI(true);
    try {
      await api.post("/feedback/create-cqi/", {
        course: item.course_id,
        clo: item.clo_id,
        batch: item.batch_id,
        semester: item.semester_id,
        root_cause: rootCause.trim(),
        remedial_action: remedialAction.trim(),
      });
      toast.success("CQI Created Successfully");
      setRootCause("");
      setRemedialAction("");
      await fetchComparisonData();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.detail || err?.response?.data?.message || "Unable to create CQI. Please try again.");
    } finally {
      setCreatingCQI(false);
    }
  };

  const applyCQI = async (cqiId: string) => {
    if (!nextBatch) return toast.error("Please select the next batch.");
    if (!cqiId) return toast.error("CQI ID is missing.");

    setApplyingCQI(true);
    try {
      await api.post("/feedback/apply-cqi/", {
  cqi_id: cqiId,
  next_batch: nextBatch,
});

toast.success("CQI Applied Successfully");

// Save the batch that received the CQI
const appliedBatch = nextBatch;

setNextBatch("");

// Automatically switch dashboard to the next batch
setSelectedBatch(appliedBatch);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.detail || err?.response?.data?.message || "Unable to apply CQI. Please try again.");
    } finally {
      setApplyingCQI(false);
    }
  };

  const getCardId = (item: any, index: number) =>
    `${item.batch_id || item.batch || "batch"}-${item.semester_id || item.semester || "semester"}-${item.course_id || item.course_code || item.course || "course"}-${item.clo_id || item.clo || "clo"}-${index}`;

  const getRangeMatch = (value: any, filter: string) => {
    const n = getNumber(value);
    if (filter === "HIGH") return n >= 80;
    if (filter === "MEDIUM") return n >= 60 && n < 80;
    if (filter === "LOW") return n < 60;
    return true;
  };

  const filteredComparisonData = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return comparisonData.filter((item) => {
      const text = [
        item.batch, item.batch_name, item.batch_code,
        item.semester, item.semester_name, item.semester_number,
        item.course, item.course_name, item.course_code,
        item.clo, item.clo_code, item.clo_name, item.status,
      ].filter(Boolean).join(" ").toLowerCase();

      const status = String(item.status || "").toUpperCase();
      const direct = item.direct ?? item.direct_percentage;
      const indirect = item.indirect ?? item.indirect_percentage;

      return (
        (!search || text.includes(search)) &&
        (statusFilter === "ALL" || status === statusFilter) &&
        getRangeMatch(direct, directFilter) &&
        getRangeMatch(indirect, indirectFilter)
      );
    });
  }, [comparisonData, searchTerm, statusFilter, directFilter, indirectFilter]);

  const totalRecords = comparisonData.length;
  const matchedRecords = comparisonData.filter((x) => x.status === "MATCHED").length;
  const redFlagRecords = comparisonData.filter((x) => x.status === "RED_FLAG").length;
  const cqiRequiredRecords = comparisonData.filter((x) => x.status === "CQI_REQUIRED").length;

  const statusClasses = (status: string) => ({
    MATCHED: "bg-green-100 text-green-700 border-green-200",
    RED_FLAG: "bg-yellow-100 text-yellow-700 border-yellow-200",
    CQI_REQUIRED: "bg-red-100 text-red-700 border-red-200",
  }[status] || "bg-gray-100 text-gray-700 border-gray-200");

  const percentageClasses = (value: any) => {
    const n = getNumber(value);
    return n >= 80 ? "text-green-700 bg-green-50" : n >= 60 ? "text-yellow-700 bg-yellow-50" : "text-red-700 bg-red-50";
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setDirectFilter("ALL");
    setIndirectFilter("ALL");
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-6 shadow-sm">
        <div className="flex items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Feedback & CQI Dashboard</h2>
            <p className="text-gray-500 mt-2">Compare Direct & Indirect Assessment and manage Continuous Quality Improvement.</p>
          </div>
          <div className="bg-indigo-100 text-indigo-700 rounded-2xl p-4 shrink-0">📊</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5 mb-6 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-gray-700">Select Batch</label>
          {loadingBatches && <span className="text-xs text-gray-500">Loading batches...</span>}
        </div>
        <select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)} disabled={loadingBatches} className="w-full border border-gray-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
          <option value="">Choose Batch</option>
          {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap bg-white rounded-xl shadow-sm p-2 mb-6 w-fit border border-gray-200">
        {[["indirect", "📋 Indirect Assessment"], ["comparison", "📊 Direct vs Indirect"]].map(([key, label]) => (
          <button key={key} type="button" onClick={() => setActiveTab(key)} className={`px-6 py-3 rounded-lg font-semibold transition ${activeTab === key ? "bg-indigo-600 text-white shadow-lg" : "text-gray-700 hover:bg-gray-100"}`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === "indirect" && (
        !selectedBatch ? <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-xl">Please select a batch first.</div> :
        loadingIndirect ? <div className="bg-white border rounded-xl p-8 text-center"><div className="animate-spin h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-3" />Loading indirect assessment...</div> :
        indirectData.length === 0 ? <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-xl">No indirect assessment data found.</div> :
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {indirectData.map((item, index) => {
            const indirect = getNumber(item.indirect_percentage ?? item.indirect);
            return <div key={getCardId(item, index)} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-indigo-700">{item.course || item.course_name || "—"}</h3>
                  <p className="text-sm text-gray-500">Code: {item.course_code || "—"}</p>
                  <p className="text-sm text-gray-500">Batch: {item.batch || item.batch_name || "—"}</p>
                </div>
                <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-semibold">{item.semester || item.semester_name || "—"}</span>
              </div>
              <p className="text-gray-500 text-sm">Course Learning Outcome</p>
              <p className="font-semibold text-gray-800 mb-4">{item.clo || item.clo_code || item.clo_name || "—"}</p>
              <div className="flex justify-between mb-2"><span className="font-medium">Indirect Attainment</span><b>{indirect}%</b></div>
              <div className="w-full bg-gray-200 rounded-full h-3"><div className={`h-3 rounded-full ${indirect >= 80 ? "bg-green-500" : indirect >= 60 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, Math.max(0, indirect))}%` }} /></div>
            </div>;
          })}
        </div>
      )}

      {activeTab === "comparison" && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
            {[['Total Records', totalRecords, 'bg-blue-100 text-blue-700', 'bg-white'], ['Matched', matchedRecords, 'bg-green-100 text-green-700', 'bg-green-50'], ['Red Flags', redFlagRecords, 'bg-yellow-100 text-yellow-700', 'bg-yellow-50'], ['CQI Required', cqiRequiredRecords, 'bg-red-100 text-red-700', 'bg-red-50']].map(([label, value, iconClass, cardClass]) => (
              <div key={String(label)} className={`${cardClass} border border-gray-200 shadow-sm rounded-xl p-5`}><div className="flex items-center justify-between"><div><p className="text-gray-500 text-sm font-medium">{label}</p><h2 className="text-3xl font-bold mt-1">{value}</h2></div><div className={`${iconClass} p-3 rounded-xl`}>{label === 'Matched' ? '✓' : label === 'Red Flags' ? '⚠' : label === 'CQI Required' ? '!' : '📊'}</div></div></div>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 mb-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-end">
              <div className="lg:col-span-2"><label className="block text-sm font-semibold text-gray-700 mb-2">Search</label><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search batch, semester, course, code or CLO..." className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Status</label><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white"><option value="ALL">All Status</option><option value="MATCHED">Matched</option><option value="RED_FLAG">Red Flag</option><option value="CQI_REQUIRED">CQI Required</option></select></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Direct</label><select value={directFilter} onChange={(e) => setDirectFilter(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white"><option value="ALL">All Direct</option><option value="HIGH">80% and Above</option><option value="MEDIUM">60% - 79%</option><option value="LOW">Below 60%</option></select></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Indirect</label><select value={indirectFilter} onChange={(e) => setIndirectFilter(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white"><option value="ALL">All Indirect</option><option value="HIGH">80% and Above</option><option value="MEDIUM">60% - 79%</option><option value="LOW">Below 60%</option></select></div>
            </div>
            <div className="mt-4 flex justify-between items-center"><span className="text-sm text-gray-500">Showing <b>{filteredComparisonData.length}</b> of <b>{comparisonData.length}</b> records</span><button type="button" onClick={clearFilters} className="px-4 py-2 rounded-lg border border-gray-300 font-semibold hover:bg-gray-100">Clear Filters</button></div>
          </div>

          {!selectedBatch ? <div className="bg-blue-50 border border-blue-200 text-blue-700 p-5 rounded-xl">Please select a batch first.</div> : loadingComparison ? <div className="bg-white border rounded-xl p-10 text-center"><div className="animate-spin h-10 w-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-4" />Loading direct vs indirect report...</div> : comparisonData.length === 0 ? <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-5 rounded-xl">⚠ Direct assessment data not available yet.</div> : filteredComparisonData.length === 0 ? <div className="bg-white border rounded-2xl p-10 text-center"><div className="text-4xl">🔎</div><h3 className="text-lg font-bold mt-3">No matching records</h3><button type="button" onClick={clearFilters} className="mt-4 px-5 py-2 rounded-lg bg-indigo-600 text-white font-semibold">Reset Filters</button></div> : (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b flex justify-between items-center"><div><h3 className="text-xl font-bold text-gray-800">Direct vs Indirect Assessment Report</h3><p className="text-sm text-gray-500 mt-1">Every response is identified by Batch, Semester, Course, Course Code and CLO.</p></div><span className="text-sm bg-gray-50 px-4 py-2 rounded-lg border">{filteredComparisonData.length} Records</span></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1450px] border-collapse">
                  <thead><tr className="bg-gray-100 border-b">
                    {['#','Batch','Semester','Course','Course Code','CLO','Direct','Indirect','Gap','Status','Action'].map((h) => <th key={h} className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-600 border-r">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {filteredComparisonData.map((item, index) => {
                      const id = getCardId(item, index);
                      const expanded = expandedCard === id;
                      const direct = getNumber(item.direct ?? item.direct_percentage);
                      const indirect = getNumber(item.indirect ?? item.indirect_percentage);
                      const gap = getNumber(item.gap ?? item.gap_percentage ?? direct - indirect);
                      const batch = item.batch || item.batch_name || item.batch_code || '—';
                      const semester = item.semester || item.semester_name || item.semester_number || '—';
                      const course = item.course || item.course_name || '—';
                      const code = item.course_code || item.code || '—';
                      const clo = item.clo || item.clo_code || item.clo_name || '—';
                      return <React.Fragment key={id}>
                        <tr className={`border-b ${expanded ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                          <td className="px-5 py-4 border-r">{index + 1}</td>
                          <td className="px-5 py-4 border-r font-semibold">{batch}</td>
                          <td className="px-5 py-4 border-r"><span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-semibold">{semester}</span></td>
                          <td className="px-5 py-4 border-r font-semibold">{course}</td>
                          <td className="px-5 py-4 border-r">{code}</td>
                          <td className="px-5 py-4 border-r font-medium">{clo}</td>
                          <td className="px-5 py-4 text-center border-r"><span className={`inline-flex min-w-[75px] justify-center px-3 py-2 rounded-lg font-bold ${percentageClasses(direct)}`}>{direct}%</span></td>
                          <td className="px-5 py-4 text-center border-r"><span className={`inline-flex min-w-[75px] justify-center px-3 py-2 rounded-lg font-bold ${percentageClasses(indirect)}`}>{indirect}%</span></td>
                          <td className="px-5 py-4 text-center border-r"><span className={`inline-flex min-w-[75px] justify-center px-3 py-2 rounded-lg font-bold ${Math.abs(gap) <= 5 ? 'text-green-700 bg-green-50' : Math.abs(gap) <= 10 ? 'text-yellow-700 bg-yellow-50' : 'text-red-700 bg-red-50'}`}>{gap}%</span></td>
                          <td className="px-5 py-4 text-center border-r"><span className={`inline-flex px-3 py-2 rounded-full text-xs font-bold border whitespace-nowrap ${statusClasses(item.status)}`}>{item.status?.replace(/_/g, ' ') || 'UNKNOWN'}</span></td>
                          <td className="px-5 py-4 text-center"><button type="button" onClick={() => setExpandedCard(expanded ? null : id)} className={`px-4 py-2 rounded-lg font-semibold text-sm ${expanded ? 'bg-indigo-600 text-white' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}>{expanded ? 'Hide Details ▲' : 'View Details ▼'}</button></td>
                        </tr>
                        {expanded && <tr className="bg-gray-50 border-b"><td colSpan={11} className="p-0"><div className="p-6">
                          <div className="bg-white border border-indigo-200 rounded-xl p-5 mb-5">
                            <div className="flex flex-wrap gap-3 mb-4"><span className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-semibold">Batch: {batch}</span><span className="px-3 py-2 bg-purple-50 text-purple-700 rounded-lg font-semibold">Semester: {semester}</span><span className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg font-semibold">Course: {course}</span><span className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold">Code: {code}</span><span className="px-3 py-2 bg-orange-50 text-orange-700 rounded-lg font-semibold">CLO: {clo}</span></div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><div className="bg-blue-50 rounded-lg p-4"><p className="text-xs text-blue-600 font-semibold">DIRECT</p><p className="text-2xl font-bold text-blue-700">{direct}%</p></div><div className="bg-green-50 rounded-lg p-4"><p className="text-xs text-green-600 font-semibold">INDIRECT</p><p className="text-2xl font-bold text-green-700">{indirect}%</p></div><div className="bg-red-50 rounded-lg p-4"><p className="text-xs text-red-600 font-semibold">GAP</p><p className="text-2xl font-bold text-red-700">{gap}%</p></div><div className="bg-gray-50 rounded-lg p-4"><p className="text-xs text-gray-500 font-semibold">CQI</p><p className="text-lg font-bold mt-1">
                            {item.implemented_cqi_exists && (
  <div className="bg-blue-50 border border-blue-300 rounded-xl p-6 mb-5">

    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-xl font-bold text-blue-700">
          🔄 CQI Applied from Previous Batch
        </h3>

        <p className="text-sm text-gray-600 mt-1">
          This CQI was implemented from batch:
          <span className="font-semibold ml-1">
            {item.implemented_from_batch}
          </span>
        </p>
      </div>

      <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
        IMPLEMENTED
      </span>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

      <div className="bg-white border border-blue-200 rounded-lg p-4">
        <p className="text-xs font-bold text-gray-500 uppercase mb-2">
          Root Cause
        </p>

        <p className="text-gray-800">
          {item.implemented_cqi_root_cause || "—"}
        </p>
      </div>

      <div className="bg-white border border-blue-200 rounded-lg p-4">
        <p className="text-xs font-bold text-gray-500 uppercase mb-2">
          Remedial Action
        </p>

        <p className="text-gray-800">
          {item.implemented_cqi_remedial_action || "—"}
        </p>
      </div>

    </div>

  </div>
)}
                            {item.cqi_exists ? 'Created' : item.status === 'CQI_REQUIRED' || item.status === 'RED_FLAG' ? 'Required' : 'Not Required'}</p></div></div>
                          </div>

                          {(item.status === 'CQI_REQUIRED' || item.status === 'RED_FLAG') &&
  !item.cqi_exists &&
  !item.implemented_cqi_exists &&  <div className="bg-red-50 border border-red-200 rounded-xl p-6"><h3 className="text-xl font-bold text-red-700 mb-4">Create Continuous Quality Improvement (CQI)</h3><div className="mb-4"><label className="block text-sm font-semibold mb-2">Root Cause</label><textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={4} placeholder="Enter the root cause..." className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-red-400" /></div><div className="mb-5"><label className="block text-sm font-semibold mb-2">Remedial Action</label><textarea value={remedialAction} onChange={(e) => setRemedialAction(e.target.value)} rows={4} placeholder="Enter the remedial action..." className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-red-400" /></div><button type="button" disabled={creatingCQI} onClick={(e) => { e.stopPropagation(); createCQI(item); }} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold px-6 py-3 rounded-lg">{creatingCQI ? 'Creating CQI...' : 'Save CQI'}</button></div>}

                          {item.cqi_exists && !item.implemented_cqi_exists &&<div className="bg-green-50 border border-green-300 rounded-xl p-6"><h3 className="text-xl font-bold text-green-700">✅ CQI Successfully Created</h3><p className="text-gray-600 mt-1 mb-4">Select the next batch to apply this CQI.</p><label className="block text-sm font-semibold mb-2">Next Batch</label><select value={nextBatch} onChange={(e) => setNextBatch(e.target.value)} className="w-full border rounded-lg p-3 bg-white"><option value="">Select Next Batch</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select><button type="button" disabled={applyingCQI} onClick={(e) => { e.stopPropagation(); applyCQI(item.cqi_id); }} className="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-3 rounded-lg">{applyingCQI ? 'Applying CQI...' : 'Apply CQI to Next Batch'}</button></div>}

                          {item.status === 'MATCHED' && !item.cqi_exists && <div className="bg-green-50 border border-green-200 rounded-xl p-5"><h3 className="font-bold text-green-700">✓ Assessment Matched</h3><p className="text-sm text-gray-600 mt-1">Direct and indirect assessment results are within the acceptable range.</p></div>}
                        </div></td></tr>}
                      </React.Fragment>;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CoordinatorFeedbackView;
