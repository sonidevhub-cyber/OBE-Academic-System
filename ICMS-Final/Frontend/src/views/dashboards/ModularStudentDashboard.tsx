import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/api';

const ModularStudentDashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.id) return;

    api.get(`/assessments/student/result/`)
      .then(res => setResult(res.data))
      .catch(() => setResult(null))
      .finally(() => setLoading(false));
  }, [currentUser]);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* HEADER */}
      <header className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white">
        <h1 className="text-2xl font-bold">Student Dashboard</h1>
        <p className="text-sm opacity-90">
          Welcome, {currentUser?.name}
        </p>
      </header>

      <div className="max-w-6xl mx-auto p-6">

        {/* RESULT CARD */}
        <div className="bg-white rounded-xl shadow p-6">

          <h2 className="text-xl font-bold mb-4">📊 My Results</h2>

          {loading ? (
            <p>Loading...</p>
          ) : !result || result.assessments.length === 0 ? (
            <p className="text-gray-500">No result available</p>
          ) : (
            <>
              {/* TABLE */}
              <div className="overflow-x-auto">
                <table className="w-full border text-center">

                  <thead className="bg-indigo-700 text-white">
                    <tr>
                      <th className="p-2 border">Assessment</th>
                      <th className="p-2 border">Type</th>
                      <th className="p-2 border">Obtained</th>
                      <th className="p-2 border">Total</th>
                      <th className="p-2 border">%</th>
                    </tr>
                  </thead>

                  <tbody>
                    {result.assessments.map((a: any, i: number) => {
                      const percent = ((a.obtained / a.total) * 100).toFixed(1);

                      return (
                        <tr key={i}>
                          <td className="border p-2">{a.title}</td>
                          <td className="border p-2 capitalize">{a.type}</td>
                          <td className="border p-2">{a.obtained}</td>
                          <td className="border p-2">{a.total}</td>
                          <td className="border p-2">{percent}%</td>
                        </tr>
                      );
                    })}
                  </tbody>

                </table>
              </div>

              {/* SUMMARY */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 text-center">

                <div className="bg-blue-100 p-4 rounded">
                  <p className="text-sm">Total Marks</p>
                  <p className="text-xl font-bold">{result.total}</p>
                </div>

                <div className="bg-green-100 p-4 rounded">
                  <p className="text-sm">Percentage</p>
                  <p className="text-xl font-bold">{result.percentage}%</p>
                </div>

                <div className="bg-purple-100 p-4 rounded">
                  <p className="text-sm">GPA</p>
                  <p className="text-xl font-bold">{result.gpa}</p>
                </div>

                <div
                  className={`p-4 rounded ${
                    result.status === "PASS"
                      ? "bg-green-200"
                      : "bg-red-200"
                  }`}
                >
                  <p className="text-sm">Status</p>
                  <p className="text-xl font-bold">{result.status}</p>
                </div>

              </div>
            </>
          )}
        </div>

        {/* LOGOUT */}
        <button
          onClick={logout}
          className="mt-6 bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
        >
          Logout
        </button>

      </div>
    </div>
  );
};

export default ModularStudentDashboard;