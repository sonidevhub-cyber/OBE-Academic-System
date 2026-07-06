import React, { useState, useEffect, useMemo } from 'react';
import obeService, { GAReportItem, Batch, BatchGAReportResponse, GAReportContributingCourse, GACQIRecord } from '../api/obeService';
import { toast } from 'react-hot-toast';
import authService from '../api/authService';
import * as XLSX from 'xlsx-js-style';

const GAReport: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [mode, setMode] = useState<'semester' | 'cumulative'>('cumulative');
  const [selectedSemester, setSelectedSemester] = useState<number>(1);
  const [report, setReport] = useState<GAReportItem[] | { ready: boolean; [key: string]: any } | BatchGAReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedGA, setExpandedGA] = useState<string | null>(null);
  const [expandedCqiForm, setExpandedCqiForm] = useState<{ [key: string]: boolean }>({});
  const [localCqiData, setLocalCqiData] = useState<{ [key: string]: { root_cause: string; remedial_plan: string; hod_comment: string } }>({});
  const [submitting, setSubmitting] = useState<{ [key: string]: boolean }>({});
  const [isProgramEndReady, setIsProgramEndReady] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'course_code' | 'course_ga_score' | 'semester' | 'credits'>('course_code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Get actual user role
  const authData = authService.getCurrentUser();
  const userRole = useMemo((): 'hod' | 'coordinator' | 'teacher' | 'student' => {
    if (authData?.role === 'hod' || authData?.user?.secondary_role === 'hod') return 'hod';
    if (authData?.role === 'coordinator' || authData?.user?.secondary_role === 'coordinator') return 'coordinator';
    if (authData?.role === 'teacher' || authData?.user?.secondary_role === 'teacher') return 'teacher';
    return 'student';
  }, [authData]);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const data = await obeService.getAllBatches();
        setBatches(data);
        if (data.length > 0) {
          setSelectedBatch(data[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch batches:', error);
      }
    };
    fetchBatches();
  }, []);

  const gaItems = useMemo(() => {
    if (!report) return [];
    if ('ga_reports' in report) return report.ga_reports;
    if (Array.isArray(report)) return report;
    return [];
  }, [report]);

  useEffect(() => {
    if (!selectedBatch) return;
    const fetchReport = async () => {
      setLoading(true);
      try {
        console.log('Fetching GA report');
        const data = await obeService.getBatchGAReport(selectedBatch);
        console.log('Received data:', data);
        setReport(data);
        
        // Set isProgramEndReady
        if ('is_program_end_ready' in data) {
          setIsProgramEndReady(data.is_program_end_ready);
        } else {
          setIsProgramEndReady(false);
        }

        // Initialize local CQI data
        const initialCqiData: typeof localCqiData = {};
        const items = 'ga_reports' in data ? data.ga_reports : (Array.isArray(data) ? data : []);
        items.forEach(ga => {
          ga.ga_cqi_records.forEach(cqi => {
            initialCqiData[cqi.id] = {
              root_cause: cqi.root_cause || '',
              remedial_plan: cqi.remedial_plan || '',
              hod_comment: ''
            };
          });
        });
        setLocalCqiData(initialCqiData);
      } catch (error) {
        console.error('Failed to fetch GA report:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [selectedBatch]);

  const isReady = useMemo(() => {
    if (!report) return false;
    if ('ready' in report) return report.ready;
    return true;
  }, [report]);

  const failedGAs = useMemo(() => {
    return gaItems.filter((ga: GAReportItem) => ga.status === 'BELOW_TARGET');
  }, [gaItems]);

  const getSortedFilteredCourses = (courses: GAReportContributingCourse[], kpiThreshold: number) => {
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

  const refreshReport = async () => {
    const newReport = await obeService.getBatchGAReport(selectedBatch);
    setReport(newReport);
    if ('is_program_end_ready' in newReport) {
      setIsProgramEndReady(newReport.is_program_end_ready);
    }
  };

  const handleSaveDraft = async (cqiId: string) => {
    setSubmitting(prev => ({ ...prev, [cqiId]: true }));
    try {
      const data = localCqiData[cqiId];
      await obeService.updateGACQIRecord(cqiId, {
        root_cause: data.root_cause,
        remedial_plan: data.remedial_plan
      });
      await refreshReport();
      toast.success('Draft saved successfully!');
    } catch (error) {
      console.error('Failed to save draft:', error);
      toast.error('Failed to save draft');
    } finally {
      setSubmitting(prev => ({ ...prev, [cqiId]: false }));
    }
  };

  const handleSubmitToHod = async (cqiId: string) => {
    setSubmitting(prev => ({ ...prev, [cqiId]: true }));
    try {
      const data = localCqiData[cqiId];
      // Update the existing record and set status to PENDING
      await obeService.updateGACQIRecord(cqiId, {
        root_cause: data.root_cause,
        remedial_plan: data.remedial_plan,
        status: 'PENDING'
      });
      await refreshReport();
      toast.success('Submitted — awaiting HOD approval!');
    } catch (error) {
      console.error('Failed to submit to HOD:', error);
      toast.error('Failed to submit to HOD');
    } finally {
      setSubmitting(prev => ({ ...prev, [cqiId]: false }));
    }
  };

  const handleApprove = async (cqiId: string) => {
    setSubmitting(prev => ({ ...prev, [cqiId]: true }));
    try {
      await obeService.approveGACQI(cqiId);
      await refreshReport();
      toast.success('CQI approved!');
    } catch (error) {
      console.error('Failed to approve CQI:', error);
      toast.error('Failed to approve CQI');
    } finally {
      setSubmitting(prev => ({ ...prev, [cqiId]: false }));
    }
  };

  const handleReject = async (cqiId: string) => {
    setSubmitting(prev => ({ ...prev, [cqiId]: true }));
    try {
      const data = localCqiData[cqiId];
      await obeService.rejectGACQI(cqiId, data.hod_comment);
      await refreshReport();
      toast.success('CQI sent back!');
    } catch (error) {
      console.error('Failed to reject CQI:', error);
      toast.error('Failed to reject CQI');
    } finally {
      setSubmitting(prev => ({ ...prev, [cqiId]: false }));
    }
  };

  const handleExport = () => {
    if (!report || !isReady) {
      toast.error('No report data to export');
      return;
    }

    const selectedBatchObj = batches.find(b => b.id === selectedBatch);
    const wb = XLSX.utils.book_new();
    
    // --- Summary Sheet ---
    const summaryHeaderRows: any[][] = [
      [selectedBatchObj?.program?.name || 'Program Name'],
      ['Department: ' + (selectedBatchObj?.program?.department || 'Computer Science')],
      ['Batch: ' + (selectedBatchObj?.name || 'Selected Batch')],
      ['GA Attainment Summary Report'],
      ['Date: ' + new Date().toLocaleDateString()],
      [],
      []
    ];
    
    const summaryData: any[] = [...summaryHeaderRows];
    summaryData.push([
      'Type',
      'GA Code',
      'GA Title',
      'Direct Score',
      'Indirect Score',
      'GA Attainment',
      'KPI Threshold',
      'Status',
      'Course Code',
      'Course Name',
      'Semester',
      'Credits',
      'Course Direct Score',
      'Course Indirect Score',
      'Enrolled Students'
    ]);
    
    const summaryStatusIndices: number[] = [];
    gaItems.forEach((ga: GAReportItem) => {
      // Add GA Summary row
      summaryStatusIndices.push(summaryData.length);
      summaryData.push([
        'GA Summary',
        ga.ga_code,
        ga.ga_title,
        ga.direct_score ? ga.direct_score.toFixed(1) + '%' : '—',
        ga.indirect_score ? ga.indirect_score.toFixed(1) + '%' : '—',
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
          '', // Empty GA code for contributing course rows (so it doesn't repeat)
          '', // Empty GA title for contributing course rows
          '',
          '',
          '',
          '',
          '',
          course.course_code,
          course.course_name || '',
          course.semester || '',
          course.credits || '',
          course.course_ga_score ? course.course_ga_score.toFixed(1) + '%' : '0.0%',
          course.course_feedback_score ? course.course_feedback_score.toFixed(1) + '%' : '—',
          course.enrolled_students || ''
        ]);
      });
      
      // Add empty row between GAs
      summaryData.push([]);
    });
    
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Style Summary Sheet
    const summaryMerges = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 13 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 13 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 13 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 13 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 13 } }
    ];
    
    summaryWs['!merges'] = summaryMerges;
    
    const summaryRange = XLSX.utils.decode_range(summaryWs['!ref'] || 'A1');
    
    for (let R = 0; R <= summaryRange.e.r; ++R) {
      for (let C = 0; C <= 13; ++C) {
        const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
        if (!summaryWs[cell_address]) continue;
        
        if (R < 5) {
          // Header rows (blue)
          summaryWs[cell_address].s = {
            fill: { fgColor: { rgb: '4472C4' } },
            font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 14 },
            alignment: { horizontal: 'center', vertical: 'center' }
          };
        } else if (R === 6) { // Column headers
          summaryWs[cell_address].s = {
            fill: { fgColor: { rgb: 'D9E1F2' } },
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
      { wch: 15 }, // Direct Score
      { wch: 15 }, // Indirect Score
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 30 },
      { wch: 10 },
      { wch: 10 },
      { wch: 18 }, // Course Direct Score
      { wch: 18 }, // Course Indirect Score
      { wch: 18 }
    ];
    
    // --- GA Report Sheet ---
    // Prepare header data
    const headerRows: any[][] = [
      [selectedBatchObj?.program?.name || 'Program Name'],
      ['Department: ' + (selectedBatchObj?.program?.department || 'Computer Science')],
      ['Batch: ' + (selectedBatchObj?.name || 'Selected Batch')],
      ['GA Attainment Report'],
      ['Date: ' + new Date().toLocaleDateString()],
      [],
      []
    ];
    
    // Convert header to sheet with merged cells
    const wsData: any[] = [...headerRows];
    const gaSummaryRowIndices: number[] = [];
    const gaStatuses: string[] = [];
    
    // Add each GA
    gaItems.forEach((ga: GAReportItem) => {
      // Track GA summary row index
      gaSummaryRowIndices.push(wsData.length);
      gaStatuses.push(ga.status);
      
      // Add GA summary row
      const gaRow = [
        'GA Summary',
        ga.ga_code,
        ga.ga_title,
        ga.direct_score ? ga.direct_score.toFixed(1) + '%' : '—',
        ga.indirect_score ? ga.indirect_score.toFixed(1) + '%' : '—',
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
        '',
        '',
        ''
      ]);
      wsData.push([
        'Course Code',
        'Course Name',
        'Semester',
        'Credits',
        'Course GA Score',
        'Enrolled Students',
        '',
        ''
      ]);
      
      // Add contributing courses
      (ga.contributing_courses || []).forEach((course: GAReportContributingCourse) => {
        wsData.push([
          course.course_code,
          course.course_name || '',
          course.semester || '',
          course.credits || '',
          course.course_ga_score ? course.course_ga_score.toFixed(1) + '%' : '0.0%',
          course.enrolled_students || '',
          '',
          ''
        ]);
      });
      
      // Add empty row between GAs
      wsData.push([]);
    });
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Style header (blue, bold, merged)
    const merges = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 7 } }
    ];
    
    ws['!merges'] = merges;
    
    // Style cells
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    
    // Apply styles
    for (let R = 0; R <= range.e.r; ++R) {
      for (let C = 0; C <= 7; ++C) {
        const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
        if (!ws[cell_address]) continue;
        
        if (R < 5) {
          // Header rows (blue)
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
        } else if (R === gaSummaryRowIndices[0] + 2) { // Course headers
          ws[cell_address].s = {
            fill: { fgColor: { rgb: 'D9E1F2' } },
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
      { wch: 15 }, // Direct Score
      { wch: 15 }, // Indirect Score
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
      { wch: 20 }
    ];
    
    // Add sheets to workbook
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    XLSX.utils.book_append_sheet(wb, ws, 'GA Report');
    
    // Generate filename
    const filename = `GA_Report_${selectedBatchObj?.name?.replace(/\s+/g, '_') || 'Selected_Batch'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Download
    XLSX.writeFile(wb, filename);
    toast.success('Report exported successfully');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">GA Attainment Report</h1>
          <p className="text-slate-500 font-medium mt-1">
            {batches.find(b => b.id === selectedBatch)?.name || 'Select a batch'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExport}
            disabled={!report || !isReady}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2z" />
            </svg>
            Export Report
          </button>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Batch:</span>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
            >
              {batches.map(batch => (
                <option key={batch.id} value={batch.id}>{batch.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-8 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase">Mode:</span>
          <button
            onClick={() => setMode('semester')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'semester'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            Semester-wise
          </button>
          <button
            onClick={() => setMode('cumulative')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'cumulative'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            Cumulative
          </button>
        </div>

        {mode === 'semester' && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Semester:</span>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(Number(e.target.value))}
              className="bg-slate-100 px-4 py-2 rounded-lg text-sm font-bold text-slate-700 outline-none"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs font-bold text-slate-500 uppercase">Search:</span>
          <input
            type="text"
            placeholder="Search by course code or name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-100 px-4 py-2 rounded-lg text-sm font-bold text-slate-700 outline-none flex-1"
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      )}

      {!loading && !isReady && report && 'ready' in report && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-r-lg mb-8">
          <h3 className="text-yellow-900 font-bold text-lg">Report Not Ready</h3>
          <p className="text-yellow-800 mt-2">
            {report.message || `Finalized ${report.finalized_courses}/${report.total_courses} courses.`}
          </p>
          {report.missing_courses && (
            <div className="mt-4">
              <h4 className="text-sm font-bold text-yellow-700">Missing Courses:</h4>
              <ul className="list-disc list-inside text-sm text-yellow-800 mt-2">
                {report.missing_courses.map((course: string, idx: number) => (
                  <li key={idx}>{course}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!loading && isReady && report && !('ready' in report) && (
        <div className="space-y-8">
          {/* GA Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {gaItems.map((ga: GAReportItem) => {
              const isExpanded = expandedGA === ga.ga_id;

              return (
                <div
                  key={ga.ga_id}
                  className={`bg-white rounded-[24px] shadow-sm border transition-all duration-300 ${isExpanded ? 'ring-2 ring-indigo-500 border-transparent shadow-xl' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'}`}
                >
                  <div
                    className="p-6 cursor-pointer"
                    onClick={() => setExpandedGA(isExpanded ? null : ga.ga_id)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-800">
                        {ga.ga_code} — {ga.ga_title}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${ga.status === 'ACHIEVED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'}`}
                      >
                        {ga.status === 'ACHIEVED' ? 'Achieved ✅' : 'Below Target ❌'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
                      <div className="bg-slate-50 p-3 rounded-lg text-center">
                        <div className="text-xs font-bold text-slate-400 uppercase mb-1">Direct Score</div>
                        <div className="text-xl font-bold text-slate-700">
                          {ga.direct_score !== null ? `${ga.direct_score.toFixed(1)}%` : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg text-center">
                        <div className="text-xs font-bold text-slate-400 uppercase mb-1">Course Feedback</div>
                        <div className="text-xl font-bold text-fuchsia-600">
                          {ga.course_feedback_score !== null && ga.course_feedback_score !== undefined ? `${ga.course_feedback_score.toFixed(1)}%` : 'N/A'}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-400 mt-1">
                          Coverage: {ga.course_feedback_coverage !== null && ga.course_feedback_coverage !== undefined ? `${ga.course_feedback_coverage.toFixed(1)}%` : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg text-center">
                        <div className="text-xs font-bold text-slate-400 uppercase mb-1">Exit Survey</div>
                        <div className="text-xl font-bold text-rose-500">
                          {ga.exit_survey_score !== null && ga.exit_survey_score !== undefined ? `${ga.exit_survey_score.toFixed(1)}%` : 'N/A'}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-400 mt-1">
                          Coverage: {ga.exit_survey_coverage !== null && ga.exit_survey_coverage !== undefined ? `${ga.exit_survey_coverage.toFixed(1)}%` : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg text-center">
                        <div className="text-xs font-bold text-slate-400 uppercase mb-1">Indirect Score</div>
                        <div className="text-xl font-bold text-slate-700">
                          {ga.indirect_score !== null ? `${ga.indirect_score.toFixed(1)}%` : 'N/A'}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-400 mt-1">Combined CF + Exit</div>
                      </div>
                    </div>
                    <div className="relative pt-2 pb-1">
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-400">
                          Final Attainment: {ga.ga_attainment ? `${ga.ga_attainment.toFixed(1)}%` : 'N/A'}
                        </span>
                        <span className="text-indigo-600">KPI: {ga.ga_kpi_threshold}%</span>
                      </div>
                      <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden relative">
                        {ga.ga_attainment !== null && (
                          <div
                            className={`h-full transition-all duration-1000 ease-out rounded-full ${ga.status === 'ACHIEVED' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                            style={{ width: `${Math.min(ga.ga_attainment, 100)}%` }}
                          />
                        )}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-indigo-600 z-10"
                          style={{ left: `${ga.ga_kpi_threshold}%` }}
                          title={`KPI: ${ga.ga_kpi_threshold}%`}
                        />
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 p-6 bg-slate-50/50 rounded-b-[24px] animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest">
                          Contributing Courses
                        </h4>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-slate-500">Sort by:</label>
                          <select
                            className="bg-white border border-slate-200 rounded-lg px-3 py-1 text-sm font-bold text-slate-700"
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
                            className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-3 py-1 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-all"
                          >
                            {sortOrder === 'asc' ? 'Asc' : 'Desc'}
                          </button>
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">
                                Course Code
                              </th>
                              <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                                Semester
                              </th>
                              <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                                Credits
                              </th>
                              <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                                Direct Score
                              </th>
                              <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                                Indirect Score
                              </th>
                              <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                                Enrolled Students
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {getSortedFilteredCourses(ga.contributing_courses, ga.ga_kpi_threshold ?? 0).map((course: GAReportContributingCourse, idx: number) => {
                              const isBelowTarget = course.course_ga_score < (ga.ga_kpi_threshold ?? 0);
                              return (
                                <tr key={idx} className={`border-b border-slate-100 hover:bg-slate-50 ${isBelowTarget ? 'bg-red-50' : ''}`}>
                                  <td className="px-4 py-3 font-bold text-slate-700">
                                    {course.course_code}
                                    {course.course_name && (
                                      <div className="text-sm text-slate-600">
                                        {course.course_name}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center font-bold text-slate-700">
                                    {course.semester ?? 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 text-center font-bold text-slate-700">
                                    {course.credits ?? 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span
                                      className={`text-sm font-black ${isBelowTarget
                                        ? 'text-rose-600'
                                        : 'text-emerald-600'}`}
                                    >
                                      {course.course_ga_score.toFixed(1)}%
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center text-sm font-black text-indigo-600">
                                    {course.course_feedback_score?.toFixed(1) ?? '—'}%
                                  </td>
                                  <td className="px-4 py-3 text-center text-sm text-slate-600">
                                    {course.enrolled_students}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {isProgramEndReady && ga.ga_cqi_records.length > 0 && (
                        <div className="mt-6 space-y-4">
                          <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest">
                            CQI Records
                          </h4>
                          {ga.ga_cqi_records.map((cqi: GACQIRecord, idx: number) => (
                            <div
                              key={idx}
                              className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"
                            >
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <span
                                    className={`px-3 py-1 rounded-full text-xs font-black uppercase ${cqi.status === 'FULLY_APPROVED'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : cqi.status === 'SENT_BACK'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-blue-100 text-blue-700'}`}
                                  >
                                    {cqi.status}
                                  </span>
                                  <span className="text-sm font-bold text-slate-700">
                                    {cqi.cqi_level}
                                    {cqi.semester && ` — Semester ${cqi.semester}`}
                                  </span>
                                </div>
                                {cqi.attainment_value !== null && (
                                  <span className="text-sm text-slate-500">
                                    Attainment: {cqi.attainment_value.toFixed(1)}%
                                  </span>
                                )}
                              </div>

                              {/* Inline CQI Form for PENDING/SENT_BACK status */}
                              {(cqi.status === 'PENDING' || cqi.status === 'SENT_BACK') && (userRole === 'hod' || userRole === 'coordinator') && (
                                <div className="mt-4">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedCqiForm(prev => ({ ...prev, [cqi.id]: !prev[cqi.id] }));
                                    }}
                                    className="text-indigo-600 text-sm font-bold hover:underline mb-3 inline-block"
                                  >
                                    {expandedCqiForm[cqi.id] ? 'Hide Form' : 'Open CQI Form'}
                                  </button>

                                  {expandedCqiForm[cqi.id] && (
                                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 mt-2">
                                      {cqi.status === 'SENT_BACK' && cqi.hod_comment && (
                                        <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded-r-lg">
                                          <p className="text-sm font-bold text-yellow-900">HOD Comment:</p>
                                          <p className="text-sm text-yellow-800 mt-1">{cqi.hod_comment}</p>
                                        </div>
                                      )}

                                      {userRole === 'coordinator' && (
                                        <div className="space-y-4 mb-4">
                                          <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                              Root Cause
                                            </label>
                                            <textarea
                                              value={localCqiData[cqi.id]?.root_cause || ''}
                                              onChange={(e) => setLocalCqiData(prev => ({
                                                ...prev,
                                                [cqi.id]: { ...prev[cqi.id], root_cause: e.target.value }
                                              }))}
                                              className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                              rows={4}
                                              placeholder="Describe the root cause of the GA-level deficiency..."
                                              disabled={cqi.status === 'PENDING' && !cqi.is_locked}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                              Remedial Plan
                                            </label>
                                            <textarea
                                              value={localCqiData[cqi.id]?.remedial_plan || ''}
                                              onChange={(e) => setLocalCqiData(prev => ({
                                                ...prev,
                                                [cqi.id]: { ...prev[cqi.id], remedial_plan: e.target.value }
                                              }))}
                                              className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                              rows={4}
                                              placeholder="Describe the remedial action plan..."
                                              disabled={cqi.status === 'PENDING' && !cqi.is_locked}
                                            />
                                          </div>
                                          <div className="flex gap-3">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSaveDraft(cqi.id);
                                              }}
                                              disabled={submitting[cqi.id]}
                                              className="px-4 py-2 bg-slate-500 text-white rounded-lg text-sm font-bold hover:bg-slate-600 disabled:bg-slate-400"
                                            >
                                              {submitting[cqi.id] ? 'Saving...' : 'Save Draft'}
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSubmitToHod(cqi.id);
                                              }}
                                              disabled={submitting[cqi.id]}
                                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:bg-slate-400"
                                            >
                                              {submitting[cqi.id] ? 'Submitting...' : 'Submit to HOD'}
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {userRole === 'hod' && (
                                        <div className="space-y-4">
                                          <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                              Root Cause
                                            </label>
                                            <textarea
                                              value={cqi.root_cause || ''}
                                              disabled
                                              className="w-full p-3 border border-slate-300 rounded-lg bg-slate-100"
                                              rows={4}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                              Remedial Plan
                                            </label>
                                            <textarea
                                              value={cqi.remedial_plan || ''}
                                              disabled
                                              className="w-full p-3 border border-slate-300 rounded-lg bg-slate-100"
                                              rows={4}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                              HOD Comment (if sending back)
                                            </label>
                                            <textarea
                                              value={localCqiData[cqi.id]?.hod_comment || ''}
                                              onChange={(e) => setLocalCqiData(prev => ({
                                                ...prev,
                                                [cqi.id]: { ...prev[cqi.id], hod_comment: e.target.value }
                                              }))}
                                              className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                              rows={3}
                                              placeholder="Enter comment if sending back..."
                                            />
                                          </div>
                                          <div className="flex gap-3">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleApprove(cqi.id);
                                              }}
                                              disabled={submitting[cqi.id]}
                                              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:bg-slate-400"
                                            >
                                              {submitting[cqi.id] ? 'Approving...' : 'Approve'}
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleReject(cqi.id);
                                              }}
                                              disabled={submitting[cqi.id]}
                                              className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold hover:bg-rose-700 disabled:bg-slate-400"
                                            >
                                              {submitting[cqi.id] ? 'Sending Back...' : 'Send Back'}
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Display existing CQI data */}
                              {cqi.root_cause && (
                                <div className="mb-2">
                                  <span className="text-xs font-bold text-slate-500 uppercase">Root Cause:</span>
                                  <p className="text-sm text-slate-700 mt-1">{cqi.root_cause}</p>
                                </div>
                              )}
                              {cqi.remedial_plan && (
                                <div>
                                  <span className="text-xs font-bold text-slate-500 uppercase">Remedial Plan:</span>
                                  <p className="text-sm text-slate-700 mt-1">{cqi.remedial_plan}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* CQI Flags for Cohort (only when program end ready) */}
          {mode === 'cumulative' && isProgramEndReady && failedGAs.length > 0 && (
            <div className="mt-12 space-y-4">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Continuous Quality Improvement (CQI) Required
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {failedGAs.map((ga: GAReportItem) => (
                  <div
                    key={ga.ga_id}
                    className="bg-white border-2 border-rose-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-rose-50 rounded-2xl">
                        <span className="text-rose-600 font-black text-lg">⚠️</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-black text-rose-900">
                          {ga.ga_code} — {ga.ga_title}
                        </h4>
                        <p className="text-sm text-rose-700 mt-2">
                          Attainment: {ga.ga_attainment?.toFixed(1)}% (Target: {ga.kpi_threshold}%)
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GAReport;
