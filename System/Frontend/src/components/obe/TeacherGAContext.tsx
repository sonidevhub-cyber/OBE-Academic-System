import React, { useState, useEffect } from 'react';
import obeService, { TeacherGAContext as TeacherGAContextType, InterimAlert, InterimAlertCourse } from '../../api/obeService';

interface TeacherGAContextProps {
  courseId: string;
}

const TeacherGAContext: React.FC<TeacherGAContextProps> = ({ courseId }) => {
  const [context, setContext] = useState<TeacherGAContextType | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;
    const fetchContext = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await obeService.getTeacherGAContext(courseId);
        setContext(data);
      } catch (err) {
        setError('Failed to fetch GA context');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchContext();
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 bg-slate-50 rounded-xl border border-slate-200">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
        <p className="text-red-700 font-bold">{error}</p>
      </div>
    );
  }

  if (!context) {
    return null;
  }

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
      <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
        <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        Interim Alerts - Previous Semesters GA Performance
      </h3>

      {context.course_gas.length === 0 ? (
        <p className="text-slate-500">This course is not mapped to any Graduate Attributes.</p>
      ) : (
        <div className="space-y-4">
          {context.interim_alerts.map((alert: InterimAlert, idx: number) => (
            <div key={idx} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-bold text-slate-800">
                  {alert.ga_code} — {alert.ga_title}
                </h4>
              </div>

              {alert.previous_courses.length === 0 ? (
                <p className="text-sm text-slate-500">No previous courses found for this GA.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-2 text-xs font-black text-slate-500 uppercase tracking-wider">
                          Course Code
                        </th>
                        <th className="px-4 py-2 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                          Semester
                        </th>
                        <th className="px-4 py-2 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                          GA Score
                        </th>
                        <th className="px-4 py-2 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {alert.previous_courses.map((course: InterimAlertCourse, cIdx: number) => (
                        <tr key={cIdx} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-2 font-bold text-slate-700">{course.course_code}</td>
                          <td className="px-4 py-2 text-center text-sm text-slate-600">{course.semester}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`text-sm font-black ${
                              course.status === 'ACHIEVED' ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {course.ga_score.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-black uppercase ${
                                course.status === 'ACHIEVED'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {course.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeacherGAContext;
