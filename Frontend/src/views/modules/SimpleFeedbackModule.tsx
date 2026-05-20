import React, { useState } from 'react';
import { MessageSquare, Send, EyeOff } from 'lucide-react';

interface SimpleFeedbackModuleProps {
  token: string;
  userType: 'student' | 'hod';
}

const SimpleFeedbackModule: React.FC<SimpleFeedbackModuleProps> = ({ token, userType }) => {
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [showAnonymousForm, setShowAnonymousForm] = useState(false);
  const [showHODForm, setShowHODForm] = useState(false);

  const [studentForm, setStudentForm] = useState({ title: '', message: '', target: 'instructor' });
  const [anonymousForm, setAnonymousForm] = useState({ title: '', message: '' });
  const [hodForm, setHODForm] = useState({ title: '', message: '', student_id: '', student_name: '' });

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('http://localhost:8000/api/students/feedback/to-staff/', {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(studentForm)
      });
      alert('Feedback sent!');
      setShowStudentForm(false);
      setStudentForm({ title: '', message: '', target: 'instructor' });
    } catch (error) {
      alert('Error sending feedback');
    }
  };

  const handleAnonymousSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('http://localhost:8000/api/students/feedback/anonymous/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(anonymousForm)
      });
      alert('Anonymous feedback sent!');
      setShowAnonymousForm(false);
      setAnonymousForm({ title: '', message: '' });
    } catch (error) {
      alert('Error sending feedback');
    }
  };

  const handleHODSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('http://localhost:8000/api/students/feedback/create/', {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...hodForm, feedback_type: 'general', is_positive: true })
      });
      alert('Feedback sent to student!');
      setShowHODForm(false);
      setHODForm({ title: '', message: '', student_id: '', student_name: '' });
    } catch (error) {
      alert('Error sending feedback');
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <MessageSquare className="text-blue-500" />
        Feedback System
      </h2>

      <div className="flex gap-4 mb-6">
        {userType === 'student' && (
          <>
            <button
              onClick={() => setShowStudentForm(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2"
            >
              <MessageSquare size={16} />
              Feedback to Staff
            </button>
            <button
              onClick={() => setShowAnonymousForm(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <EyeOff size={16} />
              Anonymous Feedback
            </button>
          </>
        )}
        
        {userType === 'hod' && (
          <button
            onClick={() => setShowHODForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <MessageSquare size={16} />
            Give Feedback to Student
          </button>
        )}
      </div>

      {/* Student Feedback Form */}
      {showStudentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Feedback to Staff</h3>
            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <select
                value={studentForm.target}
                onChange={(e) => setStudentForm({ ...studentForm, target: e.target.value })}
                className="w-full p-2 border rounded-md"
              >
                <option value="instructor">Instructor</option>
                <option value="hod">HOD</option>
              </select>
              <input
                type="text"
                placeholder="Title"
                value={studentForm.title}
                onChange={(e) => setStudentForm({ ...studentForm, title: e.target.value })}
                className="w-full p-2 border rounded-md"
                required
              />
              <textarea
                placeholder="Message"
                value={studentForm.message}
                onChange={(e) => setStudentForm({ ...studentForm, message: e.target.value })}
                className="w-full p-2 border rounded-md"
                rows={4}
                required
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowStudentForm(false)} className="px-4 py-2 text-gray-600 border rounded-md">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-md">Send</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Anonymous Feedback Form */}
      {showAnonymousForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Anonymous Feedback</h3>
            <form onSubmit={handleAnonymousSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Title"
                value={anonymousForm.title}
                onChange={(e) => setAnonymousForm({ ...anonymousForm, title: e.target.value })}
                className="w-full p-2 border rounded-md"
                required
              />
              <textarea
                placeholder="Anonymous message"
                value={anonymousForm.message}
                onChange={(e) => setAnonymousForm({ ...anonymousForm, message: e.target.value })}
                className="w-full p-2 border rounded-md"
                rows={4}
                required
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAnonymousForm(false)} className="px-4 py-2 text-gray-600 border rounded-md">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-md">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HOD Feedback Form */}
      {showHODForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Give Feedback to Student</h3>
            <form onSubmit={handleHODSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Student ID"
                value={hodForm.student_id}
                onChange={(e) => setHODForm({ ...hodForm, student_id: e.target.value })}
                className="w-full p-2 border rounded-md"
                required
              />
              <input
                type="text"
                placeholder="Student Name"
                value={hodForm.student_name}
                onChange={(e) => setHODForm({ ...hodForm, student_name: e.target.value })}
                className="w-full p-2 border rounded-md"
                required
              />
              <input
                type="text"
                placeholder="Title"
                value={hodForm.title}
                onChange={(e) => setHODForm({ ...hodForm, title: e.target.value })}
                className="w-full p-2 border rounded-md"
                required
              />
              <textarea
                placeholder="Feedback message"
                value={hodForm.message}
                onChange={(e) => setHODForm({ ...hodForm, message: e.target.value })}
                className="w-full p-2 border rounded-md"
                rows={4}
                required
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowHODForm(false)} className="px-4 py-2 text-gray-600 border rounded-md">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">Send</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="text-gray-600">
        {userType === 'student' ? 
          'Send feedback to your instructors or HOD, or submit anonymous feedback.' :
          'Give feedback to students in your department.'
        }
      </div>
    </div>
  );
};

export default SimpleFeedbackModule;