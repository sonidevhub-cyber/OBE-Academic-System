import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  ChevronRight,
  GraduationCap
} from 'lucide-react';

// --- Interfaces ---
interface Batch {
  id: string;
  label: string;
}

interface Student {
  id: string;
  name: string;
  rollNo: string;
  batch: string;
  cgpa: number;
  gasMet: number;
  gasTotal: number;
  closMet: number;
  closTotal: number;
  status: "strong" | "average" | "weak";
}

// --- Dummy Data ---
const dummyBatches: Batch[] = [ 
  { id: "b1", label: "Batch 2021-2025" }, 
  { id: "b2", label: "Batch 2020-2024" }, 
  { id: "b3", label: "Batch 2019-2023" }, 
];

const dummyStudents: Student[] = [ 
  { 
    id: "s1", 
    name: "Sara Ahmed", 
    rollNo: "2021-CS-45", 
    batch: "b1", 
    cgpa: 3.67, 
    gasMet: 10, 
    gasTotal: 12, 
    closMet: 28, 
    closTotal: 34, 
    status: "strong", 
  }, 
  { 
    id: "s2", 
    name: "Ali Hassan", 
    rollNo: "2021-CS-23", 
    batch: "b1", 
    cgpa: 3.12, 
    gasMet: 8, 
    gasTotal: 12, 
    closMet: 22, 
    closTotal: 34, 
    status: "average", 
  }, 
  { 
    id: "s3", 
    name: "Zara Khan", 
    rollNo: "2021-CS-67", 
    batch: "b1", 
    cgpa: 3.89, 
    gasMet: 12, 
    gasTotal: 12, 
    closMet: 34, 
    closTotal: 34, 
    status: "strong", 
  }, 
  { 
    id: "s4", 
    name: "Usman Malik", 
    rollNo: "2021-CS-12", 
    batch: "b1", 
    cgpa: 2.45, 
    gasMet: 5, 
    gasTotal: 12, 
    closMet: 14, 
    closTotal: 34, 
    status: "weak", 
  },
  // Batch b2 students
  { 
    id: "s5", 
    name: "Ahmed Raza", 
    rollNo: "2020-CS-01", 
    batch: "b2", 
    cgpa: 3.45, 
    gasMet: 9, 
    gasTotal: 12, 
    closMet: 25, 
    closTotal: 34, 
    status: "strong", 
  },
  { 
    id: "s6", 
    name: "Fatima Noor", 
    rollNo: "2020-CS-15", 
    batch: "b2", 
    cgpa: 2.95, 
    gasMet: 7, 
    gasTotal: 12, 
    closMet: 19, 
    closTotal: 34, 
    status: "average", 
  },
  { 
    id: "s7", 
    name: "Bilal Sheikh", 
    rollNo: "2020-CS-33", 
    batch: "b2", 
    cgpa: 2.15, 
    gasMet: 4, 
    gasTotal: 12, 
    closMet: 10, 
    closTotal: 34, 
    status: "weak", 
  },
  { 
    id: "s8", 
    name: "Hina Javeed", 
    rollNo: "2020-CS-55", 
    batch: "b2", 
    cgpa: 3.72, 
    gasMet: 11, 
    gasTotal: 12, 
    closMet: 30, 
    closTotal: 34, 
    status: "strong", 
  },
];

const StudentOBEList: React.FC = () => {
  const navigate = useNavigate();
  const [selectedBatch, setSelectedBatch] = useState<string>(dummyBatches[0].id);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // --- Derived Data ---
  const filteredStudents = useMemo(() => {
    return dummyStudents.filter(student => 
      student.batch === selectedBatch &&
      (student.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
       student.rollNo.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [selectedBatch, searchQuery]);

  const stats = useMemo(() => {
    const batchStudents = dummyStudents.filter(s => s.batch === selectedBatch);
    return {
      total: batchStudents.length,
      strong: batchStudents.filter(s => s.status === 'strong').length,
      average: batchStudents.filter(s => s.status === 'average').length,
      weak: batchStudents.filter(s => s.status === 'weak').length,
    };
  }, [selectedBatch]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'strong':
        return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-200 flex items-center gap-1 w-fit"><TrendingUp className="w-3 h-3" /> Strong</span>;
      case 'average':
        return <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-200 flex items-center gap-1 w-fit"><Minus className="w-3 h-3" /> Average</span>;
      case 'weak':
        return <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-rose-200 flex items-center gap-1 w-fit"><TrendingDown className="w-3 h-3" /> Weak</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
      {/* --- Header --- */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
          <Users className="w-8 h-8 text-indigo-600" />
          Student OBE Reports
        </h1>
        <p className="text-slate-500 font-bold mt-1">
          View individual student CLO & GA attainment across batches
        </p>
      </div>

      {/* --- Filters & Stats Row --- */}
      <div className="space-y-6 mb-8">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
          {/* Batch Selector */}
          <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-sm flex-1 md:flex-none">
            <Filter className="w-5 h-5 text-slate-400" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Batch</span>
              <select 
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
              >
                {dummyBatches.map(batch => (
                  <option key={batch.id} value={batch.id}>{batch.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Input */}
          <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-sm flex-1">
            <Search className="w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by student name or roll number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none w-full placeholder:text-slate-300"
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Students", value: stats.total, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Strong Performers", value: stats.strong, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Average Performers", value: stats.average, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Weak Performers", value: stats.weak, color: "text-rose-600", bg: "bg-rose-50" },
          ].map((stat, idx) => (
            <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
              </div>
              <div className={`p-2 rounded-xl ${stat.bg} ${stat.color}`}>
                <GraduationCap className="w-5 h-5" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- Student Table --- */}
      <div className="bg-white rounded-[32px] overflow-hidden border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">
                <th className="px-6 py-5">#</th>
                <th className="px-6 py-5">Student Name</th>
                <th className="px-6 py-5">Roll No</th>
                <th className="px-6 py-5 text-center">CGPA</th>
                <th className="px-6 py-5 text-center">GAs Met</th>
                <th className="px-6 py-5 text-center">CLOs Met</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student, idx) => (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-5 text-slate-400 font-bold">{idx + 1}</td>
                    <td className="px-6 py-5">
                      <div className="font-black text-slate-800">{student.name}</div>
                    </td>
                    <td className="px-6 py-5 font-bold text-slate-500">{student.rollNo}</td>
                    <td className="px-6 py-5 text-center font-black text-slate-700">{student.cgpa.toFixed(2)}</td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-black text-indigo-600">{student.gasMet}/{student.gasTotal}</span>
                        <div className="w-12 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${(student.gasMet / student.gasTotal) * 100}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-black text-blue-600">{student.closMet}/{student.closTotal}</span>
                        <div className="w-12 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${(student.closMet / student.closTotal) * 100}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {getStatusBadge(student.status)}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button 
                        onClick={() => navigate(`/coordinator/students/${student.id}/obe-report`)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 font-black text-[10px] uppercase rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                      >
                        View Report <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-slate-100 rounded-full">
                        <Users className="w-10 h-10 text-slate-300" />
                      </div>
                      <p className="text-slate-400 font-bold">No students found for this batch.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <footer className="mt-12 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">
        EduOBE Student Analytics • Engineering Excellence
      </footer>
    </div>
  );
};

export default StudentOBEList;
