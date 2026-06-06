import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Download, 
  GraduationCap, 
  BookOpen, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Award,
  Calendar,
  FlaskConical,
  BookText
} from 'lucide-react';

// --- Interfaces ---
interface CLO {
  code: string;
  description: string;
  attainment: number;
  kpi: number;
}

interface CourseCLO {
  semester: number;
  courseCode: string;
  courseName: string;
  courseType: "theory" | "lab";
  clos: CLO[];
}

interface GAAttainment {
  id: string;
  name: string;
  attainment: number;
  kpi: number;
}

// --- Dummy Data ---
const dummyStudent = { 
  name: "Sara Ahmed", 
  rollNo: "2021-CS-45", 
  batch: "Batch 2021-2025", 
  program: "BS Computer Science", 
  cgpa: 3.67, 
  semestersCompleted: 8, 
};

const dummyCoursesCLO: CourseCLO[] = [ 
  { 
    semester: 1, 
    courseCode: "CS101", 
    courseName: "Data Structures", 
    courseType: "theory", 
    clos: [ 
      { code: "CLO1", description: "Apply sorting algorithms", attainment: 78, kpi: 60 }, 
      { code: "CLO2", description: "Analyze time complexity", attainment: 45, kpi: 60 }, 
      { code: "CLO3", description: "Implement tree structures", attainment: 82, kpi: 60 }, 
    ], 
  }, 
  { 
    semester: 1, 
    courseCode: "CS102", 
    courseName: "Object Oriented Programming", 
    courseType: "theory", 
    clos: [ 
      { code: "CLO1", description: "Apply OOP concepts", attainment: 88, kpi: 60 }, 
      { code: "CLO2", description: "Design class hierarchies", attainment: 71, kpi: 60 }, 
    ], 
  }, 
  { 
    semester: 2, 
    courseCode: "CS201", 
    courseName: "Algorithms", 
    courseType: "theory", 
    clos: [ 
      { code: "CLO1", description: "Analyze algorithm complexity", attainment: 55, kpi: 60 }, 
      { code: "CLO2", description: "Apply dynamic programming", attainment: 68, kpi: 60 }, 
    ], 
  }, 
  { 
    semester: 2, 
    courseCode: "CS202", 
    courseName: "Computer Networks Lab", 
    courseType: "lab", 
    clos: [ 
      { code: "CLO1", description: "Configure network protocols", attainment: 74, kpi: 60 }, 
      { code: "CLO2", description: "Analyze network traffic", attainment: 61, kpi: 60 }, 
    ], 
  }, 
];

const dummyGAAttainment: GAAttainment[] = [ 
  { id: "GA1", name: "Engineering Knowledge", attainment: 78, kpi: 60 }, 
  { id: "GA2", name: "Problem Analysis", attainment: 52, kpi: 60 }, 
  { id: "GA3", name: "Design & Development", attainment: 65, kpi: 60 }, 
  { id: "GA4", name: "Investigation", attainment: 71, kpi: 60 }, 
  { id: "GA5", name: "Modern Tool Usage", attainment: 58, kpi: 60 }, 
  { id: "GA6", name: "Engineer & Society", attainment: 83, kpi: 60 }, 
];

const StudentOBEReport: React.FC = () => {
  const navigate = useNavigate();
  const { studentId } = useParams();

  // --- Calculations ---
  const gasMet = dummyGAAttainment.filter(ga => ga.attainment >= ga.kpi).length;
  const gasTotal = dummyGAAttainment.length;
  
  const allCLOs = dummyCoursesCLO.flatMap(c => c.clos);
  const closMet = allCLOs.filter(clo => clo.attainment >= clo.kpi).length;
  const closTotal = allCLOs.length;

  const weakCLOs = dummyCoursesCLO.flatMap(course => 
    course.clos
      .filter(clo => clo.attainment < clo.kpi)
      .map(clo => ({ ...clo, courseName: course.courseName, courseCode: course.courseCode }))
  );

  const semesters = Array.from(new Set(dummyCoursesCLO.map(c => c.semester))).sort((a, b) => a - b);

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
      {/* --- Header --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/reports/student-obe')}
            className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm group"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500 group-hover:text-indigo-600" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
              {dummyStudent.name}
              <span className="text-sm font-bold bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg border border-indigo-100 uppercase tracking-tighter">
                {dummyStudent.rollNo}
              </span>
            </h1>
            <p className="text-slate-500 font-bold mt-1 uppercase tracking-widest text-xs">
              {dummyStudent.program} • {dummyStudent.batch}
            </p>
          </div>
        </div>
        
        <button 
          disabled 
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold opacity-50 cursor-not-allowed shadow-lg shadow-indigo-200 flex items-center gap-2 self-start md:self-center"
        >
          <Download className="w-5 h-5" /> Export PDF
        </button>
      </div>

      {/* --- Summary Stats --- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Cumulative GPA", value: dummyStudent.cgpa, icon: Award, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "GAs Met", value: `${gasMet}/${gasTotal}`, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "CLOs Met", value: `${closMet}/${closTotal}`, icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Semesters", value: dummyStudent.semestersCompleted, icon: Calendar, color: "text-purple-600", bg: "bg-purple-50" },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <div className={`p-2 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-800">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-10">
          {/* --- Section 1: GA Attainment --- */}
          <section>
            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tight">
              <GraduationCap className="w-6 h-6 text-indigo-600" />
              Graduate Attribute Attainment
            </h2>
            <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm space-y-6">
              {dummyGAAttainment.map((ga) => {
                const isMet = ga.attainment >= ga.kpi;
                return (
                  <div key={ga.id} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-800">{ga.id}</span>
                        <span className="text-sm font-bold text-slate-500">— {ga.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-black ${isMet ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {ga.attainment}%
                        </span>
                        {isMet ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-rose-500" />}
                      </div>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden relative border border-slate-200/50">
                      <div 
                        className={`h-full transition-all duration-1000 ${isMet ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                        style={{ width: `${ga.attainment}%` }} 
                      />
                      {/* KPI Marker */}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 border-r border-dashed border-slate-400 z-10"
                        style={{ left: `${ga.kpi}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase">
                      <span>0%</span>
                      <span style={{ marginLeft: `${ga.kpi}%`, transform: 'translateX(-50%)' }} className="text-slate-500">KPI: {ga.kpi}%</span>
                      <span>100%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* --- Section 2: CLO Performance --- */}
          <section>
            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tight">
              <BookOpen className="w-6 h-6 text-indigo-600" />
              CLO Performance by Course
            </h2>
            
            <div className="space-y-12">
              {semesters.map(sem => (
                <div key={sem} className="space-y-6">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-black text-indigo-600 uppercase tracking-[0.2em] whitespace-nowrap">Semester {sem}</span>
                    <div className="h-px w-full bg-indigo-100" />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {dummyCoursesCLO.filter(c => c.semester === sem).map((course, cIdx) => (
                      <div 
                        key={cIdx} 
                        className={`bg-white rounded-[28px] p-6 border-y border-r border-slate-200 shadow-sm border-l-8 ${
                          course.courseType === 'lab' ? 'border-l-blue-500' : 'border-l-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-6">
                          <div>
                            <h3 className="font-black text-slate-800 leading-tight">{course.courseName}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{course.courseCode}</span>
                              <span className="text-[10px] font-black text-slate-300">•</span>
                              <span className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {course.courseType === 'lab' ? <FlaskConical className="w-2.5 h-2.5" /> : <BookText className="w-2.5 h-2.5" />}
                                {course.courseType}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-5">
                          {course.clos.map((clo, cloIdx) => {
                            const isMet = clo.attainment >= clo.kpi;
                            return (
                              <div key={cloIdx} className="space-y-2">
                                <div className="flex justify-between items-start gap-4">
                                  <p className="text-xs font-bold text-slate-600 flex-1">
                                    <span className="text-indigo-600 mr-1 font-black">{clo.code}:</span> {clo.description}
                                  </p>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className={`text-xs font-black ${isMet ? 'text-emerald-600' : 'text-rose-600'}`}>{clo.attainment}%</span>
                                    {isMet ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                                  </div>
                                </div>
                                <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden relative">
                                  <div 
                                    className={`h-full transition-all duration-1000 ${isMet ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                                    style={{ width: `${clo.attainment}%` }} 
                                  />
                                  <div 
                                    className="absolute top-0 bottom-0 w-px border-r border-dashed border-slate-300"
                                    style={{ left: `${clo.kpi}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* --- Section 3: Weak Areas --- */}
        <div className="space-y-8">
          <section className="sticky top-24">
            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tight">
              <AlertTriangle className="w-6 h-6 text-rose-500" />
              Areas Needing Attention
            </h2>
            <div className="space-y-4">
              {weakCLOs.length > 0 ? (
                weakCLOs.map((clo, idx) => (
                  <div key={idx} className="bg-white border-2 border-rose-50 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-rose-50 rounded-xl">
                        <AlertTriangle className="w-5 h-5 text-rose-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="font-black text-rose-900 text-sm uppercase tracking-tight">{clo.code} — {clo.courseCode}</h4>
                          <span className="text-xs font-black text-rose-600">{clo.attainment}%</span>
                        </div>
                        <p className="text-xs font-bold text-slate-500 mb-2">{clo.courseName}</p>
                        <p className="text-xs text-slate-400 italic leading-relaxed">"{clo.description}"</p>
                        <div className="mt-4 pt-3 border-t border-rose-50">
                          <span className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] animate-pulse">Action Required</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-emerald-50 border-2 border-emerald-100 rounded-3xl p-8 text-center">
                  <div className="p-4 bg-emerald-100 rounded-full w-fit mx-auto mb-4 text-emerald-600">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <p className="font-black text-emerald-800 uppercase tracking-tight">Excellent Performance!</p>
                  <p className="text-xs text-emerald-600 font-bold mt-1">Student has met all course outcomes.</p>
                </div>
              )}
            </div>

            <div className="mt-12 p-8 bg-indigo-900 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <GraduationCap className="w-32 h-32 text-white" />
              </div>
              <h4 className="text-lg font-black mb-2 relative z-10">Counseling Required?</h4>
              <p className="text-indigo-200 text-xs font-medium leading-relaxed mb-6 relative z-10">
                If the student is consistently failing multiple GAs or CLOs, consider scheduling a counseling session to discuss academic progress.
              </p>
              <button className="w-full bg-white text-indigo-900 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-lg relative z-10">
                Schedule Meeting
              </button>
            </div>
          </section>
        </div>
      </div>

      <footer className="mt-20 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] pb-8 border-t border-slate-200 pt-10">
        EduOBE Student OBE Report • Academic Excellence Record
      </footer>
    </div>
  );
};

export default StudentOBEReport;
