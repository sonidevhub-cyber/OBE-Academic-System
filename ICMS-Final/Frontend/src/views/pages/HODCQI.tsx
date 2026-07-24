import React, { useEffect, useState } from "react";
import { api } from "../../api/api";
import { toast } from "react-hot-toast";
import obeService from "../../api/obeService";
import { GACQIRecord, GACQIResubmissionHistory, GAReportItem, BatchGAReportResponse, ReadinessResponse } from "../../api/obeService";
import authService from "../../api/authService";
import { History, CheckCircle, XCircle, MessageSquare, FileBarChart, AlertCircle, ChevronRight, ChevronDown } from "lucide-react";

const HODCQI: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"clo">("clo");
  
  // CLO CQI states
  const [cloData, setCloData] = useState<any[]>([]);
  const [cloLoadingId, setCloLoadingId] = useState<string | null>(null);
  const [cloLoading, setCloLoading] = useState(false);
  const [cloComments, setCloComments] = useState<{ [key: string]: string }>({});

  // GA CQI states
  const [gaBatches, setGaBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [gaReportData, setGaReportData] = useState<GAReportItem[] | ReadinessResponse | BatchGAReportResponse | null>(null);
  const [gaLoading, setGaLoading] = useState(false);
  const [expandedGAs, setExpandedGAs] = useState<string[]>([]);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localComment, setLocalComment] = useState<{ [key: string]: string }>({});

  // Get current user
  const currentAuth = authService.getCurrentUser();
  const isHod = currentAuth?.role === 'hod' || currentAuth?.user?.secondary_role === 'hod';

  // --- CLO CQI functions ---
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
        hod_comment: cloComments[id] || ""
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

  // --- GA CQI functions ---
  const fetchGaBatches = async () => {
    try {
      setGaLoading(true);
      const batchesData = await obeService.getAllBatches();
      setGaBatches(batchesData);
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch batches');
    } finally {
      setGaLoading(false);
    }
  };

  const fetchGaReport = async () => {
    if (!selectedBatchId) return;
    setGaLoading(true);
    try {
      const data = await obeService.getBatchGAReport(selectedBatchId, { mode: 'cumulative', scope: 'cohort' });
      setGaReportData(data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch GA report');
    } finally {
      setGaLoading(false);
    }
  };

  const toggleGAExpansion = (gaCode: string) => {
    setExpandedGAs(prev =>
      prev.includes(gaCode)
        ? prev.filter(code => code !== gaCode)
        : [...prev, gaCode]
    );
  };

  const toggleHistory = (cqiId: string) => {
    setExpandedHistory(prev => prev === cqiId ? null : cqiId);
  };

  const handleApproveCqi = async (cqiId: string) => {
    setSubmitting(true);
    try {
      await obeService.approveGACQI(cqiId);
      toast.success('GA CQI approved');
      fetchGaReport();
    } catch (error) {
      console.error(error);
      toast.error('Failed to approve CQI');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectCqi = async (cqiId: string) => {
    const comment = localComment[cqiId] || prompt('Please provide a rejection comment:');
    if (!comment) return;
    setSubmitting(true);
    try {
      await obeService.rejectGACQI(cqiId, comment);
      toast.success('GA CQI rejected');
      fetchGaReport();
    } catch (error) {
      console.error(error);
      toast.error('Failed to reject CQI');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'FULLY_APPROVED':
      case 'approved':
        return 'bg-emerald-100 text-emerald-700';
      case 'PENDING':
      case 'pending':
        return 'bg-amber-100 text-amber-700';
      case 'SENT_BACK':
      case 'rejected':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'FULLY_APPROVED':
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'PENDING':
      case 'pending':
      case 'SENT_BACK':
      case 'rejected':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <XCircle className="w-4 h-4" />;
    }
  };

  // --- Helper functions for GA CQI ---
  const isBatchGAReportResponse = (data: any): data is BatchGAReportResponse => {
    return data && typeof data.is_program_end_ready === 'boolean' && Array.isArray(data.ga_reports);
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

  const getIsProgramEndReady = (): boolean => {
    if (isBatchGAReportResponse(gaReportData)) {
      return gaReportData.is_program_end_ready;
    }
    return false;
  };

  // --- Effects ---
  useEffect(() => {
    fetchCloData();
    fetchGaBatches();
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      fetchGaReport();
    }
  }, [selectedBatchId]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">HOD CQI Review</h2>

      {/* Tabs */}
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
      </div>

      {/* CLO CQI Tab */}
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
                <p><b>Instructor:</b> {item.instructor_name}</p>
                <p><b>Reason:</b> {item.reason}</p>
                <p><b>Action Plan:</b> {item.action_plan}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
};

export default HODCQI;
