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
import SacProgramSetup from './views/pages/SacProgramSetup';
import Batches from './views/pages/Batches';
import ManagePromotion from './views/pages/ManagePromotion';
import PendingTransfers from './views/pages/PendingTransfers';
import Users from './pages/sac/Users';
import TeacherManagement from './views/pages/TeacherManagement';
import CurriculumVersionDetailPage from './views/modules/curriculum/CurriculumVersionDetailPage';
// import CourseDetails from 'views/pages/CourseDetails';
import ActiveHODRecordsPage from './pages/ActiveHODRecordsPage';
import ResetPassword from './components/forms/ResetPassword';
import MainPage from './pages/MainPage';
import CUIPortalPage from './pages/Rolebaselogin';
import AccessDenied from './pages/AccessDenied';



//import TransportManagement from './components/pages/TransportManagement';


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

      </Route>
      
      {/* Student Profile Route - accessible by multiple roles */}
      <Route element={<ProtectedRoute allowedRoles={['admin', 'student']} />}>
        <Route path="/student-profile/:id" element={<StudentProfile />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['instructor']} />}>
        <Route path="/teacher" element={<ModularInstructorDashboard />} />
        <Route path="/instructor-dashboard" element={<ModularInstructorDashboard />}  
        
/>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['coordinator']} />}>
        <Route path="/coordinator" element={<ModularCoordinatorDashboard />} />
        <Route path="/coordinator-dashboard" element={<Navigate to="/coordinator" />} />
        <Route path="/curriculum-versions/:id" element={<CurriculumVersionDetailPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['admin', 'principal', 'director']} />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin-dashboard" element={<Navigate to="/admin" />} />
        <Route path="/sac/programs" element={<SacProgramSetup />} />
        <Route path="/sac/programs/:programId/batches" element={<Batches />} />
        <Route path="/sac/programs/:programId/batches/:batchId/promotion" element={<ManagePromotion />} />
        <Route path="/sac/users" element={<Users />} />
        <Route path="/sac/students/pending-transfers" element={<PendingTransfers />} />
      </Route>

       <Route element={<ProtectedRoute allowedRoles={['admin', 'principal']} />}>
  <Route path="/active-hod-records" element={<ActiveHODRecordsPage />} />
</Route>
      
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
