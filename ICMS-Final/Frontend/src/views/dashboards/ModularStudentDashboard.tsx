import React from 'react';
import { useAuth } from '../../context/AuthContext';

<<<<<<< HEAD
// Student dashboard simplified: attendance/timetable/datesheet removed.

const ModularStudentDashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
=======
// Import Modular Components
import ProfileModule from '../modules/ProfileModule';
import AttendanceModule from '../modules/AttendanceModule';
import AnnouncementModule from '../modules/AnnouncementModule';
import AnalyticsModule from '../modules/AnalyticsModule';
import SimpleFeedbackModule from '../modules/SimpleFeedbackModule';
import { getProfileImageUrl } from '../../utils/profileHelpers';

type TabId = 'Dashboard' | 'Results' | 'Attendance' | 'Timetable' | 'DateSheet' | 'Events' | 'Announcements' | 'Profile' | 'Feedback';

const ModularStudentDashboard: React.FC = () => {
  const [studentData, setStudentData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabId>('Dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const navigate = useNavigate();

  const token = JSON.parse(localStorage.getItem("auth") || "{}")?.access_token;
  const profileImageUrl = getProfileImageUrl(studentData);

  const modules = [
    { name: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { name: 'Results', icon: <GraduationCap size={18} /> },
    { name: 'Attendance', icon: <CalendarDays size={18} /> },
    { name: 'Timetable', icon: <CalendarDays size={18} /> },
    { name: 'DateSheet', icon: <CalendarDays size={18} /> },
    { name: 'Feedback', icon: <Bell size={18} /> },
    { name: 'Events', icon: <Megaphone size={18} /> },
    { name: 'Announcements', icon: <Bell size={18} /> },
  ];

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!token) return;
        const response = await fetch("http://127.0.0.1:8000/api/students/profile/", {
          headers: { Authorization: `Token ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setStudentData(data);
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
      }
    };
    fetchProfile();
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem("auth");
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Dashboard':
        return <AnalyticsModule token={token} userType="student" darkMode={darkMode} />;
      case 'Attendance':
        return <AttendanceModule token={token} userType="student" darkMode={darkMode} />;
      case 'Announcements':
        return <AnnouncementModule token={token} canCreate={false} />;
      case 'Profile':
        return <ProfileModule profileData={studentData} userType="student" darkMode={darkMode} />;
      case 'Feedback':
        return <SimpleFeedbackModule token={token} userType="student" />;
      default:
        return <div>Content for {activeTab}</div>;
    }
  };
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
        <h1 className="text-2xl font-bold">Student Dashboard</h1>
        <p className="text-blue-100 text-sm mt-1">Attendance/timetable/datesheet removed.</p>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white border border-gray-100 rounded-xl shadow p-6">
          <p className="text-gray-700">Welcome, {currentUser?.name || 'User'}.</p>
        </div>

        <button
          onClick={logout}
          className="mt-6 w-full md:w-auto bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default ModularStudentDashboard;

