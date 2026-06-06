import { createContext, useState, useContext, ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { api } from "../api/api";
import authService from "../api/authService";

// Define types
interface User {
  id: number;
  role: "student" | "staff" | "admin" | "director" | "instructor" | "hod" | "coordinator" | "super_admin" | "SAC" | "alumni";
  rbac_role?: string;
  permissions?: string[];
  roles?: string[]; // Multi-role support
  active_role?: string; // Current active role
  effective_role?: string; // Computed effective role
  username: string;
  email: string;
  [key: string]: any;
}

interface AuthData {
  user: User;
  role?: string;
  permissions?: string[];
  access_token: string;
  refresh_token: string;
}

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  updateUser: (user: User) => void; // New method for updating user data
  switchRole: (newRole: string) => void; // Method for switching between roles
  login: (identifier: string, password: string, enforceRole?: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => void;
  forceLogout: () => void;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  hasPermission: (permissionCode: string) => boolean;
  isSAC: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  
  // ✅ Check for existing session on initial load (use sessionStorage for tab isolation)
  useEffect(() => {
    const storedAuth = sessionStorage.getItem('auth') || localStorage.getItem('auth');
    if (storedAuth) {
      try {
        const authData: AuthData = normalizeAuthData(JSON.parse(storedAuth));
        setCurrentUser(authData.user);

        if (authData.access_token) {
          axios.defaults.headers.common['Authorization'] = `Token ${authData.access_token}`;
          api.defaults.headers.common['Authorization'] = `Token ${authData.access_token}`;
        }
        
        // Store in sessionStorage for this tab
        sessionStorage.setItem('auth', storedAuth);
      } catch (err) {
        console.error('Error parsing stored auth data:', err);
        localStorage.removeItem('auth');
        sessionStorage.removeItem('auth');
      }
    }
    setLoading(false);
  }, []);

  // ✅ Updated login with enforceRole
  const login = async (identifier: string, password: string, enforceRole?: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authService.login({ identifier, password });
      
      console.log('Login response in AuthContext:', response);
      console.log('User role from backend:', response.user.role);
      console.log('User data:', response.user);
      
      if (!response) {
        throw new Error('No response received from login');
      }

      // Set the active role based on enforceRole or default to user's primary role
      if (enforceRole) {
        const hasPermission =
          response.user.role === enforceRole ||
          (response.user.role === 'super_admin' && enforceRole === 'admin') ||
          (response.user.role === 'admin' && ['hod', 'coordinator', 'instructor'].includes(enforceRole)) ||
          (response.user.is_superuser && enforceRole === 'admin') ||
          (enforceRole === 'coordinator' && (
            response.user.role === 'coordinator' ||
            response.user.secondary_role === 'coordinator'
          )) ||
          (enforceRole === 'instructor' && (
            response.user.role === 'instructor' ||
            response.user.can_act_as_instructor ||
            response.user.user_type === 'instructor' ||
            (response.user.roles && response.user.roles.includes('instructor'))
          )) ||
          (enforceRole === 'hod' && (
            response.user.role === 'hod' ||
            response.user.user_type === 'hod' ||
            (response.user.roles && response.user.roles.includes('hod'))
          ));
        
        if (!hasPermission) {
          throw new Error(`Access denied. You don't have ${enforceRole} permissions.`);
        }
        
        response.user.active_role = enforceRole;
        response.user.effective_role = enforceRole;
      } else {
        // No role enforcement, use primary role
        response.user.active_role = response.user.role;
        response.user.effective_role = response.user.role;
      }
      
      const authData: AuthData = normalizeAuthData({
        user: response.user,
        role: response.user.effective_role, // Use effective_role here
        permissions: response.permissions || response.user?.permissions || [],
        access_token: response.access_token,
        refresh_token: response.refresh_token
      });
      
      console.log('Auth data being stored from login:', authData);
      
      setCurrentUser(authData.user);
      // Store in both localStorage and sessionStorage
      const authString = JSON.stringify(authData);
      localStorage.setItem('auth', authString);
      sessionStorage.setItem('auth', authString);
      axios.defaults.headers.common['Authorization'] = `Token ${authData.access_token}`;
      api.defaults.headers.common['Authorization'] = `Token ${authData.access_token}`;
      console.log('Login: Token set on both axios and api instances');
      
      // ✅ Role-based redirect based on effective role
      const activeRole = authData.user.effective_role;

      console.log('Navigation decision:', {
        effective_role: authData.user.effective_role,
        active_role: authData.user.active_role,
        role: authData.user.role,
        navigating_to: activeRole
      });

      // Check effective role first for role switching
      if (activeRole === "hod") {
        navigate("/hod");
      } else if (activeRole === "coordinator") {
        console.log('Navigating to coordinator dashboard');
        navigate("/coordinator");
      } else if (activeRole === "instructor") {
        console.log('Navigating to instructor dashboard');
        navigate("/teacher");
      } else if (authData.user.role === "admin" || authData.user.role === "director" || authData.user.role === "super_admin" || authData.user.is_superuser || authData.user.role === "SAC") {
        navigate("/admin");
      } else if (authData.user.role === "staff") {
        navigate("/staff");
      } else if (authData.user.role === "student") {
        navigate("/student");
      } else if (authData.user.role === "alumni") {
        navigate("/alumni");
      } else {
        console.log('Navigating to default dashboard');
        navigate("/dashboard");
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || "Invalid credentials. Please try again.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: any) => {
    // Registrations are disabled; only admins can create accounts.
    setError('Registration is disabled. Please contact an administrator to create an account.');
    setLoading(false);
    throw new Error('Registration is disabled.');
  };
  
  // Update user data (for role switching)
  const updateUser = (user: User) => {
    setCurrentUser(user);
    const storedAuth = sessionStorage.getItem('auth') || localStorage.getItem('auth');
    if (storedAuth) {
      try {
        const authData: AuthData = normalizeAuthData(JSON.parse(storedAuth));
        authData.user = {
          ...user,
          permissions: user.permissions || authData.permissions || [],
        };
        authData.permissions = authData.user.permissions || [];
        const authString = JSON.stringify(authData);
        localStorage.setItem('auth', authString);
        sessionStorage.setItem('auth', authString);
      } catch (err) {
        console.error('Error updating user data:', err);
      }
    }
  };

  // Switch role and navigate
  const switchRole = (newRole: string) => {
    if (currentUser) {
      const assignedRoles = new Set<string>([
        currentUser.role,
        ...(currentUser.roles || []),
      ]);

      if (!assignedRoles.has(newRole)) {
        console.warn(`Blocked unauthorized role switch attempt to "${newRole}"`);
        return;
      }

      const updatedUser = { ...currentUser, effective_role: newRole, active_role: newRole };
      updateUser(updatedUser);
      // Navigate based on new role
      if (newRole === "hod") {
        navigate("/hod");
      } else if (newRole === "coordinator") {
        navigate("/coordinator");
      } else if (newRole === "instructor") {
        navigate("/teacher");
      } else if (newRole === "admin" || newRole === "principal" || newRole === "director" || newRole === "super_admin" || newRole === "SAC") {
        navigate("/admin");
      } else if (newRole === "staff") {
        navigate("/staff");
      } else if (newRole === "student") {
        navigate("/student");
      } else if (newRole === "alumni") {
        navigate("/alumni");
      } else {
        navigate("/dashboard");
      }
    }
  };

  const logout = () => {
    setCurrentUser(null);
    // Only clear sessionStorage for this tab, keep localStorage for other tabs
    sessionStorage.removeItem('auth');
    delete axios.defaults.headers.common['Authorization'];
    delete api.defaults.headers.common['Authorization'];
    navigate("/login");
  };

  const forceLogout = () => {
    console.log('Force logout called - clearing all auth data');
    setCurrentUser(null);
    localStorage.removeItem('auth');
    localStorage.clear();
    delete axios.defaults.headers.common['Authorization'];
    delete api.defaults.headers.common['Authorization'];
    navigate("/login");
  };

  const hasPermission = (permissionCode: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.rbac_role === 'SAC') return true;

    const aliases: Record<string, string[]> = {
      manage_departments: ['department_management'],
      department_management: ['manage_departments'],
      manage_students: ['student_management', 'user_management'],
      manage_instructors: ['instructor_management', 'user_management'],
      manage_courses: ['course_management'],
      manage_announcements: ['announcement_management'],
      manage_events: ['event_management'],
      manage_hods: ['hod_management', 'user_management'],
      manage_principals: ['principal_management'],
      manage_jsc_users: ['user_management'],
      assign_jsc_permissions: ['jsc_permissions'],
      manage_attendance: ['attendance_management'],
      manage_results: ['results_management'],
      view_obe_reports: ['reports_access'],
      manage_clo: ['clo_management'],
    };

    const granted = new Set(currentUser.permissions || []);
    if (granted.has(permissionCode)) return true;

    const aliasList = aliases[permissionCode] || [];
    return aliasList.some((alias) => granted.has(alias));
  };

  const isSAC = currentUser?.rbac_role === 'SAC';

  return (
    <AuthContext.Provider value={{
      currentUser,
      setCurrentUser,
      updateUser,
      switchRole,
      login,
      register,
      logout,
      forceLogout,
      loading,
      error,
      isAuthenticated: !!currentUser,
      hasPermission,
      isSAC,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

const normalizeAuthData = (authData: AuthData): AuthData => {
  const normalizedPermissions =
    authData.permissions ||
    authData.user.permissions ||
    [];

  return {
    ...authData,
    role: authData.role || authData.user.rbac_role,
    permissions: normalizedPermissions,
    user: {
      ...authData.user,
      rbac_role: authData.user.rbac_role || authData.role,
      permissions: normalizedPermissions,
    },
  };
};