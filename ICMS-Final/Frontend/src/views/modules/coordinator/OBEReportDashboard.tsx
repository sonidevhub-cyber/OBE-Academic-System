import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Target, 
  Award, 
  Download, 
  Search, 
  BookOpen, 
  FileText, 
  FileSpreadsheet, 
  TrendingUp 
} from 'lucide-react';

const OBEReportDashboard: React.FC = () => {
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data for UI demonstration
  const mockBatches = [
    { id: '1', name: '2022-2026' },
    { id: '2', name: '2021-2025' },
    { id: '3', name: '2020-2024' }
  ];
  const mockPrograms = [
    { id: '1', name: 'BS Computer Science' },
    { id: '2', name: 'BS Software Engineering' }
  ];
  const mockCourses = [
    { id: '1', code: 'CS201', name: 'Data Structures' },
    { id: '2', code: 'CS202', name: 'Object Oriented Programming' },
    { id: '3', code: 'CS301', name: 'Database Systems' }
  ];

  const mockPEOs = [
    { 
      id: 'PEO-1', 
      statement: 'Apply fundamental computer science principles to solve complex problems', 
      targetKpi: 70, 
      directScore: 76, 
      indirectScore: 72, 
      finalAttainment: 74, 
      status: 'Met' 
    },
    { 
      id: 'PEO-2', 
      statement: 'Exhibit effective communication and teamwork skills in professional environments', 
      targetKpi: 70, 
      directScore: 65, 
      indirectScore: 68, 
      finalAttainment: 66.5, 
      status: 'Not Met' 
    },
    { 
      id: 'PEO-3', 
      statement: 'Demonstrate ethical behavior and commitment to lifelong learning', 
      targetKpi: 70, 
      directScore: 82, 
      indirectScore: 80, 
      finalAttainment: 81, 
      status: 'Met' 
    }
  ];

  const mockGAs = [
    { 
      id: 'GA-1', 
      name: 'Engineering Knowledge', 
      directAttainment: 78, 
      indirectAttainment: 75, 
      totalAttainment: 76.5, 
      cqiTriggered: 'No' 
    },
    { 
      id: 'GA-2', 
      name: 'Problem Analysis', 
      directAttainment: 72, 
      indirectAttainment: 68, 
      totalAttainment: 70, 
      cqiTriggered: 'No' 
    },
    { 
      id: 'GA-3', 
      name: 'Design/Development of Solutions', 
      directAttainment: 66, 
      indirectAttainment: 64, 
      totalAttainment: 65, 
      cqiTriggered: 'Yes' 
    },
    { 
      id: 'GA-4', 
      name: 'Investigation of Complex Problems', 
      directAttainment: 80, 
      indirectAttainment: 78, 
      totalAttainment: 79, 
      cqiTriggered: 'No' 
    },
    { 
      id: 'GA-5', 
      name: 'Modern Tool Usage', 
      directAttainment: 85, 
      indirectAttainment: 82, 
      totalAttainment: 83.5, 
      cqiTriggered: 'No' 
    },
    { 
      id: 'GA-6', 
      name: 'Engineering and Society', 
      directAttainment: 70, 
      indirectAttainment: 68, 
      totalAttainment: 69, 
      cqiTriggered: 'Yes' 
    }
  ];

  const mockStudents = [
    { id: '1', rollNo: 'CS2022001', name: 'Ahmed Ali', clo1: 75, clo2: 82, clo3: 68, clo4: 70 },
    { id: '2', rollNo: 'CS2022002', name: 'Fatima Khan', clo1: 90, clo2: 88, clo3: 85, clo4: 92 },
    { id: '3', rollNo: 'CS2022003', name: 'Hassan Raza', clo1: 65, clo2: 60, clo3: 55, clo4: 58 },
    { id: '4', rollNo: 'CS2022004', name: 'Zainab Qureshi', clo1: 80, clo2: 75, clo3: 82, clo4: 78 },
    { id: '5', rollNo: 'CS2022005', name: 'Ali Hassan', clo1: 72, clo2: 68, clo3: 70, clo4: 65 }
  ];

  return (
    <div className="space-y-6">
      {/* Batch & Program Selection */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Program</label>
            <select 
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Program</option>
              {mockPrograms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Batch</label>
            <select 
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Batch</option>
              {mockBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button className="flex items-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-green-700 transition-all">
              <Download size={18} />
              Export Excel
            </button>
            <button className="flex items-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-red-700 transition-all">
              <FileText size={18} />
              Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Batch Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-xl">
              <BookOpen className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Batch</p>
              <p className="text-2xl font-black text-gray-900">2022-2026</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-xl">
              <Users className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Total Students</p>
              <p className="text-2xl font-black text-gray-900">50</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-xl">
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Overall KPI Status</p>
              <p className="text-2xl font-black text-gray-900">85% Passed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section A: PEO Attainment Summary */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <Target className="w-8 h-8 text-indigo-600" />
          <h2 className="text-2xl font-black text-gray-900">PEO Attainment Summary</h2>
        </div>

        {/* PEO Chart Placeholder */}
        <div className="mb-8 p-8 bg-gradient-to-br from-gray-50 to-indigo-50 rounded-2xl border border-indigo-100">
          <p className="text-center text-gray-500 font-semibold">📊 PEO Horizontal Bar / Gauge Charts will be here</p>
        </div>

        {/* PEO Table */}
        <div className="overflow-x-auto rounded-2xl border border-gray-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
                <th className="p-4 font-black text-xs uppercase tracking-wider">PEO ID</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider">PEO Statement</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">Target KPI (%)</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">Direct Score (%)</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">Indirect Score (%)</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">Final Attainment (%)</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockPEOs.map(peo => (
                <tr key={peo.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-semibold text-gray-900">{peo.id}</td>
                  <td className="p-4 text-gray-700 max-w-xs truncate">{peo.statement}</td>
                  <td className="p-4 text-center font-semibold text-gray-700">{peo.targetKpi}</td>
                  <td className="p-4 text-center font-semibold text-gray-700">{peo.directScore}</td>
                  <td className="p-4 text-center font-semibold text-gray-700">{peo.indirectScore}</td>
                  <td className="p-4 text-center font-black text-gray-900">{peo.finalAttainment}</td>
                  <td className="p-4 text-center">
                    <span className={`px-4 py-1 rounded-full text-xs font-black uppercase ${
                      peo.status === 'Met' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {peo.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section B: GA / PLO Profile */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <Award className="w-8 h-8 text-green-600" />
          <h2 className="text-2xl font-black text-gray-900">GA / PLO Profile</h2>
        </div>

        {/* Radar Chart Placeholder */}
        <div className="mb-8 p-8 bg-gradient-to-br from-gray-50 to-green-50 rounded-2xl border border-green-100">
          <p className="text-center text-gray-500 font-semibold">🕸️ GA Radar Chart (Spider Chart) will be here</p>
        </div>

        {/* GA Table */}
        <div className="overflow-x-auto rounded-2xl border border-gray-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-green-600 to-green-700 text-white">
                <th className="p-4 font-black text-xs uppercase tracking-wider">GA ID</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider">Attribute Name</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">Direct Attainment (%)</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">Indirect Attainment (%)</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">Total Attainment (%)</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">CQI Triggered</th>
              </tr>
            </thead>
            <tbody>
              {mockGAs.map(ga => (
                <tr key={ga.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-semibold text-gray-900">{ga.id}</td>
                  <td className="p-4 text-gray-700">{ga.name}</td>
                  <td className="p-4 text-center font-semibold text-gray-700">{ga.directAttainment}</td>
                  <td className="p-4 text-center font-semibold text-gray-700">{ga.indirectAttainment}</td>
                  <td className="p-4 text-center font-black text-gray-900">{ga.totalAttainment}</td>
                  <td className="p-4 text-center">
                    <span className={`px-4 py-1 rounded-full text-xs font-black uppercase ${
                      ga.cqiTriggered === 'Yes' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {ga.cqiTriggered}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section C: Course-wise CLO Matrix */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-purple-600" />
            <h2 className="text-2xl font-black text-gray-900">Course-wise CLO Matrix</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search student..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl font-semibold text-gray-700 focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <select 
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="bg-gray-50 border-none rounded-xl px-4 py-2 font-semibold text-gray-700 focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select Course</option>
              {mockCourses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
            </select>
          </div>
        </div>

        {/* Student-CLO Grid */}
        <div className="overflow-x-auto rounded-2xl border border-gray-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
                <th className="p-4 font-black text-xs uppercase tracking-wider">Roll Number</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider">Student Name</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">CLO-1</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">CLO-2</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">CLO-3</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">CLO-4</th>
              </tr>
            </thead>
            <tbody>
              {mockStudents
                .filter(s => 
                  s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  s.rollNo.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map(student => (
                <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-semibold text-gray-900">{student.rollNo}</td>
                  <td className="p-4 text-gray-700">{student.name}</td>
                  <td className={`p-4 text-center font-bold ${
                    student.clo1 >= 70 ? 'text-green-700' : student.clo1 >= 50 ? 'text-orange-600' : 'text-red-600'
                  }`}>{student.clo1}</td>
                  <td className={`p-4 text-center font-bold ${
                    student.clo2 >= 70 ? 'text-green-700' : student.clo2 >= 50 ? 'text-orange-600' : 'text-red-600'
                  }`}>{student.clo2}</td>
                  <td className={`p-4 text-center font-bold ${
                    student.clo3 >= 70 ? 'text-green-700' : student.clo3 >= 50 ? 'text-orange-600' : 'text-red-600'
                  }`}>{student.clo3}</td>
                  <td className={`p-4 text-center font-bold ${
                    student.clo4 >= 70 ? 'text-green-700' : student.clo4 >= 50 ? 'text-orange-600' : 'text-red-600'
                  }`}>{student.clo4}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OBEReportDashboard;
