import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import obeService from '../../api/obeService';
import { toast } from 'react-hot-toast';

interface GACQIAdvisoryRecord {
  id: string;
  ga_title: string;
  ga_code: string;
  issue_statement: string | null;
  hod_action_plan: string | null;
  attainment_value: number | string | null;
  saved_at: string | null;
}

const HODGACQIAdvisory: React.FC = () => {
  const [programs, setPrograms] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [records, setRecords] = useState<GACQIAdvisoryRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedProgram = programs.find((program) => program.id === selectedProgramId);
  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const allBatches = await obeService.getAllBatches({ alumni_feedback: 'all' });
        setBatches(allBatches);
        const uniquePrograms = Array.from(
          new Map(allBatches.map((batch: any) => [batch.program?.id, batch.program])).values()
        ).filter(Boolean);
        setPrograms(uniquePrograms as any[]);

        if (allBatches.length > 0) {
          setSelectedProgramId(allBatches[0].program?.id || '');
          setSelectedBatchId(allBatches[0].id || '');
        }
      } catch (error) {
        console.error('Failed to load initial data', error);
      }
    };
    loadInitialData();
  }, []);

  // Load records when program and batch are selected
  useEffect(() => {
    if (!selectedProgramId || !selectedBatchId) {
      setRecords([]);
      return;
    }
    const loadRecords = async () => {
      setLoading(true);
      try {
        const data = await obeService.getGACQIAdvisoryExport(selectedProgramId, selectedBatchId);
        setRecords(data);
      } catch (error) {
        console.error('Failed to load records', error);
        toast.error('Failed to load GA CQI records');
      } finally {
        setLoading(false);
      }
    };
    loadRecords();
  }, [selectedProgramId, selectedBatchId]);

  // Handle download PDF
  const handleDownloadPDF = async () => {
    try {
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const generatedAt = new Date().toLocaleString();

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.text('GA-CQI Advisory Report', pageWidth / 2, 14, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(
        `Program: ${selectedProgram?.name || 'N/A'} | Batch: ${selectedBatch?.name || 'N/A'}`,
        14,
        22
      );
      pdf.text(`Generated on: ${generatedAt}`, 14, 28);

      autoTable(pdf, {
        startY: 34,
        head: [[
          'GA Code',
          'GA Title',
          'Issue Statement',
          'Attainment',
          'HOD Action Plan',
          'Approved On',
        ]],
        body: records.map((record) => [
          record.ga_code,
          record.ga_title,
          record.issue_statement || '-',
          formatAttainment(record.attainment_value),
          record.hod_action_plan || '-',
          record.saved_at ? new Date(record.saved_at).toLocaleDateString() : '-',
        ]),
        theme: 'grid',
        styles: {
          fontSize: 7,
          cellPadding: 2,
          overflow: 'linebreak',
          valign: 'middle',
        },
        headStyles: {
          fillColor: [31, 41, 55],
          textColor: 255,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 42 },
          2: { cellWidth: 72 },
          3: { cellWidth: 24, halign: 'center' },
          4: { cellWidth: 72 },
          5: { cellWidth: 28, halign: 'center' },
        },
        margin: { top: 34, left: 10, right: 10, bottom: 12 },
      });

      pdf.save(`ga-cqi-advisory-${selectedBatch?.name || 'batch'}.pdf`);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Failed to generate GA-CQI advisory PDF:', error);
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }
      toast.error('Failed to download PDF');
    }
  };

  const formatAttainment = (value: number | string | null) => {
    if (value === null || value === undefined || value === '') return '-';
    const numericValue = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(numericValue)) return '-';
    return `${numericValue.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-black text-gray-900 mb-6">CQI Advisory Export</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Program Select */}
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Select Program
            </label>
            <select
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
              value={selectedProgramId}
              onChange={(e) => {
                setSelectedProgramId(e.target.value);
                setSelectedBatchId('');
              }}
            >
              <option value="">Select a program</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>

          {/* Batch Select */}
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Select Batch
            </label>
            <select
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              disabled={!selectedProgramId}
            >
              <option value="">Select a batch</option>
              {batches
                .filter((batch: any) => batch.program?.id === selectedProgramId)
                .map((batch: any) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Download Button */}
          <div className="flex items-end">
              <button
                onClick={handleDownloadPDF}
                disabled={!selectedProgramId || !selectedBatchId || loading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg"
              >
               ⬇ Download 1-Page PDF
              </button>
            </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl font-bold text-gray-600">Loading records...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && selectedProgramId && selectedBatchId && records.length === 0 && (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
          <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No GA-CQI records for this batch</h3>
            <p className="text-gray-600">All GAs met their targets. 🎉</p>
          </div>
        )}

      {/* Records Table */}
      {!loading && records.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                    GA Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                    GA Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                    Issue Statement
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                    Attainment
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                    HOD Action Plan
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                    Approved On
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {records.map((record) => (
                  <tr key={record.id}>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{record.ga_code}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{record.ga_title}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{record.issue_statement || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatAttainment(record.attainment_value)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{record.hod_action_plan || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {record.saved_at ? new Date(record.saved_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODGACQIAdvisory;
