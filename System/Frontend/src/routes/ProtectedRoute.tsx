import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  allowedRoles?: string[];
  requiredPermissions?: string[];
  children?: React.ReactNode;
}

const ProtectedRoute = ({ children, allowedRoles = [], requiredPermissions = [] }: ProtectedRouteProps) => {
  const { currentUser, loading, hasPermission, isSAC } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // SAC users have access to everything, so we can grant access immediately.
  if (isSAC) {
    return children ? <>{children}</> : <Outlet />;
  }

  const userRole = currentUser.effective_role || currentUser.active_role || currentUser.role;
  const userRoles = currentUser.roles || [];

  const hasAllowedRole = allowedRoles.length === 0 || allowedRoles.includes(userRole) || userRoles.some(role => allowedRoles.includes(role));
  const hasAllPermissions = requiredPermissions.length === 0 || requiredPermissions.every(permission => hasPermission(permission));

  if (!hasAllowedRole || !hasAllPermissions) {
    return <Navigate to="/access-denied" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;