import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { coordinatorService } from '../api/coordinatorService';

interface CourseAllocation {
  allocation_id: number;
  course: number;
  course_name: string;
  course_code: string;
  instructor: number;
  instructor_name: string;
  semester: number;
  semester_name: string;
  coordinator: number;
  coordinator_name: string;
  status: 'proposed' | 'approved' | 'rejected' | 'active';
  proposed_at: string;
  hod_comments?: string;
  approved_at?: string | null;
  rejection_reason?: string;
}

interface AllocationContextType {
  allocations: CourseAllocation[];
  loading: boolean;
  fetchAllocations: () => Promise<void>;
  addAllocation: (allocation: CourseAllocation) => void;
  updateAllocation: (id: number, updates: Partial<CourseAllocation>) => void;
  getProposedAllocations: () => CourseAllocation[];
  getApprovedAllocations: () => CourseAllocation[];
  getInstructorAllocations: (instructorId: number) => CourseAllocation[];
  getAllocationsBySemester: (semesterId: number) => CourseAllocation[];
}

const AllocationContext = createContext<AllocationContextType | undefined>(undefined);

export const AllocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [allocations, setAllocations] = useState<CourseAllocation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAllocations = async () => {
    try {
      setLoading(true);
      const response = await coordinatorService.getCourseAllocations();
      if (response.data) {
        setAllocations(response.data);
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
    fetchAllocations();
  }, []);

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
      a => a.instructor === instructorId && (a.status === 'active' || a.status === 'approved')
    );
  const getAllocationsBySemester = (semesterId: number) => allocations.filter(a => a.semester === semesterId && (a.status === 'approved' || a.status === 'active'));

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
      getAllocationsBySemester
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
