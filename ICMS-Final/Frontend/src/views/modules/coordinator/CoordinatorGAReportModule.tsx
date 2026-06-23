import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileBarChart, AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronRight, Download, Send, X, MessageSquare, History } from 'lucide-react';
import obeService from '../../../api/obeService';
import authService from '../../../api/authService';
import { toast } from 'react-hot-toast';
import { GACQIRecord, GACQIResubmissionHistory, GAReportItem, ReadinessResponse, BatchGAReportResponse } from '../../../api/obeService';
import * as XLSX from 'xlsx-js-style';

const CoordinatorGAReportModule: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [reportData, setReportData] = useState<GAReportItem[] | ReadinessResponse | BatchGAReportResponse | null>(null);
  const [isProgramEndReady, setIsProgramEndReady] = useState<boolean>(false);
  const [expandedGAs, setExpandedGAs] = useState<string[]>([]);
  const [expandedCqiForm, setExpandedCqiForm] = useState<string | null>(null);
  const [localCqiData, setLocalCqiData] = useState<Record<string, Partial<GACQIRecord>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [scope, setScope] = useState<'cohort' | 'student'>('cohort');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [sortBy, setSortBy] = useState<'course_code' | 'course_ga_score' | 'semester' | 'credits'>('course_code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [students, setStudents] = useState<Array<{id: string, student_id: string, name: string, roll_number: string, is_active: boolean}>>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  
  // Get current user and role
  const currentAuth = authService.getCurrentUser();
  const isHod = currentAuth?.role === 'hod' || currentAuth?.user?.secondary_role === 'hod';
  const isCoordinator = currentAuth?.role === 'coordinator' || currentAuth?.user?.secondary_role === 'coordinator';


  // --- Fetch data ---
  // Fetch batches on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const batchesData = await obeService.getAllBatches();
        setBatches(batchesData);
      } catch (error) {
        console.error(error);
        toast.error('Failed to fetch batches');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch GA Report for selected batch
  useEffect(() => {
    const fetchReport = async () => {
      console.log("fetchReport called with:", { selectedBatchId, scope, selectedStudentId });
      if (!selectedBatchId) {
        setReportData(null);
        setIsProgramEndReady(false);
        return;
      }
      
      // If scope is student but no student selected yet, don't fetch
      if (scope === 'student' && !selectedStudentId) {
        setReportData(null);
        setIsProgramEndReady(false);
        return;
      }

      setLoading(true);
      try {
        const params: any = { mode: 'cumulative', scope };
        if (scope === 'student' && selectedStudentId) {
          params.student_id = selectedStudentId;
          console.log('Fetching student report with params:', params);
        }
        const data = await obeService.getBatchGAReport(selectedBatchId, params);
        console.log('Received report data:', data);
        setReportData(data);
        // Check if data is the new format
        if (data && 'is_program_end_ready' in data) {
          setIsProgramEndReady(data.is_program_end_ready);
        } else {
          setIsProgramEndReady(false);
        }
      } catch (error) {
        console.error("Error fetching report:", error);
        toast.error('Failed to fetch GA report');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [selectedBatchId, scope, selectedStudentId]);

  // Fetch Students for selected batch
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedBatchId) {
        setStudents([]);
        return;
      }
      try {
        console.log("Fetching students for batch:", selectedBatchId);
        const data = await obeService.getBatchStudents(selectedBatchId);
        console.log("Received students:", data);
        setStudents(data);
      } catch (error) {
        console.error("Error fetching students:", error);
        toast.error('Failed to fetch students');
      }
    };

    fetchStudents();
  }, [selectedBatchId]);

  const toggleGAExpansion = (gaCode: string) => {
    setExpandedGAs(prev =>
      prev.includes(gaCode)
        ? prev.filter(code => code !== gaCode)
        : [...prev, gaCode]
    );
  };

  const toggleCqiForm = (cqiId: string) => {
    setExpandedCqiForm(prev => prev === cqiId ? null : cqiId);
  };

  const toggleHistory = (cqiId: string) => {
    setExpandedHistory(prev => prev === cqiId ? null : cqiId);
  };

  const handleCqiInputChange = (cqiId: string, field: keyof GACQIRecord, value: any) => {
    setLocalCqiData(prev => ({
      ...prev,
      [cqiId]: {
        ...prev[cqiId],
        [field]: value
      }
    }));
  };

  const handleSaveDraft = async (cqi: any) => {
    setSubmitting(true);
    try {
      const data = localCqiData[cqi.id] || {};
      await obeService.updateGACQIRecord(cqi.id, data);
      toast.success('Draft saved successfully');
      // Refetch the report
      const params: any = { mode: 'cumulative', scope };
      if (scope === 'student' && selectedStudentId) {
        params.student_id = selectedStudentId;
      }
      const report = await obeService.getBatchGAReport(selectedBatchId, params);
      setReportData(report);
      if (report && 'is_program_end_ready' in report) {
        setIsProgramEndReady(report.is_program_end_ready);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to save draft');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitToHod = async (cqi: any) => {
    setSubmitting(true);
    try {
      const data = {
        ...(localCqiData[cqi.id] || {}),
        status: 'PENDING' as const
      };
      await obeService.updateGACQIRecord(cqi.id, data);
      toast.success('Submitted - awaiting HOD approval');
      // Refetch the report
      const params: any = { mode: 'cumulative', scope };
      if (scope === 'student' && selectedStudentId) {
        params.student_id = selectedStudentId;
      }
      const report = await obeService.getBatchGAReport(selectedBatchId, params);
      setReportData(report);
      if (report && 'is_program_end_ready' in report) {
        setIsProgramEndReady(report.is_program_end_ready);
      }
      setExpandedCqiForm(null);
    } catch (error) {
      console.error(error);
      toast.error('Failed to submit to HOD');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveCqi = async (cqiId: string) => {
    setSubmitting(true);
    try {
      await obeService.approveGACQI(cqiId);
      toast.success('CQI approved');
      const params: any = { mode: 'cumulative', scope };
      if (scope === 'student' && selectedStudentId) {
        params.student_id = selectedStudentId;
      }
      const report = await obeService.getBatchGAReport(selectedBatchId, params);
      setReportData(report);
      if (report && 'is_program_end_ready' in report) {
        setIsProgramEndReady(report.is_program_end_ready);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to approve CQI');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectCqi = async (cqiId: string) => {
    const comment = prompt('Please provide a rejection comment:');
    if (!comment) return;
    setSubmitting(true);
    try {
      await obeService.rejectGACQI(cqiId, comment);
      toast.success('CQI rejected');
      const params: any = { mode: 'cumulative', scope };
      if (scope === 'student' && selectedStudentId) {
        params.student_id = selectedStudentId;
      }
      const report = await obeService.getBatchGAReport(selectedBatchId, params);
      setReportData(report);
      if (report && 'is_program_end_ready' in report) {
        setIsProgramEndReady(report.is_program_end_ready);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to reject CQI');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Finalized':
      case 'ACHIEVED':
      case 'FULLY_APPROVED':
        return 'bg-emerald-100 text-emerald-700';
      case 'Provisional - CQI Pending':
      case 'PENDING_HOD_APPROVAL':
      case 'SEMESTER_EARLY_WARNING':
        return 'bg-amber-100 text-amber-700';
      case 'BELOW_TARGET':
      case 'PROGRAM_MASTER_CQI':
        return 'bg-rose-100 text-rose-700';
      case 'SENT_BACK':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Finalized':
      case 'ACHIEVED':
      case 'FULLY_APPROVED':
        return <CheckCircle className="w-4 h-4" />;
      case 'Provisional - CQI Pending':
      case 'BELOW_TARGET':
      case 'PENDING_HOD_APPROVAL':
      case 'SEMESTER_EARLY_WARNING':
      case 'PROGRAM_MASTER_CQI':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <XCircle className="w-4 h-4" />;
    }
  };

  // Filter students based on search query
  const getFilteredStudents = () => {
    console.log("getFilteredStudents called, students:", students, "searchQuery:", studentSearchQuery);
    if (!studentSearchQuery) return students;
    const lowerQuery = studentSearchQuery.toLowerCase();
    return students.filter(student => 
      student.name.toLowerCase().includes(lowerQuery) ||
      student.roll_number.toLowerCase().includes(lowerQuery) ||
      student.student_id.toLowerCase().includes(lowerQuery)
    );
  };

  const getSortedFilteredCourses = (courses: any[], kpiThreshold: number) => {
    let filteredCourses = [...courses];

    // Apply search filter
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filteredCourses = filteredCourses.filter(course => 
        course.course_code.toLowerCase().includes(lowerQuery) ||
        (course.course_name?.toLowerCase().includes(lowerQuery) || '')
      );
    }

    // Apply sorting
    filteredCourses.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      // Handle null/undefined values
      if (aVal === null || aVal === undefined) aVal = 0;
      if (bVal === null || bVal === undefined) bVal = 0;

      // Handle string vs number comparisons
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filteredCourses;
  };

  const handleExport = () => {
    if (!reportData) {
      toast.error('No report data to export');
      return;
    }

    const gaItems = getGAItems();
    const selectedBatch = batches.find(b => b.id === selectedBatchId);
    const wb = XLSX.utils.book_new();
    
    // --- Summary Sheet ---
    const summaryHeaderRows: any[][] = [
      [selectedBatch?.program?.name || selectedBatch?.name || 'Program'],
      ['GA Attainment Summary Report'],
      ['Date: ' + new Date().toLocaleDateString()]
    ];
    
    const summaryData: any[] = [...summaryHeaderRows];
    summaryData.push([
      'Type',
      'GA Code',
      'GA Title',
      'GA Attainment',
      'KPI Threshold',
      'Status',
      'Course Code',
      'Course Name',
      'Semester',
      'Credits',
      'Course GA Score',
      'Enrolled Students'
    ]);
    
    const summaryStatusIndices: number[] = [];
    gaItems.forEach((ga) => {
      // Add GA Summary row
      summaryStatusIndices.push(summaryData.length);
      summaryData.push([
        'GA Summary',
        ga.ga_code,
        ga.ga_title,
        ga.ga_attainment ? ga.ga_attainment.toFixed(1) + '%' : '0.0%',
        (ga.ga_kpi_threshold ?? 0).toFixed(1) + '%',
        ga.status,
        '',
        '',
        '',
        '',
        '',
        ''
      ]);
      
      // Add contributing courses
      (ga.contributing_courses || []).forEach((course) => {
        summaryData.push([
          'Contributing Course',
          ga.ga_code,
          ga.ga_title,
          '',
          '',
          '',
          course.course_code,
          course.course_name || '',
          course.semester || '',
          course.credits || '',
          course.course_ga_score ? course.course_ga_score.toFixed(1) + '%' : '0.0%',
          course.enrolled_students || ''
        ]);
      });
      
      // Add empty row between GAs
      summaryData.push([]);
    });
    
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Style Summary Sheet
    const summaryMerges = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }, // Program name
      { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } }, // Report title
      { s: { r: 2, c: 0 }, e: { r: 2, c: 11 } }  // Date
    ];
    
    summaryWs['!merges'] = summaryMerges;
    
    const summaryRange = XLSX.utils.decode_range(summaryWs['!ref'] || 'A1');
    const columnHeaderRow = 3;
    
    for (let R = 0; R <= summaryRange.e.r; ++R) {
      for (let C = 0; C <= 11; ++C) {
        const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
        if (!summaryWs[cell_address]) continue;
        
        if (R < 3) {
          // Header rows - beautiful professional styling
          summaryWs[cell_address].s = {
            fill: { fgColor: { rgb: '4472C4' } },
            font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 14 },
            alignment: { horizontal: 'center', vertical: 'center' }
          };
        } else if (R === columnHeaderRow) { // Column headers - grayish
          summaryWs[cell_address].s = {
            fill: { fgColor: { rgb: 'E7E6E6' } },
            font: { bold: true },
            alignment: { horizontal: 'center' }
          };
        } else if (summaryStatusIndices.includes(R)) {
          // GA summary rows - apply background to entire row
          const statusIndex = summaryStatusIndices.indexOf(R);
          const status = gaItems[statusIndex].status;
          
          summaryWs[cell_address].s = {
            fill: { fgColor: { rgb: status === 'ACHIEVED' ? 'C6EFCE' : 'FFC7CE' } },
            font: { color: { rgb: status === 'ACHIEVED' ? '006100' : '9C0006' }, bold: true },
            alignment: { horizontal: 'center' }
          };
        } else if (summaryWs[cell_address].v === 'Contributing Course') {
          // Contributing Course Type column - light gray
          summaryWs[cell_address].s = {
            fill: { fgColor: { rgb: 'E7E6E6' } },
            font: { bold: true },
            alignment: { horizontal: 'center' }
          };
        }
      }
    }
    
    // Set Summary column widths
    summaryWs['!cols'] = [
      { wch: 20 },
      { wch: 15 },
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 30 },
      { wch: 10 },
      { wch: 10 },
      { wch: 18 },
      { wch: 18 }
    ];
    
    // --- GA Report Sheet ---
    // Prepare header data
    const headerRows: any[][] = [
      [selectedBatch?.program?.name || selectedBatch?.name || 'Program'],
      ['GA Attainment Report'],
      ['Date: ' + new Date().toLocaleDateString()]
    ];
    
    // Convert header to sheet with merged cells
    const wsData: any[] = [...headerRows];
    const gaSummaryRowIndices: number[] = [];
    const gaStatuses: string[] = [];
    const courseHeaderRowIndices: number[] = [];
    
    // Add each GA
    gaItems.forEach((ga) => {
      // Track GA summary row index
      gaSummaryRowIndices.push(wsData.length);
      gaStatuses.push(ga.status);
      
      // Add GA summary row
      const gaRow = [
        'GA Summary',
        ga.ga_code,
        ga.ga_title,
        ga.ga_attainment ? ga.ga_attainment.toFixed(1) + '%' : '0.0%',
        (ga.ga_kpi_threshold ?? 0).toFixed(1) + '%',
        ga.status
      ];
      wsData.push(gaRow);
      
      // Add contributing courses header
      wsData.push([
        'Contributing Courses',
        '',
        '',
        '',
        '',
        ''
      ]);
      // Track course header row index
      courseHeaderRowIndices.push(wsData.length);
      wsData.push([
        'Course Code',
        'Course Name',
        'Semester',
        'Credits',
        'Course GA Score',
        'Enrolled Students'
      ]);
      
      // Add contributing courses
      (ga.contributing_courses || []).forEach((course) => {
        wsData.push([
          course.course_code,
          course.course_name || '',
          course.semester || '',
          course.credits || '',
          course.course_ga_score ? course.course_ga_score.toFixed(1) + '%' : '0.0%',
          course.enrolled_students || ''
        ]);
      });
      
      // Add empty row between GAs
      wsData.push([]);
    });
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Style header (blue, bold, merged)
    const merges = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Program name
      { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Report title
      { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } }  // Date
    ];
    
    ws['!merges'] = merges;
    
    // Style cells
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    
    // Apply styles
    for (let R = 0; R <= range.e.r; ++R) {
      for (let C = 0; C <= 5; ++C) {
        const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
        if (!ws[cell_address]) continue;
        
        if (R < 3) {
          // Header rows - beautiful professional styling
          ws[cell_address].s = {
            fill: { fgColor: { rgb: '4472C4' } },
            font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 14 },
            alignment: { horizontal: 'center', vertical: 'center' }
          };
        } else if (gaSummaryRowIndices.includes(R)) {
          // GA summary row - apply background to entire row
          const statusIndex = gaSummaryRowIndices.indexOf(R);
          const status = gaStatuses[statusIndex];
          
          ws[cell_address].s = {
            fill: { fgColor: { rgb: status === 'ACHIEVED' ? 'C6EFCE' : 'FFC7CE' } },
            font: { color: { rgb: status === 'ACHIEVED' ? '006100' : '9C0006' }, bold: true },
            alignment: { horizontal: 'center' }
          };
        } else if (ws[cell_address].v === 'Contributing Courses') {
          // Contributing courses header - gray background
          ws[cell_address].s = {
            fill: { fgColor: { rgb: 'E7E6E6' } },
            font: { bold: true }
          };
        } else if (courseHeaderRowIndices.includes(R)) { // All course headers
          ws[cell_address].s = {
            fill: { fgColor: { rgb: 'E7E6E6' } },
            font: { bold: true },
            alignment: { horizontal: 'center' }
          };
        } else if (C === 4) { // Course GA Score column
          ws[cell_address].s = {
            font: { bold: true },
            alignment: { horizontal: 'center' }
          };
        }
      }
    }
    
    // Set column widths
    ws['!cols'] = [
      { wch: 20 },
      { wch: 40 },
      { wch: 10 },
      { wch: 10 },
      { wch: 20 },
      { wch: 20 }
    ];
    
    // Add sheets to workbook
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    XLSX.utils.book_append_sheet(wb, ws, 'GA Report');
    
    // Generate filename
    const filename = `GA_Report_${selectedBatch?.name?.replace(/\s+/g, '_') || 'Selected_Batch'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Download
    XLSX.writeFile(wb, filename);
    toast.success('Report exported successfully');
  };

  // --- Render ---
  if (loading && !batches.length) {

    return (
      <div className="space-y-6 p-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-full mb-2" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (!selectedBatchId) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-2xl font-black text-gray-900">GA Reports</h2>
          <p className="text-gray-500 font-semibold mt-1">Automatically generated when all course CLO reports are finalized</p>
          <div className="mt-6">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Select Batch</label>
            <select
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
            >
              <option value="">Select a batch</option>
              {batches.map(batch => (
                <option key={batch.id} value={batch.id}>{batch.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-full mb-2" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  // Only return null if reportData is null AND we're not in student scope OR we have a selected student but no reportData
  if (!reportData && !(scope === 'student' && !selectedStudentId)) {
    return null;
  }

  // Type guard to check if it's a readiness response
  const isReadinessResponse = (data: any): data is ReadinessResponse => {
    return data && typeof data.ready === 'boolean';
  };

  // Type guard to check if it's a BatchGAReportResponse
  const isBatchGAReportResponse = (data: any): data is BatchGAReportResponse => {
    return data && typeof data.is_program_end_ready === 'boolean' && Array.isArray(data.ga_reports);
  };

  // Type guard to check if it's a GA array
  const isGAArray = (data: any): data is GAReportItem[] => {
    return Array.isArray(data);
  };

  // Helper to get GA items from report data
  const getGAItems = (): GAReportItem[] => {
    console.log("getGAItems() called, reportData is", reportData);
    if (isBatchGAReportResponse(reportData)) {
      console.log("getGAItems() returning reportData.ga_reports:", reportData.ga_reports);
      return reportData.ga_reports;
    } else if (isGAArray(reportData)) {
      console.log("getGAItems() returning reportData (array):", reportData);
      return reportData;
    }
    console.log("getGAItems() returning empty array");
    return [];
  };

  // Handle readiness response (not ready)
  if (isReadinessResponse(reportData) && !reportData.ready) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-black text-gray-900">GA Reports</h2>
              <p className="text-gray-500 font-semibold mt-1">Automatically generated when all course CLO reports are finalized</p>
            </div>
            <button
              onClick={() => setSelectedBatchId('')}
              className="flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
              Change Batch
            </button>
          </div>
          <div className="mt-6">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Select Batch</label>
            <select
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
            >
              <option value="">Select a batch</option>
              {batches.map(batch => (
                <option key={batch.id} value={batch.id}>{batch.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <div className="text-center mb-8">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-6" />
            <h3 className="text-xl font-black text-gray-900 mb-2">GA Report Not Ready Yet</h3>
            <p className="text-gray-500 font-semibold">Please resolve the following issues</p>
          </div>

          {/* Readiness Progress */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-50 p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Courses Assessment Done</p>
                <span className="text-lg font-black text-gray-900">
                  {reportData.finalized_courses ?? 0}/{reportData.total_courses ?? 0}
                </span>
              </div>
              <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500"
                  style={{ width: `${((reportData.finalized_courses ?? 0) / (reportData.total_courses ?? 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Blocking Reasons */}
          <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
            <p className="text-sm font-black text-amber-700 uppercase tracking-widest mb-4">Blocking Reasons</p>
            <ul className="space-y-2">
              {(reportData.missing_courses ?? []).map((course: string, idx: number) => (
                <li key={idx} className="flex items-center gap-3 text-amber-800 font-medium">
                  <span className="text-amber-500">•</span>
                  Course {course} assessment not done
                </li>
              ))}
              {(reportData.missing_courses ?? []).length === 0 && (
                <li className="flex items-center gap-3 text-amber-800 font-medium">
                  <span className="text-amber-500">•</span>
                  Report not ready
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // If neither array nor new response AND we're not in student scope without a selected student, return null
  if (!isGAArray(reportData) && !isBatchGAReportResponse(reportData) && !(scope === 'student' && !selectedStudentId)) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-black text-gray-900">GA Reports</h2>
            <p className="text-gray-500 font-semibold mt-1">Automatically generated when all course CLO reports are finalized</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedBatchId('')}
              className="flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
              Change Batch
            </button>
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100"
            >
              <Download size={18} />
              Export Report
            </button>
          </div>
        </div>
        
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Scope</label>
            <select
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
              value={scope}
              onChange={(e) => setScope(e.target.value as 'cohort' | 'student')}
            >
              <option value="cohort">Cohort (Batch)</option>
              <option value="student">Student</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Search Courses</label>
            <input
              type="text"
              placeholder="Search by course code or name"
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Student or Cohort View */}
      {scope === 'student' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Pane: Student List */}
          <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
              <FileBarChart className="w-5 h-5 text-indigo-600" />
              Students
            </h3>
            {/* Search Input */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by name, roll no, or ID..."
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
                value={studentSearchQuery}
                onChange={(e) => setStudentSearchQuery(e.target.value)}
              />
            </div>
            {/* Student List */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {getFilteredStudents().map((student) => (
                <div
                  key={student.id}
                  onClick={() => setSelectedStudentId(student.id)}
                  className={`p-4 rounded-xl cursor-pointer transition-all ${
                    selectedStudentId === student.id
                      ? 'bg-indigo-50 border-2 border-indigo-300'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <div className="font-bold text-gray-800">{student.name}</div>
                  <div className="text-sm text-gray-500">Roll No: {student.roll_number}</div>
                  <div className="text-xs text-gray-400">ID: {student.student_id}</div>
                </div>
              ))}
              {getFilteredStudents().length === 0 && (
                <div className="text-center py-8 text-gray-400">No students found</div>
              )}
            </div>
          </div>

          {/* Right Pane: Student Report */}
          <div className="lg:col-span-2">
            {loading ? (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </div>
            ) : !selectedStudentId ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-xl font-black text-gray-800 mb-2">Select a Student</h3>
                <p className="text-gray-500">Choose a student from the list to view their GA report</p>
              </div>
            ) : (
              <div>
                {/* Selected Student Header */}
                {(() => {
                  const selectedStudent = students.find(s => s.id === selectedStudentId);
                  if (selectedStudent) {
                    return (
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                        <h3 className="text-xl font-black text-gray-800">{selectedStudent.name}</h3>
                        <p className="text-gray-500 font-semibold">Roll No: {selectedStudent.roll_number} • ID: {selectedStudent.student_id}</p>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* GA Summary Cards */}
                <div>
                  <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                    <FileBarChart className="w-5 h-5 text-indigo-600" />
                    Graduate Attribute Summary
                  </h3>                  <div className="space-y-4">
                    {getGAItems().length === 0 && (
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
                        <div className="text-2xl mb-4">📊</div>
                        <p className="text-gray-500">No GA data available for this student</p>
                      </div>
                    )}
                    {getGAItems().map((ga: GAReportItem) => (
                      <motion.div
                        key={ga.ga_code ?? `ga-${Math.random()}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                      >
                        {/* GA Header */}
                        <div
                          className="p-6 flex items-center justify-between cursor-pointer"
                          onClick={() => toggleGAExpansion(ga.ga_code)}
                        >
                          <div className="flex items-center gap-4">
                            {expandedGAs.includes(ga.ga_code) ? <ChevronDown size={20} className="text-gray-500" /> : <ChevronRight size={20} className="text-gray-500" />}
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                <h4 className="text-xl font-bold text-gray-800">{ga.ga_code}</h4>
                                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadgeColor(ga.status)}`}>
                                  {getStatusIcon(ga.status)}
                                  {ga.status}
                                </span>
                              </div>
                              <p className="text-gray-600 font-medium">{ga.ga_title}</p>
                            </div>
                          </div>

                          {/* GA Attainment */}
                          <div className="text-center">
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">GA Attainment</p>
                            <p className="text-2xl font-black text-gray-900">{ga.ga_attainment?.toFixed(1) ?? '0.0'}%</p>
                            <p className="text-xs text-gray-500">KPI: {ga.ga_kpi_threshold?.toFixed(1) ?? '0.0'}%</p>
                          </div>
                        </div>

                        {/* Expandable Contributing Courses */}
                        {expandedGAs.includes(ga.ga_code) && (
                          <div className="border-t border-gray-100 bg-gray-50 p-6">
                            <div className="flex items-center justify-between mb-4">
                              <h5 className="text-sm font-black text-gray-400 uppercase tracking-widest">Contributing Courses</h5>
                              <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-gray-500">Sort by:</label>
                                <select
                                  className="bg-white border border-gray-200 rounded-lg px-3 py-1 text-sm font-bold text-gray-700"
                                  value={sortBy}
                                  onChange={(e) => setSortBy(e.target.value as any)}
                                >
                                  <option value="course_code">Course Code</option>
                                  <option value="course_ga_score">GA Score</option>
                                  <option value="semester">Semester</option>
                                  <option value="credits">Credits</option>
                                </select>
                                <button
                                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                  className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-3 py-1 text-sm font-bold text-gray-700 hover:bg-gray-100 transition-all"
                                >
                                  {sortOrder === 'asc' ? 'Asc' : 'Desc'}
                                </button>
                              </div>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white mb-6">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-gray-50">
                                    <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Course</th>
                                    <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-center">Semester</th>
                                    <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-center">Credits</th>
                                    <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-center">Course GA Score</th>
                                    <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-center">Enrolled Students</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {getSortedFilteredCourses(ga.contributing_courses ?? [], ga.ga_kpi_threshold).map((course: any, idx: number) => {
                                    const isBelowTarget = course.course_ga_score < ga.ga_kpi_threshold;
                                    return (
                                      <tr key={idx} className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${isBelowTarget ? 'bg-red-50' : ''}`}>
                                        <td className="px-4 py-3">
                                          <div className="font-bold text-gray-700">
                                            {course.course_code ?? 'N/A'}
                                          </div>
                                          <div className="text-sm text-gray-600">
                                            {course.course_name ?? 'N/A'}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold text-gray-700">
                                          {course.semester ?? 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold text-gray-700">
                                          {course.credits ?? 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold">
                                          <span className={isBelowTarget ? 'text-red-600' : 'text-emerald-600'}>
                                            {course.course_ga_score?.toFixed(1) ?? '0.0'}%
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold text-gray-700">{course.enrolled_students ?? '0'}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Cohort View
        <div>
          {/* GA Summary Cards */}
          <div>
            <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
              <FileBarChart className="w-5 h-5 text-indigo-600" />
              Graduate Attribute Summary
            </h3>
            <div className="space-y-4">
              {getGAItems().length === 0 && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
                  <div className="text-2xl mb-4">📊</div>
                  <p className="text-gray-500">No GA data available for this cohort</p>
                </div>
              )}
              {getGAItems().map((ga: GAReportItem) => (
                <motion.div
                  key={ga.ga_code ?? `ga-${Math.random()}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  {/* GA Header */}
                  <div
                    className="p-6 flex items-center justify-between cursor-pointer"
                    onClick={() => toggleGAExpansion(ga.ga_code)}
                  >
                    <div className="flex items-center gap-4">
                      {expandedGAs.includes(ga.ga_code) ? <ChevronDown size={20} className="text-gray-500" /> : <ChevronRight size={20} className="text-gray-500" />}
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="text-xl font-bold text-gray-800">{ga.ga_code}</h4>
                          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadgeColor(ga.status)}`}>
                            {getStatusIcon(ga.status)}
                            {ga.status}
                          </span>
                        </div>
                        <p className="text-gray-600 font-medium">{ga.ga_title}</p>
                      </div>
                    </div>

                    {/* GA Attainment */}
                    <div className="text-center">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">GA Attainment</p>
                      <p className="text-2xl font-black text-gray-900">{ga.ga_attainment?.toFixed(1) ?? '0.0'}%</p>
                      <p className="text-xs text-gray-500">KPI: {ga.ga_kpi_threshold?.toFixed(1) ?? '0.0'}%</p>
                    </div>
                  </div>

                  {/* Expandable Contributing Courses */}
                  {expandedGAs.includes(ga.ga_code) && (
                    <div className="border-t border-gray-100 bg-gray-50 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="text-sm font-black text-gray-400 uppercase tracking-widest">Contributing Courses</h5>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-gray-500">Sort by:</label>
                          <select
                            className="bg-white border border-gray-200 rounded-lg px-3 py-1 text-sm font-bold text-gray-700"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                          >
                            <option value="course_code">Course Code</option>
                            <option value="course_ga_score">GA Score</option>
                            <option value="semester">Semester</option>
                            <option value="credits">Credits</option>
                          </select>
                          <button
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-3 py-1 text-sm font-bold text-gray-700 hover:bg-gray-100 transition-all"
                          >
                            {sortOrder === 'asc' ? 'Asc' : 'Desc'}
                          </button>
                        </div>
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white mb-6">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Course</th>
                              <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-center">Semester</th>
                              <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-center">Credits</th>
                              <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-center">Course GA Score</th>
                              <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-center">Enrolled Students</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getSortedFilteredCourses(ga.contributing_courses ?? [], ga.ga_kpi_threshold).map((course: any, idx: number) => {
                              const isBelowTarget = course.course_ga_score < ga.ga_kpi_threshold;
                              return (
                                <tr key={idx} className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${isBelowTarget ? 'bg-red-50' : ''}`}>
                                  <td className="px-4 py-3">
                                    <div className="font-bold text-gray-700">
                                      {course.course_code ?? 'N/A'}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      {course.course_name ?? 'N/A'}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-center font-bold text-gray-700">
                                    {course.semester ?? 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 text-center font-bold text-gray-700">
                                    {course.credits ?? 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 text-center font-bold">
                                    <span className={isBelowTarget ? 'text-red-600' : 'text-emerald-600'}>
                                      {course.course_ga_score?.toFixed(1) ?? '0.0'}%
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center font-bold text-gray-700">{course.enrolled_students ?? '0'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* GA CQI Records (only for cohort and program end ready) */}
                      {isProgramEndReady && ga.ga_cqi_records && ga.ga_cqi_records.length > 0 && (
                        <div>
                          <h5 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">GA CQI Records</h5>
                          <div className="space-y-4">
                            {ga.ga_cqi_records.map((cqi: any) => (
                              <div key={cqi.id ?? `cqi-${Math.random()}`} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                                <div
                                  className="p-4 flex items-center justify-between cursor-pointer bg-gray-50"
                                  onClick={() => toggleCqiForm(cqi.id ?? '')}
                                >
                                  <div className="flex items-center gap-3">
                                    {expandedCqiForm === cqi.id ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadgeColor(cqi.status ?? '')}`}>
                                          {getStatusIcon(cqi.status ?? '')}
                                          {cqi.status ?? 'N/A'}
                                        </span>
                                        <span className="text-sm font-bold text-gray-700">
                                          {cqi.cqi_level === 'SEMESTER' ? 'Semester End CQI' : cqi.cqi_level === 'CUMULATIVE' ? 'Program End CQI' : cqi.cqi_level ?? 'N/A'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleHistory(cqi.id ?? '');
                                      }}
                                      className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 font-medium text-sm"
                                    >
                                      <History size={16} />
                                      History
                                    </button>
                                  </div>
                                </div>

                                {/* CQI History */}
                                {expandedHistory === cqi.id && (
                                  <div className="p-4 border-t border-gray-100">
                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Submission History</div>
                                    <div className="space-y-3">
                                      {cqi.history && cqi.history.length > 0 ? (
                                        cqi.history.map((history: GACQIResubmissionHistory, idx: number) => (
                                          <div key={history.id} className="bg-gray-50 p-3 rounded-xl">
                                            <div className="flex items-center justify-between mb-2">
                                              <span className={`text-xs font-black uppercase tracking-wider ${getStatusBadgeColor(history.status_at_time ?? '')}`}>
                                                {history.status_at_time}
                                              </span>
                                              <span className="text-xs text-gray-500">
                                                {new Date(history.submitted_at).toLocaleString()}
                                              </span>
                                            </div>
                                            <div className="text-sm text-gray-600 space-y-1">
                                              {history.root_cause_snapshot && <div><span className="font-semibold">Root Cause:</span> {history.root_cause_snapshot}</div>}
                                              {history.remedial_plan_snapshot && <div><span className="font-semibold">Remedial Plan:</span> {history.remedial_plan_snapshot}</div>}
                                              {history.hod_comment_snapshot && <div><span className="font-semibold">HOD Comment:</span> {history.hod_comment_snapshot}</div>}
                                            </div>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-sm text-gray-500">No history available</div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* CQI Form */}
                                {expandedCqiForm === cqi.id && (
                                  <div className="p-4 border-t border-gray-100">
                                    {/* Contributing Courses (for context) */}
                                    {cqi.contributing_courses && cqi.contributing_courses.length > 0 && (
                                      <div className="mb-4">
                                        <div className="flex items-center gap-2 mb-3">
                                          <FileBarChart size={16} className="text-indigo-600" />
                                          <span className="text-sm font-black text-gray-400 uppercase tracking-widest">Contributing Courses (sorted by lowest GA score)</span>
                                        </div>
                                        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
                                          <table className="w-full text-left border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Course</th>
                                                <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-center">Course GA Score</th>
                                                <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-center">Enrolled Students</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {(cqi.contributing_courses ?? []).map((course: any, idx: number) => (
                                                <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                                                  <td className="px-4 py-3">
                                                    <div className="font-bold text-gray-700">
                                                      {course.course_code ?? 'N/A'}
                                                    </div>
                                                    <div className="text-sm text-gray-600">
                                                      {course.course_name ?? 'N/A'}
                                                      {course.semester && (
                                                        <span className="ml-2 text-xs font-semibold text-gray-500">(Semester {course.semester})</span>
                                                      )}
                                                    </div>
                                                  </td>
                                                  <td className="px-4 py-3 text-center font-bold text-gray-700">{course.course_ga_score?.toFixed(1) ?? '0.0'}%</td>
                                                  <td className="px-4 py-3 text-center font-bold text-gray-700">{course.enrolled_students ?? '0'}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}

                                    {cqi.hod_comment && (
                                      <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                          <MessageSquare size={16} className="text-amber-600" />
                                          <span className="text-sm font-bold text-amber-700">HOD Comment</span>
                                        </div>
                                        <p className="text-sm text-amber-800">{cqi.hod_comment}</p>
                                      </div>
                                    )}

                                    {cqi.is_locked && (
                                      <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-xl">
                                        <div className="flex items-center gap-2">
                                          <CheckCircle size={16} className="text-green-600" />
                                          <span className="text-sm font-bold text-green-700">Locked - Program End CQI Approved</span>
                                        </div>
                                      </div>
                                    )}

                                    <div className="space-y-4">
                                      <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Root Cause</label>
                                        <textarea
                                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
                                          rows={3}
                                          value={localCqiData[cqi.id]?.root_cause ?? cqi.root_cause ?? ''}
                                          onChange={(e) => handleCqiInputChange(cqi.id ?? '', 'root_cause', e.target.value)}
                                          disabled={cqi.status === 'FULLY_APPROVED' || cqi.is_locked || !isCoordinator}
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Remedial Plan</label>
                                        <textarea
                                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
                                          rows={3}
                                          value={localCqiData[cqi.id]?.remedial_plan ?? cqi.remedial_plan ?? ''}
                                          onChange={(e) => handleCqiInputChange(cqi.id ?? '', 'remedial_plan', e.target.value)}
                                          disabled={cqi.status === 'FULLY_APPROVED' || cqi.is_locked || !isCoordinator}
                                        />
                                      </div>

                                      <div className="flex items-center justify-between">
                                        {!cqi.is_locked && cqi.status !== 'FULLY_APPROVED' && (
                                          <div className="flex items-center gap-2">
                                            {cqi.status === 'PENDING' ? (
                                              <>
                                                {isHod && (
                                                  <>
                                                    <button
                                                      onClick={() => handleApproveCqi(cqi.id ?? '')}
                                                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold transition-all"
                                                      disabled={submitting}
                                                    >
                                                      <CheckCircle size={16} />
                                                      Approve
                                                    </button>
                                                    <button
                                                      onClick={() => handleRejectCqi(cqi.id ?? '')}
                                                      className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl font-bold transition-all"
                                                      disabled={submitting}
                                                    >
                                                      <XCircle size={16} />
                                                      Reject
                                                    </button>
                                                  </>
                                                )}
                                              </>
                                            ) : (
                                              isCoordinator && (
                                                <>
                                                  <button
                                                    onClick={() => handleSaveDraft(cqi)}
                                                    className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-xl font-bold transition-all"
                                                    disabled={submitting}
                                                  >
                                                    Save Draft
                                                  </button>
                                                  <button
                                                    onClick={() => handleSubmitToHod(cqi)}
                                                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold transition-all"
                                                    disabled={submitting}
                                                  >
                                                    <Send size={16} />
                                                    Submit to HOD
                                                  </button>
                                                </>
                                              )
                                            )}
                                          </div>
                                        )}
                                        <button
                                          onClick={() => setExpandedCqiForm(null)}
                                          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 font-medium"
                                        >
                                          <XCircle size={16} />
                                          Close
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoordinatorGAReportModule;
