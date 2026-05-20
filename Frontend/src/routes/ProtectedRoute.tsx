import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  allowedRoles?: string[];
  requiredPermissions?: string[];
  children?: React.ReactNode;
}

const ProtectedRoute = ({ children, allowedRoles = [], requiredPermissions = [] }: ProtectedRouteProps) => {
  const { currentUser, loading, hasPermission, isSAC } = useAuth();

  // Show loading state
  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // If not logged in, redirect to login
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // If roles are specified and user's role is not allowed, redirect to role home
  if (allowedRoles.length > 0) {
    const userRole = currentUser.effective_role || currentUser.active_role || currentUser.role;
    const userRoles = currentUser.roles || [];

    const hasAllowedRole =
      allowedRoles.includes(userRole) ||
      userRoles.some((role) => allowedRoles.includes(role));

    if (!hasAllowedRole) {
      return <Navigate to="/access-denied" replace />;
    }
  }

  if (requiredPermissions.length > 0) {
    const hasAllRequiredPermissions = isSAC || requiredPermissions.every((permission) => hasPermission(permission));
    if (!hasAllRequiredPermissions) {
      return <Navigate to="/access-denied" replace />;
    }
  }

  // Otherwise render page
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
