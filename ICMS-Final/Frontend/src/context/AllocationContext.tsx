import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { coordinatorService, CourseAllocation } from '../api/coordinatorService';
import { useAuth } from './AuthContext';

interface AllocationContextType {
  allocations: CourseAllocation[];
  loading: boolean;
  fetchAllocations: () => Promise<void>;
  addAllocation: (allocation: CourseAllocation) => void;
  updateAllocation: (id: number, updates: Partial<CourseAllocation>) => void;
  getProposedAllocations: () => CourseAllocation[];
  getApprovedAllocations: () => CourseAllocation[];
  getInstructorAllocations: (instructorId: number) => CourseAllocation[];
  getAllocationsByBatch: (batchId: string) => CourseAllocation[];
}

const AllocationContext = createContext<AllocationContextType | undefined>(undefined);

export const AllocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, loading: authLoading } = useAuth();
  const [allocations, setAllocations] = useState<CourseAllocation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAllocations = async () => {
    try {
      setLoading(true);
      const response = await coordinatorService.getCourseAllocations();
      const data = response.data.data; // Use .data.data for new API response format
      if (Array.isArray(data)) {
        setAllocations(data);
      } else {
        console.warn('Expected array for allocations, received:', data);
        setAllocations([]);
      }
    } catch (error) {
      console.error('Error fetching allocations:', error);
      // Fallback to empty array on error
      setAllocations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && !authLoading) {
      fetchAllocations();
    }
  }, [currentUser, authLoading]);

  const addAllocation = (allocation: CourseAllocation) => {
    setAllocations(prev => [...prev, allocation]);
    // Immediately refresh from server to get latest data
    fetchAllocations();
  };

  const updateAllocation = (id: number, updates: Partial<CourseAllocation>) => {
    setAllocations(prev => prev.map(allocation => {
      if (allocation.allocation_id === id) {
        const updated = { ...allocation, ...updates };
        // Auto-activate approved allocations
        if (updated.status === 'approved') {
          updated.status = 'active';
        }
        return updated;
      }
      return allocation;
    }));
    // Refresh from server after update
    setTimeout(() => fetchAllocations(), 500);
  };

  const getProposedAllocations = () => allocations.filter(a => a.status === 'proposed');
  const getApprovedAllocations = () => allocations.filter(a => a.status === 'approved' || a.status === 'active');
  const getInstructorAllocations = (instructorId: number) =>
    allocations.filter(
      a =>
      (Number(a.instructor) === instructorId || Number(a.teacher) === instructorId) &&
      (a.status === 'active' || a.status === 'approved') &&
      (a as any).batch_status !== 'graduated' &&
      a.semester_no === (a as any).batch_current_semester
    );
  const getAllocationsByBatch = (batchId: string) => allocations.filter(a => a.batch === batchId && (a.status === 'approved' || a.status === 'active'));

  return (
    <AllocationContext.Provider value={{
      allocations,
      loading,
      fetchAllocations,
      addAllocation,
      updateAllocation,
      getProposedAllocations,
      getApprovedAllocations,
      getInstructorAllocations,
      getAllocationsByBatch
    }}>
      {children}
    </AllocationContext.Provider>
  );
};

export const useAllocations = () => {
  const context = useContext(AllocationContext);
  if (!context) {
    throw new Error('useAllocations must be used within AllocationProvider');
  }
  return context;
};