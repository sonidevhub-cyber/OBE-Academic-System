import React, { useState, useEffect } from 'react';
import obeService, { CourseSession } from '../../api/obeService';

interface BatchTrackingGridProps {
  batchId: string;
}

const BatchTrackingGrid: React.FC<BatchTrackingGridProps> = ({ batchId }) => {
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<CourseSession | null>(null);

  useEffect(() => {
    if (batchId) {
      loadSessions();
    }
  }, [batchId]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await obeService.getCourseSessions(batchId);
      setSessions(data.sessions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = async (sessionId: string) => {
    try {
      await obeService.finalSubmitCourse(sessionId);
      loadSessions(); // Refresh
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">In Progress</span>;
      case 'ASSESSMENT_DONE':
        // For demonstration, assume KPI achieved; in real app, check actual scores
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Assessment Done (KPI Achieved)</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Unknown</span>;
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Batch Tracking Grid</h2>
      {loading && <div className="p-4">Loading...</div>}
      {!loading && sessions.length === 0 && (
        <div className="p-4 text-center text-gray-500">No course sessions found</div>
      )}
      {!loading && sessions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border rounded-lg">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Course</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Semester</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Instructor</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{session.course_name}</td>
                  <td className="px-4 py-3 text-sm">{session.semester_name}</td>
                  <td className="px-4 py-3 text-sm">{session.instructor_name}</td>
                  <td className="px-4 py-3">{getStatusBadge(session.assessment_status)}</td>
                  <td className="px-4 py-3">
                    {session.assessment_status === 'IN_PROGRESS' && (
                      <button
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        onClick={() => handleFinalSubmit(session.id)}
                      >
                        Final Submit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BatchTrackingGrid;
