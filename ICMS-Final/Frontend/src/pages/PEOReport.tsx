import React, { useState } from 'react';
import { 
  Award, 
  Users, 
  Info, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Download,
  FileText
} from 'lucide-react';

// --- Interfaces ---
interface PEO {
  id: string;
  title: string;
  statement: string;
  mappedGAs: string[];
  directAttainment: number;
  indirectAttainment: number;
  finalAttainment: number;
  kpi: number;
}

interface PEOReportData {
  batch: string;
  program: string;
  alumniSurveyStatus: "pending" | "partial" | "complete";
  alumniResponded: number;
  alumniTotal: number;
  peos: PEO[];
}

// --- Dummy Data ---
const availableBatches = [
  "Batch 2021-2025",
  "Batch 2020-2024",
  "Batch 2019-2023",
];

const dummyPEOReport: PEOReportData = { 
  batch: "Batch 2021-2025", 
  program: "BS Computer Science", 
  alumniSurveyStatus: "partial", 
  alumniResponded: 67, 
  alumniTotal: 120, 
  peos: [ 
    { 
      id: "PEO1", 
      title: "Industry Practice", 
      statement: "Graduates will apply CS fundamentals in professional environments", 
      mappedGAs: ["GA1", "GA2"], 
      directAttainment: 68,
      indirectAttainment: 74,
      finalAttainment: 69.2,
      kpi: 60, 
    }, 
    { 
      id: "PEO2", 
      title: "Higher Education", 
      statement: "Graduates will pursue advanced studies or research", 
      mappedGAs: ["GA3", "GA4"], 
      directAttainment: 72, 
      indirectAttainment: 68, 
      finalAttainment: 71.2, 
      kpi: 60, 
    }, 
    { 
      id: "PEO3", 
      title: "Leadership & Ethics", 
      statement: "Graduates will demonstrate ethical and professional conduct", 
      mappedGAs: ["GA8", "GA9"], 
      directAttainment: 55, 
      indirectAttainment: 61, 
      finalAttainment: 56.2, 
      kpi: 60, 
    }, 
    { 
      id: "PEO4", 
      title: "Lifelong Learning", 
      statement: "Graduates will engage in continuous professional development", 
      mappedGAs: ["GA11", "GA12"], 
      directAttainment: 78, 
      indirectAttainment: 82, 
      finalAttainment: 78.8, 
      kpi: 60, 
    }, 
  ], 
};

const PEOReport: React.FC = () => {
  const [selectedBatch, setSelectedBatch] = useState<string>(availableBatches[0]);
  const failedPEOs = dummyPEOReport.peos.filter(p => p.finalAttainment < p.kpi);
  const responseRate = Math.round((dummyPEOReport.alumniResponded / dummyPEOReport.alumniTotal) * 100);

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
      {/* --- Header --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
              <Award className="w-8 h-8 text-indigo-600" />
              PEO Attainment Report
            </h1>
            <p className="text-slate-500 font-bold mt-1">
              {selectedBatch} • {dummyPEOReport.program}
            </p>
          </div>

          {/* Batch Selector */}
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Select Batch:</span>
            <select 
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
            >
              {availableBatches.map(batch => (
                <option key={batch} value={batch}>{batch}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-white border border-slate-200 px-4 py-2 rounded-2xl shadow-sm flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Alumni Responses</p>
              <p className="text-sm font-black text-slate-700">{dummyPEOReport.alumniResponded}/{dummyPEOReport.alumniTotal} ({responseRate}%)</p>
            </div>
          </div>
          <button 
            disabled 
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold opacity-50 cursor-not-allowed shadow-lg shadow-indigo-200 flex items-center gap-2"
          >
            <Download className="w-5 h-5" /> Export PDF
          </button>
        </div>
      </div>

      {/* --- Status Banners --- */}
      <div className="mb-8">
        {dummyPEOReport.alumniSurveyStatus === "partial" && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-2xl flex gap-3 items-center shadow-sm">
            <Info className="w-5 h-5 text-blue-500 shrink-0" />
            <p className="text-sm text-blue-700 font-bold">
              Alumni survey is still open. Final PEO attainment will update as more responses come in.
            </p>
          </div>
        )}
        {dummyPEOReport.alumniSurveyStatus === "pending" && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-2xl flex gap-3 items-center shadow-sm">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-700 font-bold">
              Alumni survey not yet conducted. Showing direct attainment only.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* --- PEO Cards --- */}
        {dummyPEOReport.peos.map((peo) => {
          const isMet = peo.finalAttainment >= peo.kpi;
          return (
            <div key={peo.id} className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col lg:flex-row justify-between gap-8">
                <div className="flex-1 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-black text-slate-800">{peo.id} — {peo.title}</h3>
                      <p className="text-slate-500 font-medium mt-1 leading-relaxed">{peo.statement}</p>
                    </div>
                    <div className={`px-4 py-1.5 rounded-full flex items-center gap-2 text-xs font-black uppercase tracking-widest ${
                      isMet ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {isMet ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {isMet ? 'Met' : 'Not Met'}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest self-center mr-2">Mapped GAs:</span>
                    {peo.mappedGAs.map(ga => (
                      <span key={ga} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black border border-slate-200">
                        {ga}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="lg:w-96 space-y-6">
                  {/* Progress Bars */}
                  <div className="space-y-4">
                    {/* Direct */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter text-slate-400">
                        <span>Direct Attainment (80% Weight)</span>
                        <span className="text-blue-600">{peo.directAttainment}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${peo.directAttainment}%` }} />
                      </div>
                    </div>

                    {/* Indirect */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter text-slate-400">
                        <span>Indirect Attainment (20% Weight)</span>
                        <span className="text-amber-600">{peo.indirectAttainment}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${peo.indirectAttainment}%` }} />
                      </div>
                    </div>

                    {/* Final */}
                    <div className="space-y-1 pt-2">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-700">
                        <span>Final PEO Attainment</span>
                        <span className="font-black text-indigo-900">{peo.finalAttainment}%</span>
                      </div>
                      <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden relative border border-slate-200">
                        <div className="h-full bg-indigo-900 rounded-full" style={{ width: `${peo.finalAttainment}%` }} />
                        {/* KPI Marker */}
                        <div 
                          className="absolute top-0 bottom-0 w-0.5 border-r-2 border-dashed border-indigo-400 z-10"
                          style={{ left: `${peo.kpi}%` }}
                          title={`KPI: ${peo.kpi}%`}
                        />
                      </div>
                      <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase mt-1">
                        <span>0%</span>
                        <span style={{ marginLeft: `${peo.kpi}%`, transform: 'translateX(-50%)' }} className="text-indigo-600">KPI: {peo.kpi}%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* --- Summary Table --- */}
        <div className="bg-white rounded-[32px] overflow-hidden border border-slate-200 shadow-sm mt-12">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              PEO Attainment Summary
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">
                  <th className="px-8 py-4">PEO Identifier</th>
                  <th className="px-8 py-4 text-center">Direct (80%)</th>
                  <th className="px-8 py-4 text-center">Indirect (20%)</th>
                  <th className="px-8 py-4 text-center">Final Attainment</th>
                  <th className="px-8 py-4 text-center">KPI</th>
                  <th className="px-8 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dummyPEOReport.peos.map((peo) => {
                  const isMet = peo.finalAttainment >= peo.kpi;
                  return (
                    <tr key={peo.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-4">
                        <div className="font-black text-slate-800">{peo.id}</div>
                        <div className="text-xs text-slate-500 font-medium">{peo.title}</div>
                      </td>
                      <td className="px-8 py-4 text-center font-bold text-blue-600">{peo.directAttainment}%</td>
                      <td className="px-8 py-4 text-center font-bold text-amber-600">{peo.indirectAttainment}%</td>
                      <td className="px-8 py-4 text-center">
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-900 rounded-lg font-black">{peo.finalAttainment}%</span>
                      </td>
                      <td className="px-8 py-4 text-center font-bold text-slate-400">{peo.kpi}%</td>
                      <td className="px-8 py-4 text-right">
                        <span className={`px-3 py-1 rounded-md text-[10px] font-black uppercase ${
                          isMet ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {isMet ? 'PASSED' : 'NOT MET'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- CQI Note --- */}
        {failedPEOs.length > 0 && (
          <div className="mt-8 bg-amber-50 border border-amber-200 rounded-3xl p-6 flex gap-4 items-start shadow-sm">
            <div className="p-3 bg-amber-100 rounded-2xl">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h4 className="font-black text-amber-900 uppercase tracking-tight">CQI Action Recommendation</h4>
              <p className="text-sm text-amber-800 font-medium mt-1 leading-relaxed">
                {failedPEOs.map(p => p.id).join(', ')} not met. Consider curriculum review and pedagogical adjustments in the next accreditation cycle. PEO-level CQI requires manual coordinator evaluation and institutional decision-making.
              </p>
            </div>
          </div>
        )}
      </div>

      <footer className="mt-16 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] pb-8">
        EduOBE Academic Analytics • Engineering Excellence
      </footer>
    </div>
  );
};

export default PEOReport;
