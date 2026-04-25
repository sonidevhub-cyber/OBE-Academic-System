import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import ProtectedRoute from './routes/ProtectedRoute';
import { useAuth } from './context/AuthContext';

// Import Role-Based Dashboards from organized structure
import AdminDashboard from './roles/admin/AdminDashboard';
import StudentDashboard from './roles/student/StudentDashboard';
import StudentProfile from './components/ui/EnhancedStudentProfile';
import ModularInstructorDashboard from './roles/instructor/InstructorDashboard';
import ModularCoordinatorDashboard from './roles/coordinator/CoordinatorDashboard';
import ModularHODDashboard from './roles/hod/HODDashboard';
import PrincipalDashboardComponent from './roles/principal/PrincipalDashboard';

import ResultManagement from './views/pages/ResultManagement';
import ProfessionalResultManagement from './views/pages/ResultManagement';
import EventManagement from './views/pages/EventManagement';
import CourseDetails from './views/pages/CourseDetails';
import CreateEvent from "./views/pages/CreateEvent";
import ActiveHODRecordsPage from './pages/ActiveHODRecordsPage';
import ResetPassword from './components/forms/ResetPassword';
import MainPage from './pages/MainPage';
import CUIPortalPage from './pages/Rolebaselogin';
import AccessDenied from './pages/AccessDenied';
import DateSheetPage from './pages/DateSheetModule';


// Use the full AdminDashboard component from pages/AdminDashboard.tsx

// Use AdminDashboard as the default dashboard for now
const Dashboard = () => <AdminDashboard />;

//
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
    case 'principal':
      return '/principal';
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
      



      {/* Redirect root to login if not authenticated */}
      <Route path="/" element={<MainPage />} />
       <Route path="/rolebased-login" element={<CUIPortalPage />} />
       {/* <Route path="/login"  element={
    currentUser ? <Navigate to={getRedirectPath()} /> : <AuthPage />
  } */}

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>
      
      {/* Role-specific routes */}
      <Route element={<ProtectedRoute allowedRoles={['student']} />}>
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student-dashboard" element={<Navigate to="/student" />} />
        <Route path="/student/datesheet" element={<DateSheetPage />} />
      </Route>
      
      {/* Student Profile Route - accessible by multiple roles */}
      <Route element={<ProtectedRoute allowedRoles={['admin', 'student']} />}>
        <Route path="/student-profile/:id" element={<StudentProfile />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['instructor']} />}>
        <Route path="/teacher" element={<ModularInstructorDashboard />} />
        <Route path="/instructor-dashboard" element={<ModularInstructorDashboard />} />
        <Route path="/teacher/course-details/:id"element={<CourseDetails/>}
/>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['coordinator']} />}>
        <Route path="/coordinator" element={<ModularCoordinatorDashboard />} />
        <Route path="/coordinator-dashboard" element={<Navigate to="/coordinator" />} />
        <Route path="/coordinator/datesheet" element={<DateSheetPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['hod']} />}>
        <Route path="/hod" element={<ModularHODDashboard />} />
        <Route path="/hod-dashboard" element={<Navigate to="/hod" />} />
        <Route path="/hod/datesheet" element={<DateSheetPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['admin', 'principal', 'director']} />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin-dashboard" element={<Navigate to="/admin" />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['principal']} />}>
  <Route path="/principal" element={<PrincipalDashboardComponent />} />
</Route>
       <Route element={<ProtectedRoute allowedRoles={['admin', 'principal']} />}>
  <Route path="/event-management" element={<EventManagement />} />
  <Route path="/active-hod-records" element={<ActiveHODRecordsPage />} />
</Route>
{/* events */}
      <Route path="/create-event" element={<CreateEvent />} />
      
      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/login" />} />
    
        {/* <Route path="/admin" element={<AdminDashboard />} /> */}
      {/* <Route path="/student-login" element={<StudentLogin />} /> */}

<Route
  path="/student/dashboard"
  element={
    currentUser?.role === "student"
      ? <StudentDashboard />
      : <Navigate to="/student-login" replace />
      
  }
  
/>
        

     
      </Routes>

  );
};

export default AppRoutes;
