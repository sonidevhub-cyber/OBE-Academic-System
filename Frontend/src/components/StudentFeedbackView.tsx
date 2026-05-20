import React, { useState, useEffect } from 'react';
import { MessageSquare, ThumbsUp, AlertTriangle, Calendar, User } from 'lucide-react';

interface Feedback {
  id: number;
  title: string;
  message: string;
  feedback_type: string;
  is_positive: boolean;
  hod_name: string;
  created_at: string;
  is_read: boolean;
}

interface StudentFeedbackViewProps {
  studentId: string;
}

const StudentFeedbackView: React.FC<StudentFeedbackViewProps> = ({ studentId }) => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFeedbacks();
  }, [studentId]);

  const fetchFeedbacks = async () => {
    try {
      const response = await fetch(`/api/students/feedback/${studentId}/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFeedbacks(data.feedbacks || []);
      } else {
        setError('Failed to fetch feedbacks');
      }
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
      setError('Error loading feedbacks');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFeedbackTypeColor = (type: string) => {
    const colors = {
      academic: 'bg-blue-100 text-blue-800',
      behavior: 'bg-purple-100 text-purple-800',
      attendance: 'bg-orange-100 text-orange-800',
      general: 'bg-gray-100 text-gray-800'
    };
    return colors[type as keyof typeof colors] || colors.general;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading feedbacks...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <MessageSquare className="w-5 h-5 mr-2" />
          Feedback from HODs ({feedbacks.length})
        </h3>
      </div>

      {feedbacks.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No feedback received yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((feedback) => (
            <div
              key={feedback.id}
              className={`bg-white border rounded-lg p-4 shadow-sm ${
                !feedback.is_read ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {feedback.is_positive ? (
                    <ThumbsUp className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                  )}
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getFeedbackTypeColor(
                      feedback.feedback_type
                    )}`}
                  >
                    {feedback.feedback_type.charAt(0).toUpperCase() + feedback.feedback_type.slice(1)}
                  </span>
                  {!feedback.is_read && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                      New
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  {formatDate(feedback.created_at)}
                </div>
              </div>

              <h4 className="font-semibold text-gray-900 mb-2">{feedback.title}</h4>
              <p className="text-gray-700 mb-3">{feedback.message}</p>

              <div className="flex items-center text-sm text-gray-600">
                <User className="w-4 h-4 mr-1" />
                <span>From: {feedback.hod_name}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentFeedbackView;