import React, { useState, useMemo, useRef } from 'react';

// --- Interfaces ---
interface CLO {
  code: string;
  course: string;
  attainment: number;
}

interface PI {
  id: string;
  label: string;
  attainment: number;
  clos: CLO[];
}

interface GA {
  id: string;
  name: string;
  kpi: number;
  attainment: number;
  pis: PI[];
}

interface Semester {
  id: number;
  label: string;
  gas: GA[];
}

// --- Dummy Data ---
const availableBatches = [
  "Batch 2021-2025",
  "Batch 2020-2024",
  "Batch 2019-2023",
];

const dummyData = {
  batch: "Batch 2021-2025",
  program: "BS Computer Science",
  semesters: [
    {
      id: 1,
      label: "Semester 1",
      gas: [
        {
          id: "GA1",
          name: "Engineering Knowledge",
          kpi: 60,
          attainment: 72,
          pis: [
            {
              id: "PI1.1",
              label: "PI 1.1",
              attainment: 75,
              clos: [
                { code: "CLO1", course: "DS", attainment: 78 },
                { code: "CLO2", course: "OOP", attainment: 69 },
              ],
            },
            {
              id: "PI1.2",
              label: "PI 1.2",
              attainment: 68,
              clos: [
                { code: "CLO3", course: "Algo", attainment: 74 },
              ],
            },
          ],
        },
        {
          id: "GA2",
          name: "Problem Analysis",
          kpi: 60,
          attainment: 54,
          pis: [
            {
              id: "PI2.1",
              label: "PI 2.1",
              attainment: 48,
              clos: [
                { code: "CLO4", course: "DS", attainment: 45 },
                { code: "CLO5", course: "OOP", attainment: 52 },
              ],
            },
            {
              id: "PI2.2",
              label: "PI 2.2",
              attainment: 61,
              clos: [
                { code: "CLO6", course: "Algo", attainment: 63 },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 2,
      label: "Semester 2",
      gas: [
        {
          id: "GA1",
          name: "Engineering Knowledge",
          kpi: 60,
          attainment: 68,
          pis: [
            {
              id: "PI1.1",
              label: "PI 1.1",
              attainment: 70,
              clos: [
                { code: "CLO1", course: "DB", attainment: 72 },
              ],
            },
            {
              id: "PI1.2",
              label: "PI 1.2",
              attainment: 66,
              clos: [
                { code: "CLO2", course: "OS", attainment: 66 },
              ],
            },
          ],
        },
        {
          id: "GA2",
          name: "Problem Analysis",
          kpi: 60,
          attainment: 62,
          pis: [
            {
              id: "PI2.1",
              label: "PI 2.1",
              attainment: 58,
              clos: [
                { code: "CLO3", course: "DB", attainment: 55 },
              ],
            },
            {
              id: "PI2.2",
              label: "PI 2.2",
              attainment: 66,
              clos: [
                { code: "CLO4", course: "OS", attainment: 66 },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 3,
      label: "Semester 3",
      gas: [
        {
          id: "GA1",
          name: "Engineering Knowledge",
          kpi: 60,
          attainment: 75,
          pis: [
            {
              id: "PI1.1",
              label: "PI 1.1",
              attainment: 80,
              clos: [
                { code: "CLO1", course: "CN", attainment: 82 },
              ],
            },
          ],
        },
        {
          id: "GA2",
          name: "Problem Analysis",
          kpi: 60,
          attainment: 58,
          pis: [
            {
              id: "PI2.1",
              label: "PI 2.1",
              attainment: 55,
              clos: [
                { code: "CLO2", course: "CN", attainment: 55 },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const GAReport: React.FC = () => {
  const [selectedBatch, setSelectedBatch] = useState<string>(availableBatches[0]);
  const [activeTab, setActiveTab] = useState<string>("Semester 1");
  const [expandedGA, setExpandedGA] = useState<string | null>(null);
  const [expandedPI, setExpandedPI] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // --- Cumulative Data Calculation ---
  const cumulativeData = useMemo(() => {
    const gaMap: Record<string, { totalAttainment: number; count: number; name: string; kpi: number; pis: Record<string, { totalAttainment: number; count: number; label: string; clos: Record<string, { code: string; course: string; attainment: number }> }> }> = {};

    dummyData.semesters.forEach(sem => {
      sem.gas.forEach(ga => {
        if (!gaMap[ga.id]) {
          gaMap[ga.id] = { totalAttainment: 0, count: 0, name: ga.name, kpi: ga.kpi, pis: {} };
        }
        gaMap[ga.id].totalAttainment += ga.attainment;
        gaMap[ga.id].count += 1;

        ga.pis.forEach(pi => {
          if (!gaMap[ga.id].pis[pi.id]) {
            gaMap[ga.id].pis[pi.id] = { totalAttainment: 0, count: 0, label: pi.label, clos: {} };
          }
          gaMap[ga.id].pis[pi.id].totalAttainment += pi.attainment;
          gaMap[ga.id].pis[pi.id].count += 1;

          pi.clos.forEach(clo => {
            const cloKey = `${clo.code}-${clo.course}`;
            if (!gaMap[ga.id].pis[pi.id].clos[cloKey]) {
              gaMap[ga.id].pis[pi.id].clos[cloKey] = { ...clo };
            }
          });
        });
      });
    });

    const gas: GA[] = Object.keys(gaMap).map(gaId => {
      const gaData = gaMap[gaId];
      return {
        id: gaId,
        name: gaData.name,
        kpi: gaData.kpi,
        attainment: Math.round(gaData.totalAttainment / gaData.count),
        pis: Object.keys(gaData.pis).map(piId => {
          const piData = gaData.pis[piId];
          return {
            id: piId,
            label: piData.label,
            attainment: Math.round(piData.totalAttainment / piData.count),
            clos: Object.values(piData.clos),
          };
        }),
      };
    });

    return { id: 0, label: "Cumulative", gas };
  }, []);

  const currentData = activeTab === "Cumulative" 
    ? cumulativeData 
    : dummyData.semesters.find(s => s.label === activeTab) || dummyData.semesters[0];

  const failedGAs = currentData.gas.filter(ga => ga.attainment < ga.kpi);

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900 print:bg-white print:p-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .report-container { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
          body { background: white !important; }
        }
      `}</style>

      {/* --- Header --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 no-print">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">GA Attainment Report</h1>
            <p className="text-slate-500 font-medium mt-1">
              {selectedBatch} • {dummyData.program}
            </p>
          </div>
          
          {/* Batch Selector */}
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
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
        <button 
          disabled
          className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-md shadow-indigo-200 opacity-50 cursor-not-allowed transition-all flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export PDF
        </button>
      </div>

      {/* --- Tabs --- */}
      <div className="flex border-b border-slate-200 mb-8 overflow-x-auto no-scrollbar no-print">
        {[...dummyData.semesters.map(s => s.label), "Cumulative"].map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setExpandedGA(null);
              setExpandedPI(null);
            }}
            className={`px-8 py-4 text-sm font-bold transition-all whitespace-nowrap border-b-2 ${
              activeTab === tab 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div ref={reportRef} className="space-y-8 p-1 report-container rounded-3xl">
        {/* --- Print Header (Only visible in PDF/Print) --- */}
        <div className="hidden print-only mb-8 border-b-2 border-slate-900 pb-4">
          <h1 className="text-4xl font-black text-slate-900">EduOBE - Graduate Attribute Report</h1>
          <div className="flex justify-between mt-4 text-sm font-bold text-slate-600">
            <span>Program: {dummyData.program}</span>
            <span>Batch: {selectedBatch}</span>
            <span>Report Type: {activeTab}</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400">Generated on: {new Date().toLocaleDateString()}</div>
        </div>

        {activeTab === "Cumulative" && (
          <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-r-lg mb-6">
            <p className="text-indigo-800 font-bold">Cumulative — All Semesters Average</p>
          </div>
        )}

        {/* --- Section 1: GA Cards Grid --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {currentData.gas.map(ga => {
            const isMet = ga.attainment >= ga.kpi;
            const isExpanded = expandedGA === ga.id;

            return (
              <div 
                key={ga.id} 
                className={`bg-white rounded-[24px] shadow-sm border transition-all duration-300 ${
                  isExpanded ? 'ring-2 ring-indigo-500 border-transparent shadow-xl' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                }`}
              >
                <div 
                  className="p-6 cursor-pointer"
                  onClick={() => setExpandedGA(isExpanded ? null : ga.id)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-800">
                      {ga.id} — {ga.name}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      isMet ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {isMet ? 'Met ✅' : 'Not Met ❌'}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative pt-2 pb-1">
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-slate-400">Attainment: {ga.attainment}%</span>
                      <span className="text-indigo-600">KPI: {ga.kpi}%</span>
                    </div>
                    <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden relative">
                      <div 
                        className={`h-full transition-all duration-1000 ease-out rounded-full ${isMet ? 'bg-emerald-500' : 'bg-rose-500'}`}
                        style={{ width: `${ga.attainment}%` }}
                      />
                      {/* KPI Marker */}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-indigo-600 z-10"
                        style={{ left: `${ga.kpi}%` }}
                        title={`KPI: ${ga.kpi}%`}
                      />
                    </div>
                  </div>
                </div>

                {/* --- Section 2: PI Breakdown (Expandable) --- */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-6 bg-slate-50/50 rounded-b-[24px] animate-in fade-in slide-in-from-top-2 duration-300">
                    <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">PI Performance Breakdown</h4>
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">PI Identifier</th>
                            <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-center">Attainment</th>
                            <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ga.pis.map(pi => {
                            const piMet = pi.attainment >= ga.kpi;
                            const piExpanded = expandedPI === pi.id;

                            return (
                              <React.Fragment key={pi.id}>
                                <tr 
                                  className={`border-b border-slate-100 cursor-pointer transition-colors ${piExpanded ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}
                                  onClick={() => setExpandedPI(piExpanded ? null : pi.id)}
                                >
                                  <td className="px-4 py-3 font-bold text-slate-700 flex items-center gap-2">
                                    <svg 
                                      className={`w-4 h-4 text-slate-400 transition-transform ${piExpanded ? 'rotate-90' : ''}`} 
                                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    {pi.label}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div 
                                          className={`h-full ${piMet ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                          style={{ width: `${pi.attainment}%` }}
                                        />
                                      </div>
                                      <span className="text-xs font-black text-slate-600">{pi.attainment}%</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                      piMet ? 'text-emerald-600' : 'text-rose-600'
                                    }`}>
                                      {piMet ? 'PASSED' : 'BELOW KPI'}
                                    </span>
                                  </td>
                                </tr>

                                {/* --- Section 3: CLO Contribution (Expandable PI row) --- */}
                                {piExpanded && (
                                  <tr>
                                    <td colSpan={3} className="px-6 py-4 bg-indigo-50/20">
                                      <div className="p-4 bg-white rounded-xl border border-indigo-100 shadow-sm">
                                        <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3">CLO Contribution</h5>
                                        <div className="grid grid-cols-3 gap-4 text-xs">
                                          <div className="font-black text-slate-400 uppercase">CLO Code</div>
                                          <div className="font-black text-slate-400 uppercase text-center">Course</div>
                                          <div className="font-black text-slate-400 uppercase text-right">Attainment</div>
                                          {pi.clos.map(clo => (
                                            <React.Fragment key={`${clo.code}-${clo.course}`}>
                                              <div className="font-bold text-slate-700">{clo.code}</div>
                                              <div className="text-slate-600 text-center font-medium bg-slate-100 rounded py-0.5">{clo.course}</div>
                                              <div className="font-black text-indigo-600 text-right">{clo.attainment}%</div>
                                            </React.Fragment>
                                          ))}
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
            );
          })}
        </div>

        {/* --- Info Note (Only in Semester tabs) --- */}
        {activeTab !== "Cumulative" && failedGAs.length > 0 && (
          <div className="mt-4 text-sm text-slate-500 italic font-medium"> 
            * GA attainment below KPI will be reviewed 
              at batch end in Cumulative report. 
          </div> 
        )}

        {/* --- Section 4: CQI Flags (Only in Cumulative) --- */}
        {activeTab === "Cumulative" && failedGAs.length > 0 && (
          <div className="mt-12 space-y-4">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Continuous Quality Improvement (CQI) Flags
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {failedGAs.map(ga => (
                <div key={`cqi-${ga.id}`} className="bg-white border-2 border-rose-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-rose-50 rounded-2xl">
                      <span className="text-rose-600 font-black text-lg">⚠️</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-black text-rose-900">{ga.id} — {ga.name} — Not Met</h4>
                      <div className="mt-3 space-y-2">
                        <div className="flex gap-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Affected PIs:</span>
                          <div className="flex flex-wrap gap-1">
                            {ga.pis.filter(pi => pi.attainment < ga.kpi).map(pi => (
                              <span key={pi.id} className="text-xs font-bold text-rose-600">{pi.label}</span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Affected CLOs:</span>
                          <div className="flex flex-wrap gap-1">
                            {ga.pis.flatMap(pi => pi.clos.filter(clo => pi.attainment < ga.kpi)).map((clo, idx) => (
                              <span key={idx} className="text-xs font-bold text-slate-600">
                                {clo.code} ({clo.course}){idx < ga.pis.length - 1 ? ',' : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-rose-50 flex items-center justify-between">
                        <span className="text-xs font-black text-rose-500 uppercase animate-pulse">→ CQI Action Required</span>
                        <button className="text-[10px] font-black bg-rose-600 text-white px-3 py-1 rounded-full uppercase tracking-tighter">Initiate CQI</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- Footer Note for Cumulative --- */}
        {activeTab === "Cumulative" && (
          <div className="mt-12 text-center p-8 bg-slate-100 rounded-[32px] border-2 border-dashed border-slate-300">
            <p className="text-slate-500 font-bold italic">
              "PEO Attainment will be calculated after Alumni Survey completion."
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GAReport;
