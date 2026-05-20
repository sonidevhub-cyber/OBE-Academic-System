import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { departmentService } from '../api/apiService';

interface Department {
  department_id: number;
  name: string;
  code: string;
  description?: string;
}

interface DepartmentContextType {
  departments: Department[];
  loading: boolean;
  error: string | null;
  fetchDepartments: () => Promise<void>;
  refreshDepartments: () => Promise<void>;
}

const DepartmentContext = createContext<DepartmentContextType | undefined>(undefined);

interface DepartmentProviderProps {
  children: ReactNode;
}

export const DepartmentProvider: React.FC<DepartmentProviderProps> = ({ children }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDepartments = async () => {
    if (departments.length > 0) return; // Avoid refetching if already loaded

    setLoading(true);
    setError(null);
    try {
      const response = await departmentService.getAllDepartments();
      setDepartments(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch departments');
      console.error('Error fetching departments:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshDepartments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await departmentService.getAllDepartments();
      setDepartments(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh departments');
      console.error('Error refreshing departments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const value: DepartmentContextType = {
    departments,
    loading,
    error,
    fetchDepartments,
    refreshDepartments,
  };

  return (
    <DepartmentContext.Provider value={value}>
      {children}
    </DepartmentContext.Provider>
  );
};

export const useDepartment = (): DepartmentContextType => {
  const context = useContext(DepartmentContext);
  if (context === undefined) {
    throw new Error('useDepartment must be used within a DepartmentProvider');
  }
  return context;
};
