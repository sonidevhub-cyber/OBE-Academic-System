import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import ProtectedRoute from './routes/ProtectedRoute';
import { useAuth } from './context/AuthContext';

// Import Role-Based Dashboards from organized structure
import AdminDashboard from './roles/admin/AdminDashboard';
import ModularHODDashboard from './views/dashboards/ModularHODDashboard';
import StudentDashboard from './views/dashboards/ModularStudentDashboard';
import StudentProfile from './components/ui/EnhancedStudentProfile';
import ModularInstructorDashboard from './roles/instructor/InstructorDashboard';
import ModularCoordinatorDashboard from './roles/coordinator/CoordinatorDashboard';
import SacProgramSetup from './views/pages/SacProgramSetup';
import MasterCurriculumManagement from './views/pages/MasterCurriculumManagement';
import MasterCurriculumDetailPage from './views/pages/MasterCurriculumDetailPage';
import Batches from './views/pages/Batches';
import ManagePromotion from './views/pages/ManagePromotion';
import PendingTransfers from './views/pages/PendingTransfers';
import Users from './pages/sac/Users';
import TeacherManagement from './views/pages/TeacherManagement';
import CurriculumVersionDetailPage from './views/modules/curriculum/CurriculumVersionDetailPage';
import GAReport from './pages/GAReport';
import PEOReport from './pages/PEOReport';
import PEOReportDashboard from './features/peoReport/PEOReportDashboard';
import StudentOBEList from './pages/StudentOBEList';
import StudentOBEReport from './pages/StudentOBEReport';
import { AlumniDashboard, AlumniSurvey } from './pages/alumni';
import { EmployerSurveyPublicPage } from './pages/employer';
import ResetPassword from './components/forms/ResetPassword';
import MainPage from './pages/MainPage';
import CUIPortalPage from './pages/Rolebaselogin';
import AccessDenied from './pages/AccessDenied';
import HODPEOCQI from './views/pages/HODPEOCQI';
import HODCQI from './views/pages/HODCQI';
import HODVisionMissionCQI from './views/pages/HODVisionMissionCQI';
import HODCQIClosingAdvisory from './views/pages/HODCQIClosingAdvisory';

// Import new exit survey components
import CoordinatorExitSurveySetup from './views/modules/coordinator/CoordinatorExitSurveySetup';
import StudentExitSurvey from './views/modules/student/StudentExitSurvey';
import SACExitSurveyDashboard from './views/modules/sac/SACExitSurveyDashboard';
import RetakeResultEntryPage from './views/pages/RetakeResultEntryPage';

const Dashboard = () => <AdminDashboard />;

const AppRoutes: React.FC = () => {
  const { currentUser } = useAuth();

  // Determine redirect path based on user role
  const getRedirectPath = () => {
    if (!currentUser) return '/login';

    const userRole = currentUser.effective_role || currentUser.active_role || currentUser.role;
    
    switch (userRole) {
      case 'student':
        return '/student';
      case 'instructor':
        return '/teacher';
      case 'coordinator':
        return '/coordinator';
      case 'hod':
        return '/hod';
      case 'admin':
        return '/admin';
      case 'alumni':
        return '/alumni';
      default:
        return '/dashboard';
    }
  };

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={currentUser ? <Navigate to={getRedirectPath()} /> : <AuthPage />} />
      <Route path="/register" element={<Navigate to="/login" />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/access-denied" element={<AccessDenied />} />
      
      {/* Redirect root to main page */}
      <Route path="/" element={<MainPage />} />
      <Route path="/rolebased-login" element={<CUIPortalPage />} />

      {/* Public token-authenticated employer survey page (no auth required) */}
      <Route path="/employer/survey/:token" element={<EmployerSurveyPublicPage />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>

      {/* Role-specific routes */}
      <Route element={<ProtectedRoute allowedRoles={['student']} />}>
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student-dashboard" element={<Navigate to="/student" />} />
        <Route path="/student/exit-survey" element={<StudentExitSurvey />} />
      </Route>

      {/* Alumni Routes */}
      <Route element={<ProtectedRoute allowedRoles={['alumni']} />}>
        <Route path="/alumni" element={<AlumniDashboard />} />
        <Route path="/alumni-dashboard" element={<Navigate to="/alumni" />} />
        <Route path="/alumni/survey" element={<AlumniSurvey />} />
      </Route>
      
      {/* Student Profile Route - accessible by multiple roles */}
      <Route element={<ProtectedRoute allowedRoles={['admin', 'student']} />}>
        <Route path="/student-profile/:id" element={<StudentProfile />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['instructor']} />}>
        <Route path="/teacher" element={<ModularInstructorDashboard />} />
        <Route path="/instructor-dashboard" element={<ModularInstructorDashboard />} />
        <Route path="/teacher/assessment" element={<RetakeResultEntryPage />} />
        <Route path="/teacher/retakes/:retakeId/results" element={<RetakeResultEntryPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['coordinator']} />}>
        <Route path="/coordinator" element={<ModularCoordinatorDashboard />} />
        <Route path="/coordinator-dashboard" element={<Navigate to="/coordinator" />} />
        <Route path="/curriculum-versions/:id" element={<CurriculumVersionDetailPage />} />
        <Route path="/coordinator/exit-survey-setup" element={<CoordinatorExitSurveySetup />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['hod']} />}>
        <Route path="/hod" element={<ModularHODDashboard />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['admin', 'director', 'coordinator', 'hod', 'SAC']} />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin-dashboard" element={<Navigate to="/admin" />} />
        <Route path="/sac/programs" element={<SacProgramSetup />} />
        <Route path="/curriculum/master" element={<MasterCurriculumManagement />} />
        <Route path="/curriculum/master/:id" element={<MasterCurriculumDetailPage />} />
        <Route path="/sac/programs/:programId/batches" element={<Batches />} />
        <Route path="/sac/programs/:programId/batches/:batchId/promotion" element={<ManagePromotion />} />
        <Route path="/sac/users" element={<Users />} />
        <Route path="/sac/students/pending-transfers" element={<PendingTransfers />} />
        <Route path="/reports/ga-attainment" element={<GAReport />} />
        <Route path="/reports/peo-attainment" element={<PEOReport />} />
        <Route path="/reports/peo-report/:programId/:year" element={<PEOReportDashboard />} />
        <Route path="/reports/student-obe" element={<StudentOBEList />} />
        <Route path="/coordinator/students/:studentId/obe-report" element={<StudentOBEReport />} />
        <Route path="/sac/batches/:batchId/exit-survey-status" element={<SACExitSurveyDashboard />} />
        <Route path="/hod/peo-cqi" element={<HODPEOCQI />} />
        <Route path="/hod/clo-cqi" element={<HODCQI mode="clo" />} />
        <Route path="/hod/ga-cqi" element={<HODCQI mode="ga" />} />
        <Route path="/hod/vision-mission-cqi" element={<HODVisionMissionCQI />} />
        <Route path="/hod/cqi-closing-advisory" element={<HODCQIClosingAdvisory />} />
      </Route>

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
};

export default AppRoutes;
